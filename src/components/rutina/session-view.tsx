"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  BatteryLow,
  CheckCircle2,
  Clock,
  Dumbbell,
  Info,
  Lightbulb,
  Loader2,
  Plus,
  Timer,
  Trash2,
  TriangleAlert,
  Trophy,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { RestTimer } from "@/components/rutina/rest-timer";
import { EmptyState } from "@/components/rutina/shared";
import { useRutinaStore } from "@/lib/store";
import { formatDuration, formatPace } from "@/lib/date";
import type {
  CoachMessageType,
  CompleteSessionResult,
  ExerciseType,
  PlanItemDTO,
  PlanResponse,
  SessionDTO,
  SetLogDTO,
} from "@/lib/types";

// ---------- Helpers ----------

/** Format angka beban: 40 -> "40", 37.5 -> "37.5" */
function fmtKg(n: number): string {
  return String(Math.round(n * 100) / 100);
}

/** Format volume dengan pemisah ribuan id-ID: 1125 -> "1.125" */
function fmtVolume(n: number): string {
  return Math.round(n).toLocaleString("id-ID");
}

/** Parse teks durasi "mm:ss" (atau "h:mm:ss" / angka polos = menit) ke detik. */
function parseMmSs(text: string): number | null {
  const t = text.trim();
  if (t === "") return null;
  if (/^\d+$/.test(t)) return parseInt(t, 10) * 60;
  const mm = t.match(/^(\d+):([0-5]?\d)$/);
  if (mm) return parseInt(mm[1], 10) * 60 + parseInt(mm[2], 10);
  const hh = t.match(/^(\d+):([0-5]?\d):([0-5]?\d)$/);
  if (hh) return parseInt(hh[1], 10) * 3600 + parseInt(hh[2], 10) * 60 + parseInt(hh[3], 10);
  return null;
}

async function readError(res: Response, fallback: string): Promise<Error> {
  const body: { error?: string } | null = await res.json().catch(() => null);
  return new Error(body?.error ?? fallback);
}

interface LogSetPayload {
  exerciseId: string;
  setNumber: number;
  weightKg?: number;
  reps?: number;
  rpe?: number;
  isWarmup?: boolean;
  distanceKm?: number;
  durationSec?: number;
}

interface LogSetResponse {
  set: SetLogDTO;
  sessionVolumeKg: number;
  setCount: number;
}

interface SessionExercise {
  exerciseId: string;
  name: string;
  type: ExerciseType;
  muscleGroup: string | null;
  tempo: string | null;
}

const PROGRESSION_ICONS: Record<CoachMessageType, { icon: LucideIcon; className: string }> = {
  CELEBRATION: { icon: Trophy, className: "text-primary" },
  WARNING: { icon: TriangleAlert, className: "text-amber-500" },
  SUGGESTION: { icon: Lightbulb, className: "text-primary" },
  DELOAD: { icon: BatteryLow, className: "text-amber-500" },
  INFO: { icon: Info, className: "text-muted-foreground" },
};

// ---------- Kartu satu latihan ----------

