// Seed Rutina — library latihan, rencana mingguan, dan 5 minggu riwayat
// yang realistis (termasuk pola plateau di Back Squat untuk demo deteksi).

import { db } from "@/lib/db";
import {
  backfillPRs,
  computeReadiness,
  ensureCrossTrainingMessage,
  ensurePlateauMessages,
} from "@/lib/coach-engine";
import { addDays, dateKeyInTZ, dayOfWeek, dayStart, roundWeight } from "@/lib/date";

interface ExerciseSeed {
  name: string;
  type: "STRENGTH" | "CARDIO";
  muscleGroup: string;
  equipment?: string;
  tempo?: string;
  incrementKg?: number;
  cue?: string;
}

const EXERCISES: ExerciseSeed[] = [
  { name: "Bench Press", type: "STRENGTH", muscleGroup: "Dada", equipment: "Barbell", tempo: "3-1-1", incrementKg: 2.5, cue: "Skapula rapat, bar menyentuh dada dengan kontrol." },
  { name: "Incline Dumbbell Press", type: "STRENGTH", muscleGroup: "Dada", equipment: "Dumbbell", tempo: "3-0-1", incrementKg: 1, cue: "Siku 45°, dorong hingga hampir menyatu." },
  { name: "Tricep Pushdown", type: "STRENGTH", muscleGroup: "Trisep", equipment: "Cable", tempo: "2-0-1", incrementKg: 2.5, cue: "Siku menempel badan, kunci di bawah." },
  { name: "Overhead Press", type: "STRENGTH", muscleGroup: "Bahu", equipment: "Barbell", tempo: "2-0-1", incrementKg: 2.5, cue: "Iga turun, jangan melengkung punggung." },
  { name: "Lateral Raise", type: "STRENGTH", muscleGroup: "Bahu", equipment: "Dumbbell", tempo: "2-0-1", incrementKg: 1, cue: "Angkat sisi sampai sejajar bahu, tanpa swing." },
  { name: "Back Squat", type: "STRENGTH", muscleGroup: "Kaki", equipment: "Barbell", tempo: "3-1-1", incrementKg: 2.5, cue: "Dada ke atas, lutut mengikuti arah kaki." },
  { name: "Leg Press", type: "STRENGTH", muscleGroup: "Kaki", equipment: "Mesin", tempo: "2-0-1", incrementKg: 5, cue: "Punggung menempel, jangan kunci lutut." },
  { name: "Romanian Deadlift", type: "STRENGTH", muscleGroup: "Hamstring", equipment: "Barbell", tempo: "3-1-1", incrementKg: 2.5, cue: "Pinggul mundur, bar dekat kaki, punggung netral." },
  { name: "Barbell Row", type: "STRENGTH", muscleGroup: "Punggung", equipment: "Barbell", tempo: "2-1-1", incrementKg: 2.5, cue: "Batang ke perut, bahu turun." },
  { name: "Lat Pulldown", type: "STRENGTH", muscleGroup: "Punggung", equipment: "Mesin", tempo: "2-0-1", incrementKg: 2.5, cue: "Dada ke atas, tarik ke tulang selangka." },
  { name: "Bicep Curl", type: "STRENGTH", muscleGroup: "Bisep", equipment: "Dumbbell", tempo: "2-0-1", incrementKg: 1, cue: "Siku diam, tanpa ayunan badan." },
  { name: "Lari", type: "CARDIO", muscleGroup: "Full Body", equipment: "Trackmill / Jalanan", cue: "Landsoft di tengah kaki, kadens 170+." },
  { name: "Jalan Santai", type: "CARDIO", muscleGroup: "Full Body", cue: "Napas nyaman, masih bisa ngobrol." },
];

// Rencana mingguan: 1 = Senin ... 7 = Minggu
interface PlanSeed {
  day: number;
  name: string;
  sets: number;
  minReps: number;
  maxReps: number;
  weight: number;
  rest: number;
  dist?: number;
  pace?: number; // detik per km
}

