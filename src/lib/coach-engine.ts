// Rutina Coach Engine — otak personal coach digital.
// Berisi: readiness scoring, auto-progression (double progression & pace),
// deteksi plateau + deload, cross-training warning, PR (Epley 1RM), streak.

import { db } from "@/lib/db";
import {
  addDays,
  dateKeyInTZ,
  dayOfWeek,
  dayStart,
  daysBetween,
  DAY_NAMES,
  formatDateLabel,
  formatPace,
  isoWeekKey,
  roundWeight,
  startOfToday,
  weekKeyStartDate,
} from "@/lib/date";
import type {
  CoachMessageDTO,
  CompleteSessionResult,
  ExerciseDTO,
  LastPerformanceDTO,
  PerformedSetDTO,
  PlanItemDTO,
  PlanResponse,
  ProgressResponse,
  ReadinessDTO,
  ReadinessLevel,
  SessionDTO,
  SessionSummaryDTO,
  SessionType,
} from "@/lib/types";

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

/** Epley formula untuk estimasi 1RM */
export function estimate1RM(weightKg: number, reps: number): number {
  if (reps <= 1) return weightKg;
  return Math.round(weightKg * (1 + reps / 30) * 10) / 10;
}

export function computeReadiness(input: {
  sleepHours: number;
  soreness: number;
  stress: number;
  energy: number;
}): {
  score: number;
  level: ReadinessLevel;
  levelLabel: string;
  recommendation: string;
} {
  const sleep = input.sleepHours;
  const sleepPts = sleep >= 8 ? 30 : sleep >= 7 ? 25 : sleep >= 6 ? 17 : sleep >= 5 ? 9 : 4;
  const energyPts = clamp(input.energy, 1, 5) * 6;
  const sorePts = (6 - clamp(input.soreness, 1, 5)) * 4;
  const stressPts = (6 - clamp(input.stress, 1, 5)) * 4;
  const score = clamp(Math.round(sleepPts + energyPts + sorePts + stressPts), 5, 100);

  let level: ReadinessLevel;
  let levelLabel: string;
  let recommendation: string;
  if (score >= 80) {
    level = "PRIME";
    levelLabel = "Prime";
    recommendation =
      "Kondisi tubuhmu prima! Target latihan standar — ini saat yang tepat untuk push maksimal.";
  } else if (score >= 60) {
    level = "GOOD";
    levelLabel = "Siap";
    recommendation =
      "Kondisi baik. Jalankan target sesuai rencana dan tetap dengarkan sinyal tubuhmu.";
  } else if (score >= 40) {
    level = "MODERATE";
    levelLabel = "Moderat";
    recommendation =
      "Tubuhmu setengah siap. Rutina menurunkan beban ±15% dan mengurangi 1 set untuk hari ini.";
  } else {
    level = "LOW";
    levelLabel = "Pemulihan";
    recommendation =
      "Tubuhmu butuh pemulihan. Rutina menurunkan beban ±30% — fokus pada teknik, atau ganti dengan sesi recovery ringan (jalan santai 20–30 menit / stretching).";
  }
  return { score, level, levelLabel, recommendation };
}

function exerciseToDTO(e: {
  id: string;
  name: string;
  type: string;
  muscleGroup: string;
  equipment: string | null;
  tempo: string | null;
  incrementKg: number;
  cue: string | null;
}): ExerciseDTO {
  return {
    id: e.id,
    name: e.name,
    type: e.type as ExerciseDTO["type"],
    muscleGroup: e.muscleGroup,
    equipment: e.equipment,
    tempo: e.tempo,
    incrementKg: e.incrementKg,
    cue: e.cue,
  };
}

function setsSummary(sets: PerformedSetDTO[], type: string): string {
  if (type === "CARDIO") {
    const totalDist = sets.reduce((a, s) => a + (s.distanceKm ?? 0), 0);
    const totalDur = sets.reduce((a, s) => a + (s.durationSec ?? 0), 0);
    if (totalDist <= 0) return "—";
    return `${totalDist.toFixed(2)} km · ${Math.floor(totalDur / 60)}m${String(
      Math.floor(totalDur % 60)
    ).padStart(2, "0")}s (${formatPace(totalDur / totalDist)}/km)`;
  }
  const work = sets.filter((s) => !s.isWarmup);
  const w = work[0]?.weightKg ?? 0;
  return `${work.length}×${work.map((s) => s.reps).join(",")} @ ${w} kg`;
}

async function createCoachMessage(msg: {
  type: string;
  title: string;
  body: string;
  severity?: string;
  dedupeKey?: string;
}) {
  if (msg.dedupeKey) {
    const existing = await db.coachMessage.findFirst({
      where: { dedupeKey: msg.dedupeKey },
    });
    if (existing) return null;
  }
  return db.coachMessage.create({
    data: {
      type: msg.type,
      title: msg.title,
      body: msg.body,
      severity: msg.severity ?? "info",
      dedupeKey: msg.dedupeKey ?? null,
      date: startOfToday(),
    },
  });
}

// ---------------------------------------------------------------------------
// Streak
// ---------------------------------------------------------------------------