function ExerciseCard({
  sessionId,
  index,
  exercise,
  target,
  sets,
  onStartRest,
}: {
  sessionId: string;
  index: number;
  exercise: SessionExercise;
  target: PlanItemDTO | undefined;
  sets: SetLogDTO[];
  onStartRest: (seconds: number, exerciseName: string) => void;
}) {
  const queryClient = useQueryClient();
  const isStrength = exercise.type === "STRENGTH";
  const sortedSets = useMemo(
    () =>
      [...sets].sort(
        (a, b) => a.createdAt.localeCompare(b.createdAt) || a.setNumber - b.setNumber
      ),
    [sets]
  );
  const lastSet = sortedSets.length > 0 ? sortedSets[sortedSets.length - 1] : undefined;

  const [weight, setWeight] = useState(() =>
    String(target?.targetWeightKg ?? lastSet?.weightKg ?? "")
  );
  const [reps, setReps] = useState(() =>
    String(target?.targetMinReps ?? lastSet?.reps ?? "")
  );
  const [rpe, setRpe] = useState("");
  const [warmup, setWarmup] = useState(false);
  const [distance, setDistance] = useState(() => {
    const v = target?.targetDistanceKm ?? lastSet?.distanceKm ?? null;
    return v === null ? "" : String(v);
  });
  const [duration, setDuration] = useState(() => {
    if (target?.targetPaceSecPerKm != null && target?.targetDistanceKm != null) {
      return formatDuration(Math.round(target.targetPaceSecPerKm * target.targetDistanceKm));
    }
    if (lastSet?.durationSec != null) return formatDuration(lastSet.durationSec);
    return "";
  });

  const logMutation = useMutation({
    mutationFn: async (payload: LogSetPayload): Promise<LogSetResponse> => {
      const res = await fetch(`/api/sessions/${sessionId}/sets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw await readError(res, "Gagal menyimpan set");
      return res.json();
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["session", sessionId] });
      setWarmup(false);
      if (isStrength && target?.restSeconds && target.restSeconds > 0) {
        onStartRest(target.restSeconds, exercise.name);
      }
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (setId: string): Promise<{ ok: boolean; sessionVolumeKg: number }> => {
      const res = await fetch(`/api/sessions/${sessionId}/sets?setId=${setId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw await readError(res, "Gagal menghapus set");
      return res.json();
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["session", sessionId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  function handleLogStrength() {
    const w = Number(weight);
    const r = Number(reps);
    if (!Number.isFinite(w) || w <= 0 || !Number.isFinite(r) || r <= 0) {
      toast.error("Isi beban (kg) dan repetisi dulu — nilainya harus lebih dari 0");
      return;
    }
    logMutation.mutate({
      exerciseId: exercise.exerciseId,
      setNumber: sortedSets.length + 1,
      weightKg: w,
      reps: Math.round(r),
      rpe: rpe ? Number(rpe) : undefined,
      isWarmup: warmup,
    });
  }

  function handleLogCardio() {
    const km = Number(distance);
    const sec = parseMmSs(duration);
    if (!Number.isFinite(km) || km <= 0 || sec === null || sec <= 0) {
      toast.error("Isi jarak (km) dan durasi (format mm:ss) dulu");
      return;
    }
    logMutation.mutate({
      exerciseId: exercise.exerciseId,
      setNumber: sortedSets.length + 1,
      distanceKm: km,
      durationSec: sec,
    });
  }

  const targetChip =
    target != null
      ? exercise.type === "CARDIO" && target.targetDistanceKm != null && target.targetPaceSecPerKm != null
        ? `Target ${target.targetDistanceKm.toFixed(1)} km @ ${formatPace(target.targetPaceSecPerKm)}/km`
        : `Target ${target.targetSets}×${target.targetMinReps}–${target.targetMaxReps} @ ${fmtKg(target.targetWeightKg)} kg`
      : null;

  const previewSec = parseMmSs(duration);
  const previewKm = Number(distance);
  const pacePreview =
    previewSec !== null && previewSec > 0 && Number.isFinite(previewKm) && previewKm > 0
      ? `${formatPace(previewSec / previewKm)}/km`
      : "—";

  return (
    <article className="rounded-xl border border-border/70 bg-card p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary font-display text-sm font-extrabold text-primary-foreground stat-num"
          aria-hidden="true"
        >
          {index}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h3 className="font-display text-base font-extrabold uppercase tracking-tight sm:text-lg">
              {exercise.name}
            </h3>
            {exercise.muscleGroup ? (
              <Badge variant="outline" className="text-[10px] font-semibold uppercase tracking-wide">
                {exercise.muscleGroup}
              </Badge>
            ) : null}
          </div>
          {targetChip || exercise.tempo ? (
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              {targetChip ? (
                <span className="inline-flex items-center rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-bold stat-num text-primary">
                  {targetChip}
                </span>
              ) : null}
              {exercise.tempo ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                  <Timer className="h-3 w-3" />
                  Tempo {exercise.tempo}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      <div
        className="mt-3 flex flex-col gap-1.5"
        aria-label={`Set tercatat untuk ${exercise.name}`}
      >
        {sortedSets.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border/70 px-3 py-2.5 text-xs text-muted-foreground">
            Belum ada set tercatat.
          </p>
        ) : (
          sortedSets.map((s, i) => (
            <motion.div
              key={s.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2"
            >
              <span className="w-[4.25rem] shrink-0 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                {s.isWarmup ? "Pemanasan" : `Set ${s.setNumber}`}
              </span>
              <span className="min-w-0 flex-1 text-sm font-semibold stat-num">
                {s.exerciseType === "CARDIO" && s.distanceKm != null && s.durationSec != null
                  ? `${s.distanceKm.toFixed(1)} km · ${formatDuration(s.durationSec)} (${formatPace(
                      s.durationSec / s.distanceKm
                    )}/km)`
                  : `${fmtKg(s.weightKg)} kg × ${s.reps}`}
              </span>
              {s.rpe != null ? (
                <span className="shrink-0 text-[11px] font-medium text-muted-foreground">
                  RPE {s.rpe}
                </span>
              ) : null}
              {i === sortedSets.length - 1 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-11 w-11 shrink-0 text-muted-foreground hover:text-destructive"
                  aria-label={`Hapus set terakhir ${exercise.name}`}
                  disabled={deleteMutation.isPending}
                  onClick={() => deleteMutation.mutate(s.id)}
                >
                  {deleteMutation.isPending && deleteMutation.variables === s.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </Button>
              ) : null}
            </motion.div>
          ))
        )}
      </div>

      {isStrength ? (
        <>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            <div>
              <Label
                htmlFor={`weight-${exercise.exerciseId}`}
                className="text-xs text-muted-foreground"
              >
                Beban (kg)
              </Label>
              <Input
                id={`weight-${exercise.exerciseId}`}
                className="mt-1 h-11 stat-num"
                type="number"
                inputMode="decimal"
                step={0.25}
                min={0}
                placeholder="0"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
              />
            </div>
            <div>
              <Label
                htmlFor={`reps-${exercise.exerciseId}`}
                className="text-xs text-muted-foreground"
              >
                Reps
              </Label>
              <Input
                id={`reps-${exercise.exerciseId}`}
                className="mt-1 h-11 stat-num"
                type="number"
                inputMode="numeric"
                step={1}
                min={0}
                placeholder="0"
                value={reps}
                onChange={(e) => setReps(e.target.value)}
              />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <Label
                htmlFor={`rpe-${exercise.exerciseId}`}
                className="text-xs text-muted-foreground"
              >
                RPE
              </Label>
              <Select value={rpe} onValueChange={setRpe}>
                <SelectTrigger
                  id={`rpe-${exercise.exerciseId}`}
                  className="mt-1 h-11 w-full"
                  aria-label="RPE (opsional)"
                >
                  <SelectValue placeholder="RPE (ops.)" />
                </SelectTrigger>
                <SelectContent>
                  {[6, 7, 8, 9, 10].map((v) => (
                    <SelectItem key={v} value={String(v)}>
                      RPE {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <div className="flex h-11 items-center gap-2">
              <Checkbox
                id={`warmup-${exercise.exerciseId}`}
                checked={warmup}
                onCheckedChange={(v) => setWarmup(v === true)}
              />
              <Label
                htmlFor={`warmup-${exercise.exerciseId}`}
                className="cursor-pointer text-sm text-muted-foreground"
              >
                Pemanasan
              </Label>
            </div>
            <Button
              type="button"
              className="ml-auto h-11 min-w-44 flex-1 font-semibold sm:flex-none"
              disabled={logMutation.isPending}
              onClick={handleLogStrength}
            >
              {logMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Catat Set
            </Button>
          </div>
        </>
      ) : (
        <>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div>
              <Label
                htmlFor={`dist-${exercise.exerciseId}`}
                className="text-xs text-muted-foreground"
              >
                Jarak (km)
              </Label>
              <Input
                id={`dist-${exercise.exerciseId}`}
                className="mt-1 h-11 stat-num"
                type="number"
                inputMode="decimal"
                step={0.1}
                min={0}
                placeholder="0.0"
                value={distance}
                onChange={(e) => setDistance(e.target.value)}
              />
            </div>
            <div>
              <Label
                htmlFor={`dur-${exercise.exerciseId}`}
                className="text-xs text-muted-foreground"
              >
                Durasi (mm:ss)
              </Label>
              <Input
                id={`dur-${exercise.exerciseId}`}
                className="mt-1 h-11 stat-num"
                type="text"
                inputMode="numeric"
                placeholder="29:41"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
              />
            </div>
          </div>
          <div className="mt-2 flex items-center justify-between gap-3">
            <p className="text-sm font-semibold stat-num text-primary" aria-live="polite">
              Pace: {pacePreview}
            </p>
            <Button
              type="button"
              className="h-11 min-w-44 font-semibold"
              disabled={logMutation.isPending}
              onClick={handleLogCardio}
            >
              {logMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Catat
            </Button>
          </div>
        </>
      )}
    </article>
  );
}

// ---------- Layar hasil sesi selesai ----------

function ResultScreen({
  result,
  onBack,
}: {
  result: CompleteSessionResult;
  onBack: () => void;
}) {
  const newPrs = result.prs.filter((p) => p.isNew);
  const setCount = result.session.sets.length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto flex max-w-xl flex-col items-center py-6 text-center sm:py-10"
    >
      <motion.div
        initial={{ scale: 0, rotate: -12 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 18, delay: 0.15 }}
        className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/15"
      >
        <Trophy className="h-10 w-10 text-primary" />
      </motion.div>
      <h2 className="mt-5 font-display text-3xl font-black uppercase tracking-tight">
        Kerja Bagus!
      </h2>
      <p className="mt-1.5 text-sm text-muted-foreground">
        {result.session.title} selesai
        {result.session.durationMin != null ? ` · ${result.session.durationMin} menit` : ""}
      </p>

      <div className="mt-6 grid w-full grid-cols-3 gap-2 sm:gap-3">
        <div className="rounded-xl border border-border/70 bg-card p-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Volume
          </p>
          <p className="mt-1 font-display text-xl font-extrabold stat-num">
            {fmtVolume(result.volumeKg)}
            <span className="ml-1 text-xs font-semibold text-muted-foreground">kg</span>
          </p>
        </div>
        <div className="rounded-xl border border-border/70 bg-card p-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Set
          </p>
          <p className="mt-1 font-display text-xl font-extrabold stat-num">{setCount}</p>
        </div>
        <div className="rounded-xl border border-border/70 bg-card p-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Durasi
          </p>
          <p className="mt-1 font-display text-xl font-extrabold stat-num">
            {result.session.durationMin ?? "—"}
            <span className="ml-1 text-xs font-semibold text-muted-foreground">mnt</span>
          </p>
        </div>
      </div>

      {newPrs.length > 0 ? (
        <div className="mt-6 w-full text-left">
          <p className="font-display text-sm font-extrabold uppercase tracking-wide text-primary">
            PR Baru
          </p>
          <ul className="mt-2 flex flex-col gap-2">
            {newPrs.map((pr, i) => (
              <motion.li
                key={`${pr.exerciseName}-${i}`}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 + i * 0.08 }}
                className="flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/10 p-3"
              >
                <Trophy className="h-5 w-5 shrink-0 text-primary" />
                <div className="min-w-0">
                  <p className="font-display text-sm font-bold">{pr.exerciseName}</p>
                  <p className="text-xs stat-num text-muted-foreground">
                    {fmtKg(pr.weightKg)} kg × {pr.reps} · e1RM {fmtKg(pr.estimated1RM)} kg
                  </p>
                </div>
              </motion.li>
            ))}
          </ul>
        </div>
      ) : null}

      {result.progressions.length > 0 ? (
        <div className="mt-4 w-full text-left">
          <p className="font-display text-sm font-extrabold uppercase tracking-wide">
            Catatan Coach
          </p>
          <ul className="mt-2 flex flex-col gap-2">
            {result.progressions.map((p, i) => {
              const config = PROGRESSION_ICONS[p.type] ?? PROGRESSION_ICONS.INFO;
              const Icon = config.icon;
              return (
                <li
                  key={`${p.exerciseName}-${i}`}
                  className="flex items-start gap-3 rounded-xl border border-border/70 bg-card p-3"
                >
                  <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${config.className}`} />
                  <div className="min-w-0">
                    <p className="font-display text-sm font-bold">{p.exerciseName}</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                      {p.note}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      <Button
        type="button"
        size="lg"
        className="mt-8 h-12 w-full max-w-xs font-display text-sm font-extrabold uppercase tracking-wide"
        onClick={onBack}
      >
        Kembali ke Beranda
      </Button>
    </motion.div>
  );
}

// ---------- Overlay sesi full-screen ----------

export function SessionView() {
  const activeSessionId = useRutinaStore((s) => s.activeSessionId);
  const endSession = useRutinaStore((s) => s.endSession);
  const queryClient = useQueryClient();

  const [elapsedSec, setElapsedSec] = useState(0);
  const [exitOpen, setExitOpen] = useState(false);
  const [exitBusy, setExitBusy] = useState(false);
  const [finishOpen, setFinishOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [result, setResult] = useState<CompleteSessionResult | null>(null);
  const [rest, setRest] = useState<{
    key: number;
    seconds: number;
    exerciseName: string;
  } | null>(null);

  const sessionId = activeSessionId;

  // Timer durasi sesi — mulai menghitung saat overlay dibuka.
  useEffect(() => {
    const start = Date.now();
    const timer = window.setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - start) / 1000));
    }, 500);
    return () => window.clearInterval(timer);
  }, []);

  const sessionQuery = useQuery<SessionDTO>({
    queryKey: ["session", sessionId],
    enabled: sessionId != null,
    queryFn: async (): Promise<SessionDTO> => {
      const res = await fetch(`/api/sessions/${sessionId}`);
      if (!res.ok) throw await readError(res, "Gagal memuat sesi");
      return res.json();
    },
  });

  // Target latihan diambil dari cache/query ["plan"] (key sama dengan page.tsx).
  const planQuery = useQuery<PlanResponse>({
    queryKey: ["plan"],
    queryFn: async (): Promise<PlanResponse> => {
      const res = await fetch("/api/plan");
      if (!res.ok) throw new Error("Gagal memuat rencana");
      return res.json();
    },
  });

  const finishMutation = useMutation({
    mutationFn: async (): Promise<CompleteSessionResult> => {
      const res = await fetch(`/api/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          complete: true,
          notes: notes.trim() === "" ? undefined : notes.trim(),
          durationMin: Math.max(1, Math.round(elapsedSec / 60)),
        }),
      });
      if (!res.ok) throw await readError(res, "Gagal menyelesaikan sesi");
      return res.json();
    },
    onSuccess: (completeResult) => {
      setFinishOpen(false);
      setRest(null);
      setResult(completeResult);
    },
    onError: (error: Error) => {
      setFinishOpen(false);
      toast.error(error.message);
    },
  });

  const session = sessionQuery.data;
  const plan = planQuery.data;
  const setsCount = session?.sets.length ?? 0;

  const cards = useMemo(() => {
    if (!session) return [];
    const targetByExercise = new Map<string, PlanItemDTO | undefined>();
    const resultCards: {
      key: string;
      exercise: SessionExercise;
      target: PlanItemDTO | undefined;
      sets: SetLogDTO[];
    }[] = [];
    for (const item of plan?.items ?? []) {
      targetByExercise.set(item.exercise.id, item);
      resultCards.push({
        key: item.id,
        exercise: {
          exerciseId: item.exercise.id,
          name: item.exercise.name,
          type: item.exercise.type,
          muscleGroup: item.exercise.muscleGroup,
          tempo: item.exercise.tempo,
        },
        target: item,
        sets: session.sets.filter((s) => s.exerciseId === item.exercise.id),
      });
    }
    for (const s of session.sets) {
      if (!targetByExercise.has(s.exerciseId)) {
        targetByExercise.set(s.exerciseId, undefined);
        resultCards.push({
          key: `extra-${s.exerciseId}`,
          exercise: {
            exerciseId: s.exerciseId,
            name: s.exerciseName,
            type: s.exerciseType,
            muscleGroup: null,
            tempo: null,
          },
          target: undefined,
          sets: session.sets.filter((x) => x.exerciseId === s.exerciseId),
        });
      }
    }
    return resultCards.map((c, i) => ({ ...c, index: i + 1 }));
  }, [plan, session]);

  if (sessionId == null) {
    return null;
  }

  function handleStartRest(seconds: number, exerciseName: string) {
    setRest({ key: Date.now(), seconds, exerciseName });
  }

  function handleReturnHome() {
    for (const key of ["plan", "session", "progress", "history", "alerts"]) {
      void queryClient.invalidateQueries({ queryKey: [key] });
    }
    endSession();
    toast.success("Sesi selesai — target berikutnya sudah disesuaikan coach!");
  }

  /** Keluar tanpa set tersimpan: hapus sesi kosong lalu tutup overlay. */
  async function handleExitNoSets() {
    setExitBusy(true);
    try {
      const res = await fetch(`/api/sessions/${sessionId}`, { method: "DELETE" });
      if (!res.ok) throw await readError(res, "Gagal menghapus sesi");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menghapus sesi");
    } finally {
      setExitBusy(false);
      setExitOpen(false);
      endSession();
      void queryClient.invalidateQueries({ queryKey: ["plan"] });
    }
  }

  function handleHeaderClose() {
    if (result) {
      handleReturnHome();
      return;
    }
    if (!session) {
      endSession();
      return;
    }
    if (session.sets.length > 0) {
      setRest(null);
      setExitOpen(true);
      return;
    }
    void handleExitNoSets();
  }

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-background"
      role="dialog"
      aria-modal="true"
      aria-label="Mode sesi latihan"
    >
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/75">
        <div className="mx-auto flex w-full max-w-3xl items-center gap-2 px-4 py-2.5 sm:py-3">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-11 w-11 shrink-0"
            aria-label="Keluar dari sesi latihan"
            onClick={handleHeaderClose}
          >
            <X className="h-5 w-5" />
          </Button>
          <div className="min-w-0 flex-1">
            <h2 className="truncate font-display text-base font-extrabold uppercase tracking-tight sm:text-lg">
              {session?.title ?? "Sesi Latihan"}
            </h2>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
              <span className="flex items-center gap-1 font-mono stat-num text-primary">
                <Clock className="h-3.5 w-3.5" />
                {formatDuration(elapsedSec)}
              </span>
              <span className="flex items-center gap-1 stat-num">
                <Dumbbell className="h-3.5 w-3.5" />
                {fmtVolume(session?.totalVolumeKg ?? 0)} kg
              </span>
              <span className="stat-num">{setsCount} set</span>
            </div>
          </div>
          {!result ? (
            <Button
              type="button"
              className="h-11 shrink-0 px-4 font-display text-xs font-extrabold uppercase tracking-wide sm:px-5 sm:text-sm"
              onClick={() => {
                setRest(null);
                setFinishOpen(true);
              }}
              disabled={finishMutation.isPending}
            >
              Selesaikan
            </Button>
          ) : null}
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-4 pb-32 pt-4 sm:pt-6">
        {result ? (
          <ResultScreen result={result} onBack={handleReturnHome} />
        ) : sessionQuery.isLoading ? (
          <div className="flex flex-col gap-4" aria-busy="true" aria-label="Memuat sesi">
            <Skeleton className="h-48 rounded-xl" />
            <Skeleton className="h-48 rounded-xl" />
            <Skeleton className="h-48 rounded-xl" />
          </div>
        ) : sessionQuery.isError || !session ? (
          <EmptyState
            icon={TriangleAlert}
            title="Sesi tidak dapat dimuat"
            description="Terjadi kesalahan saat memuat sesi. Coba buka kembali dari beranda."
            action={
              <Button type="button" variant="outline" className="h-11" onClick={() => endSession()}>
                Tutup
              </Button>
            }
          />
        ) : (
          <div className="flex flex-col gap-4">
            {cards.map((card) => (
              <ExerciseCard
                key={card.key}
                sessionId={sessionId}
                index={card.index}
                exercise={card.exercise}
                target={card.target}
                sets={card.sets}
                onStartRest={handleStartRest}
              />
            ))}
            {cards.length === 0 ? (
              <EmptyState
                icon={Dumbbell}
                title="Belum ada latihan"
                description="Rencana hari ini tidak memiliki item latihan yang bisa dicatat."
              />
            ) : null}
          </div>
        )}
      </main>

      {rest ? (
        <RestTimer
          key={rest.key}
          seconds={rest.seconds}
          exerciseName={rest.exerciseName}
          onDone={() => setRest(null)}
        />
      ) : null}

      {/* Dialog konfirmasi keluar (ada set tersimpan) */}
      <AlertDialog open={exitOpen} onOpenChange={setExitOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display uppercase tracking-tight">
              Keluar dari sesi?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Progres set yang sudah dicatat tetap tersimpan. Kamu bisa melanjutkan sesi ini
              kapan saja dari beranda.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-11">Lanjut Latihan</AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              className="h-11 font-semibold"
              disabled={exitBusy}
              onClick={() => {
                setExitOpen(false);
                endSession();
              }}
            >
              Keluar
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog selesaikan sesi */}
      <AlertDialog open={finishOpen} onOpenChange={setFinishOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display uppercase tracking-tight">
              Selesaikan Sesi?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Durasi: {Math.max(1, Math.round(elapsedSec / 60))} menit · {setsCount} set ·
              Volume {fmtVolume(session?.totalVolumeKg ?? 0)} kg
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div>
            <Label htmlFor="session-notes" className="text-sm font-semibold">
              Catatan (opsional)
            </Label>
            <Textarea
              id="session-notes"
              className="mt-1.5"
              rows={3}
              placeholder="Mis. bench terasa berat di set terakhir…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-11">Batal</AlertDialogCancel>
            <Button
              type="button"
              className="h-11 font-semibold"
              disabled={finishMutation.isPending}
              onClick={() => finishMutation.mutate()}
            >
              {finishMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              Selesaikan Sesi
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