const PLAN: PlanSeed[] = [
  { day: 1, name: "Bench Press", sets: 3, minReps: 8, maxReps: 10, weight: 35, rest: 120 },
  { day: 1, name: "Incline Dumbbell Press", sets: 3, minReps: 10, maxReps: 12, weight: 12, rest: 90 },
  { day: 1, name: "Tricep Pushdown", sets: 3, minReps: 10, maxReps: 12, weight: 22.5, rest: 60 },
  { day: 2, name: "Lari", sets: 1, minReps: 0, maxReps: 0, weight: 0, rest: 0, dist: 5, pace: 360 },
  { day: 3, name: "Back Squat", sets: 3, minReps: 8, maxReps: 10, weight: 60, rest: 150 },
  { day: 3, name: "Leg Press", sets: 3, minReps: 10, maxReps: 12, weight: 90, rest: 120 },
  { day: 3, name: "Romanian Deadlift", sets: 3, minReps: 8, maxReps: 10, weight: 45, rest: 120 },
  { day: 5, name: "Barbell Row", sets: 3, minReps: 8, maxReps: 10, weight: 42.5, rest: 120 },
  { day: 5, name: "Lat Pulldown", sets: 3, minReps: 10, maxReps: 12, weight: 40, rest: 90 },
  { day: 5, name: "Bicep Curl", sets: 3, minReps: 10, maxReps: 12, weight: 10, rest: 60 },
  { day: 6, name: "Lari", sets: 1, minReps: 0, maxReps: 0, weight: 0, rest: 0, dist: 8, pace: 380 },
];

// Cerita performa 5 minggu (index 0 = 5 minggu lalu, 4 = minggu ini)
interface WeekPerf {
  w?: number; // beban kg (strength)
  r?: number[]; // reps per set (strength)
  dur?: number; // durasi detik (cardio)
}
const HISTORY: Record<string, WeekPerf[]> = {
  "Bench Press": [
    { w: 35, r: [8, 8, 8] },
    { w: 35, r: [9, 9, 8] },
    { w: 35, r: [10, 10, 10] },
    { w: 37.5, r: [8, 8, 8] },
    { w: 37.5, r: [9, 9, 9] },
  ],
  "Incline Dumbbell Press": [
    { w: 12, r: [10, 10, 10] },
    { w: 12, r: [11, 11, 10] },
    { w: 12, r: [12, 12, 12] },
    { w: 13, r: [10, 10, 10] },
    { w: 13, r: [11, 11, 11] },
  ],
  "Tricep Pushdown": [
    { w: 22.5, r: [11, 11, 10] },
    { w: 22.5, r: [12, 12, 12] },
    { w: 25, r: [10, 10, 10] },
    { w: 25, r: [11, 11, 11] },
    { w: 25, r: [12, 12, 12] },
  ],
  "Back Squat": [
    { w: 60, r: [10, 10, 10] },
    { w: 62.5, r: [8, 8, 8] },
    { w: 62.5, r: [8, 8, 8] },
    { w: 62.5, r: [8, 8, 8] },
    { w: 62.5, r: [8, 8, 8] },
  ],
  "Leg Press": [
    { w: 90, r: [12, 12, 12] },
    { w: 95, r: [11, 11, 11] },
    { w: 95, r: [12, 12, 12] },
    { w: 100, r: [11, 11, 11] },
    { w: 100, r: [12, 12, 12] },
  ],
  "Romanian Deadlift": [
    { w: 45, r: [10, 10, 10] },
    { w: 47.5, r: [9, 9, 9] },
    { w: 47.5, r: [10, 10, 10] },
    { w: 50, r: [8, 8, 8] },
    { w: 50, r: [9, 9, 9] },
  ],
  "Barbell Row": [
    { w: 42.5, r: [9, 9, 9] },
    { w: 42.5, r: [10, 10, 10] },
    { w: 45, r: [8, 8, 8] },
    { w: 45, r: [9, 9, 9] },
    { w: 45, r: [10, 10, 10] },
  ],
  "Lat Pulldown": [
    { w: 40, r: [12, 12, 12] },
    { w: 42.5, r: [11, 11, 11] },
    { w: 42.5, r: [12, 12, 12] },
    { w: 45, r: [11, 11, 11] },
    { w: 45, r: [11, 11, 11] },
  ],
  "Bicep Curl": [
    { w: 10, r: [12, 12, 12] },
    { w: 10, r: [12, 12, 12] },
    { w: 11, r: [11, 11, 11] },
    { w: 11, r: [12, 12, 12] },
    { w: 12, r: [11, 11, 11] },
  ],
  // Lari Selasa 5 km (durasi detik)
  LARI_TUE: [
    { dur: 1850 },
    { dur: 1810 },
    { dur: 1780 },
    { dur: 1760 },
    { dur: 1735 },
  ],
  // Lari Sabtu 8 km (long run)
  LARI_SAT: [
    { dur: 3030 },
    { dur: 3000 },
    { dur: 2975 },
    { dur: 2950 },
    { dur: 2945 },
  ],
};