export async function computeStreak(): Promise<{
  weeks: number;
  thisWeekSessions: number;
  weeklyGoal: number;
}> {
  const profile = await getProfile();
  const sessions = await db.workoutSession.findMany({
    where: { status: "COMPLETED" },
    select: { date: true },
  });
  const counts = new Map<string, number>();
  for (const s of sessions) {
    const k = isoWeekKey(dateKeyInTZ(s.date));
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const todayKey = dateKeyInTZ();
  const thisWeek = isoWeekKey(todayKey);
  const thisWeekSessions = counts.get(thisWeek) ?? 0;

  let weeks = 0;
  let cursor = thisWeek;
  if ((counts.get(cursor) ?? 0) >= 3) {
    weeks += 1;
  }
  cursor = isoWeekKey(addDays(weekKeyStartDate(cursor), -1)); // minggu lalu
  while ((counts.get(cursor) ?? 0) >= 3) {
    weeks += 1;
    cursor = isoWeekKey(addDays(weekKeyStartDate(cursor), -1));
  }
  return { weeks, thisWeekSessions, weeklyGoal: profile.weeklyGoalSessions };
}

// ---------------------------------------------------------------------------
// Plateau detection
// ---------------------------------------------------------------------------

export interface PlateauInfo {
  exerciseId: string;
  exerciseName: string;
  detail: string;
}

export async function detectPlateaus(): Promise<PlateauInfo[]> {
  const exercises = await db.exercise.findMany({ where: { type: "STRENGTH" } });
  const result: PlateauInfo[] = [];

  for (const ex of exercises) {
    const logs = await db.setLog.findMany({
      where: { exerciseId: ex.id, isWarmup: false, session: { status: "COMPLETED" } },
      include: { session: true },
    });
    // best e1RM per sesi, urut tanggal naik
    const perSession = new Map<string, { date: Date; best: number }>();
    for (const log of logs) {
      if (log.weightKg <= 0 || log.reps <= 0) continue;
      const key = dateKeyInTZ(log.session.date);
      const e1rm = estimate1RM(log.weightKg, log.reps);
      const cur = perSession.get(key);
      if (!cur) perSession.set(key, { date: log.session.date, best: e1rm });
      else if (e1rm > cur.best) cur.best = e1rm;
    }
    const series = [...perSession.entries()]
      .sort((a, b) => a[1].date.getTime() - b[1].date.getTime())
      .map(([k, v]) => ({ dateKey: k, e1RM: v.best }));

    if (series.length < 4) continue;
    const last3 = series.slice(-3);
    const prior = series.slice(0, -3);
    const priorBest = Math.max(...prior.map((s) => s.e1RM));
    const last3Max = Math.max(...last3.map((s) => s.e1RM));
    const last3Min = Math.min(...last3.map((s) => s.e1RM));

    const flat = (last3Max - last3Min) / last3Max <= 0.02 && last3Max <= priorBest * 1.01;
    const declining = last3.every((s) => s.e1RM < priorBest * 0.99);

    if (flat || declining) {
      const kind = declining ? "menurun" : "stagnan";
      result.push({
        exerciseId: ex.id,
        exerciseName: ex.name,
        detail: `e1RM terbaikmu di ${last3
          .map((s) => `${s.e1RM.toFixed(1)} kg`)
          .join(" → ")} (${kind}) selama 3 sesi terakhir.`,
      });
    }
  }
  return result;
}

export async function ensurePlateauMessages(): Promise<PlateauInfo[]> {
  const plateaus = await detectPlateaus();
  for (const p of plateaus) {
    await createCoachMessage({
      type: "WARNING",
      severity: "warning",
      title: `Plateau terdeteksi: ${p.exerciseName}`,
      body: `Performa ${p.exerciseName} kamu mandek — ${p.detail} Akumulasi kelelahan bisa jadi penyebabnya. Bagaimana kalau mulai Deload Week dengan intensitas 50%? Kamu bisa aktifkan dari halaman Progres.`,
      dedupeKey: `plateau-${p.exerciseId}-${isoWeekKey(dateKeyInTZ())}`,
    });
  }
  return plateaus;
}

// ---------------------------------------------------------------------------
// Cross-training / injury prevention
// ---------------------------------------------------------------------------

export async function ensureCrossTrainingMessage(): Promise<void> {
  const today = startOfToday();
  const since = new Date(today.getTime() - 6 * 86400000);
  const recent = await db.workoutSession.findMany({
    where: { status: "COMPLETED", type: "CARDIO", date: { gte: since } },
    select: { date: true },
  });
  const cardioCount = recent.length;

  // cek 3 hari berturut-turut lari (termasuk hari ini/kemarin)
  const dayKeys = new Set(recent.map((s) => dateKeyInTZ(s.date)));
  const todayKey = dateKeyInTZ();
  let consecutive = 0;
  for (let i = 0; i < 5; i++) {
    const k = addDays(todayKey, -i);
    if (dayKeys.has(k)) consecutive++;
    else if (i > 0) break;
  }

  if (cardioCount >= 4 || consecutive >= 3) {
    await createCoachMessage({
      type: "SUGGESTION",
      title: "Terlalu banyak kardio minggu ini",
      body:
        consecutive >= 3
          ? "Kamu sudah lari 3 hari berturut-turut. Risiko cedera lutut & shin splint meningkat. Bagaimana kalau hari ini diganti jalan santai, latihan kekuatan kaki, atau swimming?"
          : `Kamu sudah mencatat ${cardioCount} sesi kardio dalam 7 hari terakhir. Agar beban tubuh seimbang, pertimbangkan ganti 1 sesi lari dengan latihan kekuatan (kaki/core) atau jalan santai.`,
      dedupeKey: `crosstrain-${isoWeekKey(todayKey)}`,
    });
  }
}

// ---------------------------------------------------------------------------
// Personal records
// ---------------------------------------------------------------------------

export async function backfillPRs(): Promise<void> {
  const exercises = await db.exercise.findMany({ where: { type: "STRENGTH" } });
  for (const ex of exercises) {
    const existing = await db.personalRecord.findFirst({ where: { exerciseId: ex.id } });
    if (existing) continue;
    const logs = await db.setLog.findMany({
      where: { exerciseId: ex.id, isWarmup: false, session: { status: "COMPLETED" } },
      include: { session: true },
    });
    let best: { w: number; r: number; e: number; d: Date } | null = null;
    for (const log of logs) {
      if (log.weightKg <= 0 || log.reps <= 0) continue;
      const e = estimate1RM(log.weightKg, log.reps);
      if (!best || e > best.e) best = { w: log.weightKg, r: log.reps, e, d: log.session.date };
    }
    if (best) {
      await db.personalRecord.create({
        data: {
          exerciseId: ex.id,
          weightKg: best.w,
          reps: best.r,
          estimated1RM: best.e,
          date: best.d,
        },
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

export async function getProfile() {
  let profile = await db.profile.findFirst();
  if (!profile) {
    profile = await db.profile.create({ data: {} });
  }
  return profile;
}

// ---------------------------------------------------------------------------
// PLAN (target harian + penyesuaian readiness/deload)
// ---------------------------------------------------------------------------

async function getLastPerformance(
  exerciseId: string,
  beforeDateKey: string
): Promise<LastPerformanceDTO | null> {
  const logs = await db.setLog.findMany({
    where: {
      exerciseId,
      session: { status: "COMPLETED", date: { lte: dayStart(beforeDateKey) } },
    },
    include: { session: true, exercise: true },
    orderBy: { createdAt: "asc" },
  });
  if (logs.length === 0) return null;
  // ambil sesi terbaru
  let latestDate = logs[0].session.date;
  for (const l of logs) if (l.session.date > latestDate) latestDate = l.session.date;
  const latestKey = dateKeyInTZ(latestDate);
  const sessionLogs = logs.filter((l) => dateKeyInTZ(l.session.date) === latestKey);
  const ex = sessionLogs[0].exercise;
  const sets: PerformedSetDTO[] = sessionLogs
    .sort((a, b) => a.setNumber - b.setNumber)
    .map((l) => ({
      setNumber: l.setNumber,
      weightKg: l.weightKg,
      reps: l.reps,
      rpe: l.rpe,
      isWarmup: l.isWarmup,
      distanceKm: l.distanceKm,
      durationSec: l.durationSec,
    }));
  return {
    dateKey: latestKey,
    dateLabel: formatDateLabel(latestKey),
    summary: setsSummary(sets, ex.type),
    sets,
  };
}

export async function getPlan(dateKey?: string): Promise<PlanResponse> {
  const key = dateKey ?? dateKeyInTZ();
  const dow = dayOfWeek(key);
  const profile = await getProfile();

  const items = await db.planItem.findMany({
    where: { dayOfWeek: dow },
    include: { exercise: true },
    orderBy: { order: "asc" },
  });

  // readiness hari ini
  const rc = await db.readinessCheck.findFirst({ where: { date: dayStart(key) } });
  const readiness: ReadinessDTO = rc
    ? {
        dateKey: key,
        done: true,
        sleepHours: rc.sleepHours,
        soreness: rc.soreness,
        stress: rc.stress,
        energy: rc.energy,
        score: rc.score,
        level: rc.level as ReadinessLevel,
        levelLabel:
          rc.level === "PRIME" ? "Prime" : rc.level === "GOOD" ? "Siap" : rc.level === "MODERATE" ? "Moderat" : "Pemulihan",
        recommendation: rc.recommendation,
      }
    : {
        dateKey: key,
        done: false,
        sleepHours: 7,
        soreness: 3,
        stress: 3,
        energy: 3,
        score: 0,
        level: "GOOD",
        levelLabel: "—",
        recommendation: "Lakukan check-in dulu supaya Rutina bisa menyesuaikan targetmu hari ini.",
      };

  // deload state
  const today = dayStart(key);
  const deloadActive = !!profile.deloadUntil && profile.deloadUntil >= today;
  const deloadDaysLeft = deloadActive
    ? daysBetween(key, dateKeyInTZ(profile.deloadUntil!)) + 1
    : 0;

  const streak = await computeStreak();

  const planItems: PlanItemDTO[] = [];
  for (const item of items) {
    const lastPerf = await getLastPerformance(item.exerciseId, key);
    let targetWeight = item.currentWeightKg;
    let targetSets = item.targetSets;
    let targetPace = item.targetPaceSecPerKm;
    const notes: string[] = [];

    // catatan progression (kenapa target seperti ini)
    let progressionNote: string | null = null;
    if (item.exercise.type === "CARDIO") {
      if (lastPerf) {
        const totalDist = lastPerf.sets.reduce((a, s) => a + (s.distanceKm ?? 0), 0);
        const totalDur = lastPerf.sets.reduce((a, s) => a + (s.durationSec ?? 0), 0);
        if (totalDist > 0 && totalDur > 0) {
          const lastPace = totalDur / totalDist;
          if (lastPace <= (item.targetPaceSecPerKm ?? 999) + 5) {
            progressionNote = `Pace target dipertajam ke ${formatPace(
              item.targetPaceSecPerKm!
            )}/km — sesi terakhir kamu sudah mencapai ${formatPace(lastPace)}/km.`;
          } else {
            progressionNote = `Pace target ${formatPace(
              item.targetPaceSecPerKm!
            )}/km — terakhir kamu ${formatPace(lastPace)}/km, kejar pelan-pelan.`;
          }
        }
      } else {
        progressionNote = `Target ${item.targetDistanceKm?.toFixed(1)} km dengan pace ${formatPace(
          item.targetPaceSecPerKm ?? 0
        )}/km.`;
      }
    } else if (lastPerf) {
      const work = lastPerf.sets.filter((s) => !s.isWarmup);
      const lastW = work[0]?.weightKg ?? item.currentWeightKg;
      const hitMax = work.length > 0 && work.every((s) => s.reps >= item.targetMaxReps && s.weightKg >= lastW - 0.01);
      if (Math.abs(item.currentWeightKg - lastW) > 0.01 && item.currentWeightKg > lastW) {
        progressionNote = `Beban naik ke ${item.currentWeightKg} kg! Sesi terakhir kamu sukses ${item.targetSets}×${item.targetMaxReps} @ ${lastW} kg.`;
      } else if (Math.abs(item.currentWeightKg - lastW) > 0.01 && item.currentWeightKg < lastW) {
        progressionNote = `Beban diturunkan ke ${item.currentWeightKg} kg supaya kamu pulih dulu — terakhir ${work
          .map((s) => s.reps)
          .join(", ")} reps @ ${lastW} kg di bawah target.`;
      } else if (hitMax) {
        progressionNote = `Kamu sudah menyentuh ${item.targetMaxReps} reps di semua set — capai lagi hari ini untuk naik beban!`;
      } else {
        progressionNote = `Pertahankan ${item.currentWeightKg} kg — capai ${item.targetMaxReps} reps di semua ${item.targetSets} set untuk naik ke ${roundWeight(
          item.currentWeightKg + item.exercise.incrementKg
        )} kg.`;
      }
    } else {
      progressionNote = `Sesi pertama untuk ${item.exercise.name} — mulai dari ${item.currentWeightKg} kg.`;
    }

    // penyesuaian readiness
    if (rc) {
      if (rc.level === "MODERATE") {
        targetWeight = roundWeight(targetWeight * 0.85);
        targetSets = Math.max(2, targetSets - 1);
        if (item.exercise.type === "CARDIO" && targetPace) targetPace += 15;
        notes.push("Readiness moderat: beban −15%, −1 set");
      } else if (rc.level === "LOW") {
        targetWeight = roundWeight(targetWeight * 0.7);
        targetSets = Math.max(2, targetSets - 1);
        if (item.exercise.type === "CARDIO" && targetPace) targetPace += 30;
        notes.push("Readiness rendah: intensitas dipangkas ±30%");
      }
    }
    // penyesuaian deload
    if (deloadActive) {
      if (item.exercise.type === "STRENGTH") targetWeight = roundWeight(item.currentWeightKg * 0.5);
      if (item.exercise.type === "CARDIO" && item.targetPaceSecPerKm)
        targetPace = item.targetPaceSecPerKm + 45;
      notes.push("Deload week: intensitas 50%");
    }

    planItems.push({
      id: item.id,
      order: item.order,
      exercise: exerciseToDTO(item.exercise),
      targetSets,
      targetMinReps: item.targetMinReps,
      targetMaxReps: item.targetMaxReps,
      targetWeightKg: targetWeight,
      baseWeightKg: item.currentWeightKg,
      restSeconds: item.restSeconds,
      targetDistanceKm: item.targetDistanceKm,
      targetPaceSecPerKm: targetPace,
      adjusted: notes.length > 0,
      adjustmentNote: notes.length > 0 ? notes.join(" · ") : null,
      progressionNote,
      lastPerformance: lastPerf,
    });
  }

  // pesan coach: unread + 7 hari terakhir
  const since = new Date(today.getTime() - 7 * 86400000);
  const messagesRaw = await db.coachMessage.findMany({
    where: { OR: [{ read: false }, { date: { gte: since } }] },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take: 12,
  });
  const messages: CoachMessageDTO[] = messagesRaw.map((m) => ({
    id: m.id,
    type: m.type as CoachMessageDTO["type"],
    title: m.title,
    body: m.body,
    severity: m.severity as CoachMessageDTO["severity"],
    dateKey: dateKeyInTZ(m.date),
    dateLabel: formatDateLabel(dateKeyInTZ(m.date)),
    read: m.read,
  }));

  // sesi hari ini
  const todaySessionsRaw = await db.workoutSession.findMany({
    where: { date: dayStart(key) },
    include: { setLogs: true },
    orderBy: { createdAt: "asc" },
  });
  const todaySessions: SessionSummaryDTO[] = todaySessionsRaw.map((s) => ({
    id: s.id,
    dateKey: dateKeyInTZ(s.date),
    dateLabel: formatDateLabel(dateKeyInTZ(s.date)),
    type: s.type as SessionType,
    title: s.title,
    status: s.status,
    totalVolumeKg: s.totalVolumeKg,
    durationMin: s.durationMin,
    setCount: s.setLogs.length,
  }));

  const isRestDay = planItems.length === 0;
  const allCardio = planItems.every((p) => p.exercise.type === "CARDIO") && planItems.length > 0;
  let sessionTitle = "Hari Pemulihan";
  if (!isRestDay) {
    if (allCardio) {
      sessionTitle = `Kardio — ${planItems[0].exercise.name}`;
    } else {
      const groups = [...new Set(planItems.map((p) => p.exercise.muscleGroup))];
      sessionTitle = groups.slice(0, 3).join(" · ");
    }
  }

  return {
    dateKey: key,
    dayOfWeek: dow,
    dayName: DAY_NAMES[dow],
    dateLabel: formatDateLabel(key),
    sessionTitle,
    sessionType: allCardio ? "CARDIO" : planItems.length ? "STRENGTH" : "RECOVERY",
    isRestDay,
    readiness,
    deload: {
      active: deloadActive,
      daysLeft: deloadDaysLeft,
      endDateKey: deloadActive ? dateKeyInTZ(profile.deloadUntil!) : null,
    },
    items: planItems,
    messages,
    unreadCount: messages.filter((m) => !m.read).length,
    streak,
    todaySessions,
  };
}

// ---------------------------------------------------------------------------
// Session mapping & completion (progression engine)
// ---------------------------------------------------------------------------

export function sessionToDTO(s: {
  id: string;
  date: Date;
  type: string;
  title: string;
  status: string;
  notes: string | null;
  readinessScore: number | null;
  totalVolumeKg: number;
  durationMin: number | null;
  setLogs: ({
    id: string;
    exerciseId: string;
    setNumber: number;
    weightKg: number;
    reps: number;
    rpe: number | null;
    isWarmup: boolean;
    distanceKm: number | null;
    durationSec: number | null;
    createdAt: Date;
    exercise: { name: string; type: string };
  })[];
}): SessionDTO {
  const key = dateKeyInTZ(s.date);
  return {
    id: s.id,
    dateKey: key,
    dateLabel: formatDateLabel(key),
    type: s.type as SessionType,
    title: s.title,
    status: s.status,
    notes: s.notes,
    readinessScore: s.readinessScore,
    totalVolumeKg: Math.round(s.totalVolumeKg * 10) / 10,
    durationMin: s.durationMin,
    sets: s.setLogs
      .slice()
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .map((l) => ({
        id: l.id,
        exerciseId: l.exerciseId,
        exerciseName: l.exercise.name,
        exerciseType: l.exercise.type as "STRENGTH" | "CARDIO",
        setNumber: l.setNumber,
        weightKg: l.weightKg,
        reps: l.reps,
        rpe: l.rpe,
        isWarmup: l.isWarmup,
        distanceKm: l.distanceKm,
        durationSec: l.durationSec,
        createdAt: l.createdAt.toISOString(),
      })),
  };
}

export async function completeSession(
  sessionId: string,
  opts: { notes?: string; durationMin?: number }
): Promise<CompleteSessionResult> {
  const session = await db.workoutSession.findUnique({
    where: { id: sessionId },
    include: { setLogs: { include: { exercise: true } } },
  });
  if (!session) throw new Error("Sesi tidak ditemukan");

  const key = dateKeyInTZ(session.date);
  const dow = dayOfWeek(key);

  // volume total
  const volumeKg = session.setLogs
    .filter((l) => !l.isWarmup && l.exercise.type === "STRENGTH")
    .reduce((a, l) => a + l.weightKg * l.reps, 0);

  // --- PR detection (dibandingkan dengan PR sebelum sesi ini) ---
  const prResults: CompleteSessionResult["prs"] = [];
  const strengthLogs = session.setLogs.filter(
    (l) => !l.isWarmup && l.exercise.type === "STRENGTH" && l.weightKg > 0 && l.reps > 0
  );
  const byExercise = new Map<string, typeof strengthLogs>();
  for (const l of strengthLogs) {
    const arr = byExercise.get(l.exerciseId) ?? [];
    arr.push(l);
    byExercise.set(l.exerciseId, arr);
  }
  for (const [exerciseId, logs] of byExercise) {
    const existingPR = await db.personalRecord.findFirst({
      where: { exerciseId },
      orderBy: { estimated1RM: "desc" },
    });
    let best = { w: 0, r: 0, e: 0, log: logs[0] };
    for (const l of logs) {
      const e = estimate1RM(l.weightKg, l.reps);
      if (e > best.e) best = { w: l.weightKg, r: l.reps, e, log: l };
    }
    const isNew = !existingPR || best.e > existingPR.estimated1RM + 0.01;
    if (isNew && best.e > 0) {
      await db.personalRecord.create({
        data: {
          exerciseId,
          weightKg: best.w,
          reps: best.r,
          estimated1RM: best.e,
          date: session.date,
        },
      });
      await createCoachMessage({
        type: "CELEBRATION",
        severity: "success",
        title: `PR baru: ${best.log.exercise.name}!`,
        body: `${best.w} kg × ${best.r} reps (estimasi 1RM ${best.e.toFixed(1)} kg). Rekor personalmu pecah — kerja bagus, atlet!`,
      });
    }
    prResults.push({
      exerciseName: best.log.exercise.name,
      weightKg: best.w,
      reps: best.r,
      estimated1RM: Math.round(best.e * 10) / 10,
      isNew,
    });
  }

  // --- Auto-progression per latihan ---
  const progressions: CompleteSessionResult["progressions"] = [];
  for (const [exerciseId, logs] of byExercise) {
    const ex = logs[0].exercise;
    const planItem = await db.planItem.findUnique({
      where: { exerciseId_dayOfWeek: { exerciseId, dayOfWeek: dow } },
    });
    if (!planItem) continue;
    const work = logs.filter((l) => !l.isWarmup);
    if (work.length === 0) continue;

    const allHitMax = work.every(
      (l) => l.reps >= planItem.targetMaxReps && l.weightKg >= planItem.currentWeightKg - 0.01
    );
    const allBelowMin = work.every(
      (l) => l.reps < planItem.targetMinReps && l.weightKg >= planItem.currentWeightKg - 0.01
    );

    if (allHitMax) {
      const next = roundWeight(planItem.currentWeightKg + ex.incrementKg);
      await db.planItem.update({
        where: { id: planItem.id },
        data: { currentWeightKg: next },
      });
      progressions.push({
        exerciseName: ex.name,
        note: `Double progression! ${planItem.currentWeightKg} kg → ${next} kg pada sesi berikutnya (repetisi kembali ke ${planItem.targetMinReps}).`,
        type: "CELEBRATION",
      });
      await createCoachMessage({
        type: "CELEBRATION",
        severity: "success",
        title: `${ex.name} naik kelas!`,
        body: `Kamu menuntaskan ${planItem.targetSets}×${planItem.targetMaxReps} @ ${planItem.currentWeightKg} kg. Sesi berikutnya beban naik ke ${next} kg dengan target ${planItem.targetMinReps}–${planItem.targetMaxReps} reps.`,
      });
    } else if (allBelowMin) {
      const next = roundWeight(planItem.currentWeightKg * 0.9);
      await db.planItem.update({
        where: { id: planItem.id },
        data: { currentWeightKg: next },
      });
      progressions.push({
        exerciseName: ex.name,
        note: `Autoregulasi: beban diturunkan ke ${next} kg agar kamu pulih dulu.`,
        type: "WARNING",
      });
      await createCoachMessage({
        type: "WARNING",
        severity: "warning",
        title: `${ex.name} disesuaikan`,
        body: `Repetisimu jauh di bawah target di beban ${planItem.currentWeightKg} kg. Rutina menurunkan beban ke ${next} kg dulu — fokus kualitas gerakan, naik lagi setelah repetisi kembali tercapai.`,
      });
    } else {
      progressions.push({
        exerciseName: ex.name,
        note: `Beban tetap ${planItem.currentWeightKg} kg — capai ${planItem.targetMaxReps} reps di semua set untuk naik.`,
        type: "INFO",
      });
    }
  }

  // --- Cardio progression (pace-based) ---
  const cardioLogs = session.setLogs.filter(
    (l) => l.exercise.type === "CARDIO" && (l.distanceKm ?? 0) > 0 && (l.durationSec ?? 0) > 0
  );
  const cardioByEx = new Map<string, typeof cardioLogs>();
  for (const l of cardioLogs) {
    const arr = cardioByEx.get(l.exerciseId) ?? [];
    arr.push(l);
    cardioByEx.set(l.exerciseId, arr);
  }
  for (const [exerciseId, logs] of cardioByEx) {
    const ex = logs[0].exercise;
    const planItem = await db.planItem.findUnique({
      where: { exerciseId_dayOfWeek: { exerciseId, dayOfWeek: dow } },
    });
    if (!planItem || !planItem.targetPaceSecPerKm || !planItem.targetDistanceKm) continue;
    const dist = logs.reduce((a, l) => a + (l.distanceKm ?? 0), 0);
    const dur = logs.reduce((a, l) => a + (l.durationSec ?? 0), 0);
    if (dist <= 0 || dur <= 0) continue;
    const pace = dur / dist;
    const distMet = dist >= planItem.targetDistanceKm - 0.05;
    const paceMet = pace <= planItem.targetPaceSecPerKm + 5;

    if (distMet && paceMet) {
      const nextPace = Math.max(240, planItem.targetPaceSecPerKm - 5);
      await db.planItem.update({
        where: { id: planItem.id },
        data: { targetPaceSecPerKm: nextPace },
      });
      progressions.push({
        exerciseName: ex.name,
        note: `Pace target dipertajam: ${formatPace(planItem.targetPaceSecPerKm)}/km → ${formatPace(nextPace)}/km.`,
        type: "CELEBRATION",
      });
      await createCoachMessage({
        type: "CELEBRATION",
        severity: "success",
        title: "Target lari tercapai!",
        body: `${dist.toFixed(2)} km dengan pace ${formatPace(pace)}/km. Sesi berikutnya target pace dipertajam ke ${formatPace(nextPace)}/km.`,
      });
    } else if (!paceMet && pace > planItem.targetPaceSecPerKm + 45) {
      const nextPace = planItem.targetPaceSecPerKm + 5;
      await db.planItem.update({
        where: { id: planItem.id },
        data: { targetPaceSecPerKm: nextPace },
      });
      progressions.push({
        exerciseName: ex.name,
        note: `Pace target dilonggarkan ke ${formatPace(nextPace)}/km — konsisten dulu, kecepatan menyusul.`,
        type: "INFO",
      });
    } else {
      progressions.push({
        exerciseName: ex.name,
        note: `Target pace ${formatPace(planItem.targetPaceSecPerKm)}/km belum terkalahkan (${formatPace(pace)}/km) — coba lagi sesi depan.`,
        type: "INFO",
      });
    }
  }

  // --- pesan pencegahan & plateau ---
  await ensureCrossTrainingMessage();
  await ensurePlateauMessages();

  const updated = await db.workoutSession.update({
    where: { id: sessionId },
    data: {
      status: "COMPLETED",
      totalVolumeKg: volumeKg,
      notes: opts.notes ?? session.notes,
      durationMin: opts.durationMin ?? session.durationMin,
    },
    include: { setLogs: { include: { exercise: true } } },
  });

  return {
    session: sessionToDTO(updated),
    prs: prResults,
    progressions,
    volumeKg: Math.round(volumeKg * 10) / 10,
  };
}

// ---------------------------------------------------------------------------
// Progress analytics
// ---------------------------------------------------------------------------

export async function getProgressData(): Promise<ProgressResponse> {
  const profile = await getProfile();
  const today = startOfToday();
  const deloadActive = !!profile.deloadUntil && profile.deloadUntil >= today;

  const sessions = await db.workoutSession.findMany({
    where: { status: "COMPLETED" },
    include: { setLogs: { include: { exercise: true } } },
    orderBy: { date: "asc" },
  });

  // volume mingguan (8 minggu terakhir)
  const weeklyVolume: ProgressResponse["weeklyVolume"] = [];
  const todayKey = dateKeyInTZ();
  const thisWeekStart = weekKeyStartDate(isoWeekKey(todayKey));
  for (let i = 7; i >= 0; i--) {
    const weekStart = addDays(thisWeekStart, -7 * i);
    const weekEnd = addDays(weekStart, 7);
    let volume = 0;
    let sessCount = 0;
    let cardioKm = 0;
    for (const s of sessions) {
      const k = dateKeyInTZ(s.date);
      if (k >= weekStart && k < weekEnd) {
        sessCount++;
        for (const l of s.setLogs) {
          if (l.isWarmup) continue;
          if (l.exercise.type === "STRENGTH") volume += l.weightKg * l.reps;
          else cardioKm += l.distanceKm ?? 0;
        }
      }
    }
    weeklyVolume.push({
      weekKey: isoWeekKey(weekStart),
      weekLabel: formatDateLabel(weekStart),
      volume: Math.round(volume),
      sessions: sessCount,
      cardioKm: Math.round(cardioKm * 10) / 10,
    });
  }

  // tren e1RM per latihan strength
  const strengthExercises = await db.exercise.findMany({
    where: { type: "STRENGTH" },
    orderBy: { muscleGroup: "asc" },
  });
  const plateauList = await detectPlateaus();
  const plateauByEx = new Map(plateauList.map((p) => [p.exerciseId, p]));

  const exercises: ProgressResponse["exercises"] = [];
  for (const ex of strengthExercises) {
    const history: ProgressResponse["exercises"][number]["history"] = [];
    const perSession = new Map<string, { best: number; volume: number }>();
    for (const s of sessions) {
      for (const l of s.setLogs) {
        if (l.exerciseId !== ex.id || l.isWarmup || l.weightKg <= 0 || l.reps <= 0) continue;
        const k = dateKeyInTZ(s.date);
        const cur = perSession.get(k) ?? { best: 0, volume: 0 };
        cur.best = Math.max(cur.best, estimate1RM(l.weightKg, l.reps));
        cur.volume += l.weightKg * l.reps;
        perSession.set(k, cur);
      }
    }
    for (const [k, v] of [...perSession.entries()].sort()) {
      history.push({
        dateKey: k,
        dateLabel: formatDateLabel(k),
        e1RM: v.best,
        volume: Math.round(v.volume),
      });
    }
    if (history.length === 0) continue;
    exercises.push({
      id: ex.id,
      name: ex.name,
      muscleGroup: ex.muscleGroup,
      type: "STRENGTH",
      history,
      currentE1RM: history[history.length - 1]?.e1RM ?? null,
      plateau: plateauByEx.has(ex.id),
    });
  }

  // PR aktif per latihan
  const allPRs = await db.personalRecord.findMany({
    include: { exercise: true },
    orderBy: { date: "desc" },
  });
  const bestPRByEx = new Map<string, (typeof allPRs)[number]>();
  for (const pr of allPRs) {
    const cur = bestPRByEx.get(pr.exerciseId);
    if (!cur || pr.estimated1RM > cur.estimated1RM) bestPRByEx.set(pr.exerciseId, pr);
  }
  const prs = [...bestPRByEx.values()]
    .sort((a, b) => b.estimated1RM - a.estimated1RM)
    .map((pr) => ({
      id: pr.id,
      exerciseName: pr.exercise.name,
      muscleGroup: pr.exercise.muscleGroup,
      weightKg: pr.weightKg,
      reps: pr.reps,
      estimated1RM: Math.round(pr.estimated1RM * 10) / 10,
      dateKey: dateKeyInTZ(pr.date),
      dateLabel: formatDateLabel(dateKeyInTZ(pr.date)),
    }));

  // stats
  const streak = await computeStreak();
  const readinessRecent = await db.readinessCheck.findMany({
    where: { date: { gte: new Date(today.getTime() - 7 * 86400000) } },
  });
  const avgReadiness7d =
    readinessRecent.length > 0
      ? Math.round(
          readinessRecent.reduce((a, r) => a + r.score, 0) / readinessRecent.length
        )
      : null;

  const totalVolumeKg = sessions.reduce((a, s) => a + s.totalVolumeKg, 0);

  return {
    weeklyVolume,
    exercises,
    prs,
    plateaus: plateauList,
    stats: {
      totalSessions: sessions.length,
      totalVolumeKg: Math.round(totalVolumeKg),
      streakWeeks: streak.weeks,
      avgReadiness7d,
      weeklyGoal: profile.weeklyGoalSessions,
      thisWeekSessions: streak.thisWeekSessions,
    },
    deload: {
      active: deloadActive,
      daysLeft: deloadActive ? daysBetween(todayKey, dateKeyInTZ(profile.deloadUntil!)) + 1 : 0,
      endDateKey: deloadActive ? dateKeyInTZ(profile.deloadUntil!) : null,
    },
  };
}

// ---------------------------------------------------------------------------
// Konteks untuk AI Coach (LLM)
// ---------------------------------------------------------------------------

export async function buildCoachContext(): Promise<string> {
  const profile = await getProfile();
  const plan = await getPlan();
  const progress = await getProgressData();
  const sessions = await db.workoutSession.findMany({
    where: { status: "COMPLETED" },
    include: { setLogs: { include: { exercise: true } } },
    orderBy: { date: "desc" },
    take: 5,
  });

  const sessionLines = sessions.map((s) => {
    const key = dateKeyInTZ(s.date);
    const detail = s.setLogs
      .filter((l) => !l.isWarmup)
      .map((l) =>
        l.exercise.type === "CARDIO"
          ? `${l.exercise.name} ${(l.distanceKm ?? 0).toFixed(1)}km ${
              l.durationSec ? formatPace(l.durationSec / (l.distanceKm ?? 1)) + "/km" : ""
            }`
          : `${l.exercise.name} ${l.weightKg}kg×${l.reps}`
      )
      .join("; ");
    return `- ${formatDateLabel(key)} (${s.title}): ${detail} | volume ${Math.round(s.totalVolumeKg)} kg`;
  });

  const prLines = progress.prs
    .slice(0, 6)
    .map((p) => `- ${p.exerciseName}: ${p.weightKg} kg × ${p.reps} (e1RM ${p.estimated1RM} kg)`);

  const plateauLines = progress.plateaus.map((p) => `- ${p.exerciseName}: ${p.detail}`);

  return [
    `Profil atlet: ${profile.name}, target ${profile.weeklyGoalSessions} sesi/minggu.`,
    `Hari ini ${plan.dateLabel} (${plan.dayName}). Rencana: ${
      plan.isRestDay ? "hari pemulihan/istirahat" : plan.items.map((i) => i.exercise.name).join(", ")
    }.`,
    `Readiness hari ini: ${
      plan.readiness.done ? `${plan.readiness.score}/100 (${plan.readiness.levelLabel})` : "belum check-in"
    }.`,
    `Streak minggu aktif: ${progress.stats.streakWeeks}. Sesi minggu ini: ${progress.stats.thisWeekSessions}/${progress.stats.weeklyGoal}. Rata-rata readiness 7 hari: ${progress.stats.avgReadiness7d ?? "-"}.${
      plan.deload.active ? ` Deload week AKTIF, sisa ${plan.deload.daysLeft} hari (intensitas 50%).` : ""
    }`,
    `Sesi latihan terakhir (terbaru dulu):\n${sessionLines.join("\n") || "-"}`,
    `Personal records (e1RM Epley):\n${prLines.join("\n") || "-"}`,
    plateauLines.length ? `Plateau terdeteksi:\n${plateauLines.join("\n")}` : "Tidak ada plateau terdeteksi.",
  ].join("\n\n");
}