const READINESS: { sleepHours: number; energy: number; soreness: number; stress: number }[] = [
  { sleepHours: 7.5, energy: 4, soreness: 2, stress: 2 }, // d-7
  { sleepHours: 6.5, energy: 3, soreness: 3, stress: 3 }, // d-6
  { sleepHours: 8, energy: 4, soreness: 2, stress: 3 }, // d-5
  { sleepHours: 5.5, energy: 2, soreness: 4, stress: 4 }, // d-4
  { sleepHours: 7, energy: 4, soreness: 2, stress: 2 }, // d-3
  { sleepHours: 6, energy: 3, soreness: 3, stress: 3 }, // d-2
  { sleepHours: 7.5, energy: 3, soreness: 2, stress: 3 }, // d-1
];

let seeding: Promise<void> | null = null;

export async function ensureSeeded(): Promise<void> {
  const count = await db.exercise.count();
  if (count > 0) return;
  if (!seeding) {
    seeding = seed().finally(() => {
      seeding = null;
    });
  }
  await seeding;
}

async function seed() {
  // --- exercises ---
  const exByName = new Map<string, string>();
  for (const e of EXERCISES) {
    const created = await db.exercise.create({
      data: {
        name: e.name,
        type: e.type,
        muscleGroup: e.muscleGroup,
        equipment: e.equipment ?? null,
        tempo: e.tempo ?? null,
        incrementKg: e.incrementKg ?? 2.5,
        cue: e.cue ?? null,
      },
    });
    exByName.set(e.name, created.id);
  }

  // --- plan items ---
  for (const p of PLAN) {
    const exId = exByName.get(p.name)!;
    await db.planItem.create({
      data: {
        dayOfWeek: p.day,
        order: p.day === 2 || p.day === 6 ? 1 : PLAN.filter((x) => x.day === p.day).indexOf(p) + 1,
        exerciseId: exId,
        targetSets: p.sets,
        targetMinReps: p.minReps,
        targetMaxReps: p.maxReps,
        currentWeightKg: p.weight,
        restSeconds: p.rest,
        targetDistanceKm: p.dist ?? null,
        targetPaceSecPerKm: p.pace ?? null,
      },
    });
  }

  // --- profile ---
  await db.profile.create({ data: { name: "Atlet Rutina", weeklyGoalSessions: 4 } });

  const todayKey = dateKeyInTZ();
  // Senin minggu ini
  const thisMonday = addDays(todayKey, -(dayOfWeek(todayKey) - 1));

  // --- readiness 7 hari terakhir (tidak termasuk hari ini) ---
  const readinessByDate = new Map<string, number>();
  for (let i = 7; i >= 1; i--) {
    const k = addDays(todayKey, -i);
    const input = READINESS[7 - i];
    const result = computeReadiness(input);
    await db.readinessCheck.create({
      data: {
        date: dayStart(k),
        sleepHours: input.sleepHours,
        soreness: input.soreness,
        stress: input.stress,
        energy: input.energy,
        score: result.score,
        level: result.level,
        recommendation: result.recommendation,
      },
    });
    readinessByDate.set(k, result.score);
  }

  // --- riwayat sesi 5 minggu ---
  // state plan (berevolusi mengikuti aturan progression saat seed)
  const planState = new Map<string, { weight: number; pace: number | null }>();
  for (const p of PLAN) {
    planState.set(`${p.name}-${p.day}`, { weight: p.weight, pace: p.pace ?? null });
  }

  const titleByDay: Record<number, string> = {
    1: "Dada · Trisep",
    2: "Kardio — Lari",
    3: "Kaki · Hamstring",
    5: "Punggung · Bisep",
    6: "Kardio — Lari (Long Run)",
  };

  // iterasi kronologis: minggu 0 (terlama) -> minggu 4 (minggu ini)
  for (let week = 0; week < 5; week++) {
    for (const day of [1, 2, 3, 5, 6]) {
      const dateKey = addDays(thisMonday, (week - 4) * 7 + (day - 1));
      if (dateKey >= todayKey) continue; // hari ini & masa depan tidak di-seed

      const dayPlans = PLAN.filter((p) => p.day === day);
      const isCardioDay = dayPlans.every((p) => p.name === "Lari");
      const session = await db.workoutSession.create({
        data: {
          date: dayStart(dateKey),
          type: isCardioDay ? "CARDIO" : "STRENGTH",
          title: titleByDay[day] ?? "Latihan",
          status: "COMPLETED",
          readinessScore: readinessByDate.get(dateKey) ?? null,
          durationMin: isCardioDay ? 35 + (week % 3) : 52 + (week % 4),
        },
      });

      let volume = 0;
      for (const p of dayPlans) {
        const exId = exByName.get(p.name)!;
        const storyKey = day === 2 ? "LARI_TUE" : day === 6 ? "LARI_SAT" : p.name;
        const perf = HISTORY[storyKey][week];

        if (p.name === "Lari") {
          const dur = perf.dur!;
          await db.setLog.create({
            data: {
              sessionId: session.id,
              exerciseId: exId,
              setNumber: 1,
              weightKg: 0,
              reps: 0,
              distanceKm: p.dist!,
              durationSec: dur,
              createdAt: new Date(dayStart(dateKey).getTime() + 7 * 60000),
            },
          });
          // progression pace (aturan sama dengan engine)
          const state = planState.get(`Lari-${day}`)!;
          if (state.pace !== null) {
            const achievedPace = dur / p.dist!;
            const met = achievedPace <= state.pace + 5;
            if (met) state.pace = Math.max(240, state.pace - 5);
          }
          continue;
        }

        const reps = perf.r!;
        const weight = perf.w!;
        const allMax = reps.every((r) => r >= p.maxReps);
        const rpe = 7 + (allMax ? 1.5 : 0);
        for (let s = 0; s < reps.length; s++) {
          await db.setLog.create({
            data: {
              sessionId: session.id,
              exerciseId: exId,
              setNumber: s + 1,
              weightKg: weight,
              reps: reps[s],
              rpe: Math.round(rpe * 2) / 2,
              createdAt: new Date(dayStart(dateKey).getTime() + (10 + s * 6) * 60000),
            },
          });
          volume += weight * reps[s];
        }
        // progression beban (aturan sama dengan engine)
        const state = planState.get(`${p.name}-${day}`)!;
        if (allMax) {
          const inc = EXERCISES.find((e) => e.name === p.name)?.incrementKg ?? 2.5;
          state.weight = roundWeight(weight + inc);
        } else {
          state.weight = weight;
        }
      }

      await db.workoutSession.update({
        where: { id: session.id },
        data: { totalVolumeKg: Math.round(volume * 10) / 10 },
      });
    }
  }

  // --- sinkronkan state plan ---
  for (const p of PLAN) {
    const state = planState.get(`${p.name}-${p.day}`)!;
    const exId = exByName.get(p.name)!;
    await db.planItem.updateMany({
      where: { exerciseId: exId, dayOfWeek: p.day },
      data: {
        currentWeightKg: state.weight,
        ...(state.pace !== null ? { targetPaceSecPerKm: state.pace } : {}),
      },
    });
  }

  // --- PR, pesan plateau & welcome ---
  await backfillPRs();
  await ensurePlateauMessages();
  await ensureCrossTrainingMessage();
  await db.coachMessage.create({
    data: {
      type: "INFO",
      title: "Selamat datang di Rutina!",
      body: "Aku coach digitalmu. Setiap hari aku menyesuaikan targetmu berdasarkan performa, readiness, dan tren latihanmu. Mulai dari check-in kondisi tubuh, lalu jalankan sesi hari ini. Kalau butuh saran, buka tab Coach dan tanya apa saja!",
      severity: "info",
      date: dayStart(todayKey),
    },
  });
}
