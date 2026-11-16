"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Activity,
  BatteryCharging,
  BedDouble,
  CheckCircle2,
  Flame,
  Footprints,
  Hourglass,
  Loader2,
  Moon,
  PersonStanding,
  Play,
  Plus,
  Target,
  Timer,
  TrendingUp,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { CoachAlerts } from "@/components/rutina/coach-alerts";
import { ReadinessCard } from "@/components/rutina/readiness-card";
import { EmptyState, SectionHeader } from "@/components/rutina/shared";
import { useRutinaStore } from "@/lib/store";
import { formatLongDateLabel, formatPace } from "@/lib/date";
import type { PlanItemDTO, PlanResponse, SessionDTO, SessionType } from "@/lib/types";

// ---------- Helpers ----------

/** Jam saat ini dalam WIB (timezone aplikasi). */
function wibHourNow(): number {
  try {
    const formatted = new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      hourCycle: "h23",
      timeZone: "Asia/Jakarta",
    }).format(new Date());
    const hour = Number(formatted);
    return Number.isFinite(hour) ? hour : new Date().getHours();
  } catch {
    return new Date().getHours();
  }
}

function greetingText(): string {
  const h = wibHourNow();
  if (h >= 4 && h < 11) return "Selamat pagi";
  if (h < 15) return "Selamat siang";
  if (h < 19) return "Selamat sore";
  return "Selamat malam";
}

function fmtKg(n: number): string {
  return String(Math.round(n * 100) / 100);
}

function fmtVolume(n: number): string {
  return Math.round(n).toLocaleString("id-ID");
}

// ---------- Skeleton ----------

function TodaySkeleton() {
  return (
    <div className="flex flex-col gap-4 sm:gap-6" aria-busy="true" aria-label="Memuat rencana">
      <Skeleton className="h-52 rounded-xl" />
      <Skeleton className="h-44 rounded-xl" />
      <Skeleton className="h-24 rounded-xl" />
      <Skeleton className="h-28 rounded-xl" />
      <Skeleton className="h-28 rounded-xl" />
    </div>
  );
}

// ---------- Kartu item rencana ----------

function PlanItemCard({ item, index }: { item: PlanItemDTO; index: number }) {
  const isCardio =
    item.exercise.type === "CARDIO" &&
    item.targetDistanceKm != null &&
    item.targetPaceSecPerKm != null;

  const targetLine = isCardio
    ? `${item.targetDistanceKm?.toFixed(1)} km @ pace ${formatPace(
        item.targetPaceSecPerKm ?? 0
      )}/km`
    : `${item.targetSets}×${item.targetMinReps}–${item.targetMaxReps} @ ${fmtKg(
        item.targetWeightKg
      )} kg`;

  return (
    <motion.article
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.05, 0.3) }}
      className="volt-edge rounded-xl border border-border/70 bg-card p-4 pl-5 sm:p-5 sm:pl-6"
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
        <h3 className="font-display text-base font-extrabold uppercase tracking-tight sm:text-lg">
          {item.exercise.name}
        </h3>
        <Badge
          variant="outline"
          className="text-[10px] font-semibold uppercase tracking-wide"
        >
          {item.exercise.muscleGroup}
        </Badge>
        {item.exercise.equipment ? (
          <span className="text-[11px] text-muted-foreground">{item.exercise.equipment}</span>
        ) : null}
      </div>

      <div className="mt-3">
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          Target
        </span>
        <p className="font-display text-lg font-extrabold stat-num sm:text-xl">
          {targetLine}
        </p>
      </div>

      {item.progressionNote ? (
        <p className="mt-2 flex items-start gap-1.5 text-xs font-medium text-primary">
          <TrendingUp className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {item.progressionNote}
        </p>
      ) : null}

      {item.lastPerformance ? (
        <p className="mt-1 text-xs text-muted-foreground">
          Terakhir {item.lastPerformance.dateLabel}: {item.lastPerformance.summary}
        </p>
      ) : null}

      {item.adjusted && item.adjustmentNote ? (
        <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-400">
          <TriangleAlert className="h-3 w-3" />
          {item.adjustmentNote}
        </span>
      ) : null}

      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        {item.exercise.tempo ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
            <Timer className="h-3 w-3" />
            Tempo {item.exercise.tempo}
          </span>
        ) : null}
        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
          <Hourglass className="h-3 w-3" />
          Istirahat {item.restSeconds}s
        </span>
      </div>

      {item.exercise.cue ? (
        <p className="mt-2 text-xs italic leading-relaxed text-muted-foreground">
          {item.exercise.cue}
        </p>
      ) : null}
    </motion.article>
  );
}

// ---------- View utama "Hari Ini" ----------

export function TodayView() {
  const queryClient = useQueryClient();
  const startSession = useRutinaStore((s) => s.startSession);

  const planQuery = useQuery<PlanResponse>({
    queryKey: ["plan"],
    queryFn: async (): Promise<PlanResponse> => {
      const res = await fetch("/api/plan");
      if (!res.ok) {
        const body: { error?: string } | null = await res.json().catch(() => null);
        throw new Error(body?.error ?? "Gagal memuat rencana");
      }
      return res.json();
    },
  });

  const startSessionMutation = useMutation({
    mutationFn: async (): Promise<SessionDTO> => {
      const plan = planQuery.data;
      if (!plan) throw new Error("Rencana belum siap — coba lagi");
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: plan.sessionTitle,
          type: plan.sessionType,
          readinessScore: plan.readiness.done ? plan.readiness.score : undefined,
        }),
      });
      if (!res.ok) {
        const body: { error?: string } | null = await res.json().catch(() => null);
        throw new Error(body?.error ?? "Gagal memulai sesi");
      }
      return res.json();
    },
    onSuccess: (session) => {
      void queryClient.invalidateQueries({ queryKey: ["plan"] });
      useRutinaStore.getState().startSession(session.id);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  if (planQuery.isLoading) {
    return <TodaySkeleton />;
  }

  if (planQuery.isError || !planQuery.data) {
    return (
      <EmptyState
        icon={TriangleAlert}
        title="Gagal Memuat Rencana"
        description="Terjadi kesalahan saat memuat rencana latihan. Periksa koneksi lalu coba lagi."
        action={
          <Button
            type="button"
            variant="outline"
            className="h-11"
            onClick={() => void planQuery.refetch()}
          >
            Coba Lagi
          </Button>
        }
      />
    );
  }

  const plan = planQuery.data;
  const completedSessions = plan.todaySessions.filter((s) => s.status === "COMPLETED");
  const inProgressSession = plan.todaySessions.find((s) => s.status === "IN_PROGRESS");
  const completedVolume = completedSessions.reduce((a, s) => a + s.totalVolumeKg, 0);
  const completedSets = completedSessions.reduce((a, s) => a + s.setCount, 0);
  const weekFraction = plan.streak.weeklyGoal > 0
    ? Math.min(100, (plan.streak.thisWeekSessions / plan.streak.weeklyGoal) * 100)
    : 0;

  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      {/* ===== HERO ===== */}
      <section
        aria-label="Ringkasan hari ini"
        className="relative overflow-hidden rounded-xl border border-border/70 bg-card bg-volt-grid p-5 sm:p-6"
      >
        <p className="text-xs font-bold uppercase tracking-widest text-primary">
          {greetingText()}
        </p>
        <h1 className="mt-1.5 font-display text-2xl font-black uppercase leading-tight tracking-tight sm:text-4xl">
          {plan.sessionTitle}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {formatLongDateLabel(plan.dateKey)}
        </p>

        <div className="mt-5 grid grid-cols-3 gap-2 sm:gap-3">
          <div className="rounded-lg border border-border/50 bg-card/70 p-3">
            <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
              <Flame className="h-3.5 w-3.5 text-primary" />
              Streak
            </div>
            <p className="mt-1 font-display text-lg font-extrabold stat-num sm:text-2xl">
              {plan.streak.weeks}
              <span className="ml-1 text-[11px] font-semibold text-muted-foreground">
                minggu
              </span>
            </p>
          </div>

          <div className="rounded-lg border border-border/50 bg-card/70 p-3">
            <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
              <Target className="h-3.5 w-3.5 text-primary" />
              Sesi Minggu Ini
            </div>
            <p className="mt-1 font-display text-lg font-extrabold stat-num sm:text-2xl">
              {plan.streak.thisWeekSessions}
              <span className="text-muted-foreground">/{plan.streak.weeklyGoal}</span>
            </p>
            <Progress
              className="mt-2 h-1.5"
              value={weekFraction}
              aria-label={`Progres sesi minggu ini ${plan.streak.thisWeekSessions} dari ${plan.streak.weeklyGoal}`}
            />
          </div>

          <div className="rounded-lg border border-border/50 bg-card/70 p-3">
            <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
              <Activity className="h-3.5 w-3.5 text-primary" />
              Latihan Hari Ini
            </div>
            <p className="mt-1 font-display text-lg font-extrabold stat-num sm:text-2xl">
              {plan.items.length}
              <span className="ml-1 text-[11px] font-semibold text-muted-foreground">
                gerakan
              </span>
            </p>
          </div>
        </div>
      </section>

      {/* ===== Banner deload ===== */}
      {plan.deload.active ? (
        <div
          className="flex items-center gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4"
          role="status"
        >
          <BatteryCharging className="h-5 w-5 shrink-0 text-amber-500" />
          <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">
            Deload Week aktif — intensitas 50% · sisa {plan.deload.daysLeft} hari
          </p>
        </div>
      ) : null}

      {/* ===== Check-in readiness ===== */}
      <ReadinessCard readiness={plan.readiness} />

      {/* ===== Pesan coach ===== */}
      <CoachAlerts messages={plan.messages} unreadCount={plan.unreadCount} />

      {/* ===== Rencana hari ini ===== */}
      <section aria-label="Rencana hari ini">
        <SectionHeader
          title="Rencana Hari Ini"
          subtitle={
            plan.isRestDay
              ? "Fokus pada pemulihan"
              : `${plan.items.length} latihan · ${plan.sessionTitle}`
          }
        />

        {plan.isRestDay ? (
          <div className="mt-3">
            <EmptyState
              icon={BedDouble}
              title="Hari Pemulihan"
              description="Tidak ada sesi latihan terjadwal hari ini. Biarkan tubuh beregenerasi."
            />
            <div className="mt-4 rounded-xl border border-border/70 bg-card p-4 sm:p-6">
              <p className="font-display text-sm font-extrabold uppercase tracking-wide">
                Saran Pemulihan
              </p>
              <ul className="mt-3 space-y-2.5">
                <li className="flex items-center gap-3 text-sm">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                    <Footprints className="h-4.5 w-4.5 text-muted-foreground" />
                  </span>
                  Jalan santai 20–30 menit
                </li>
                <li className="flex items-center gap-3 text-sm">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                    <PersonStanding className="h-4.5 w-4.5 text-muted-foreground" />
                  </span>
                  Stretching &amp; mobilitas 10 menit
                </li>
                <li className="flex items-center gap-3 text-sm">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                    <Moon className="h-4.5 w-4.5 text-muted-foreground" />
                  </span>
                  Tidur 7–8 jam malam ini
                </li>
              </ul>
              <p className="mt-3 text-xs text-muted-foreground">
                Check-in readiness tetap bisa dilakukan.
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="mt-3 flex flex-col gap-3 sm:gap-4">
              {plan.items.map((item, i) => (
                <PlanItemCard key={item.id} item={item} index={i} />
              ))}
            </div>

            {/* ===== CTA sesi ===== */}
            <section aria-label="Mulai latihan" className="mt-5 sm:mt-6">
              {completedSessions.length > 0 ? (
                <div className="flex flex-col items-start justify-between gap-3 rounded-xl border border-primary/30 bg-primary/10 p-4 sm:flex-row sm:items-center">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                    <div>
                      <p className="font-display text-sm font-extrabold uppercase tracking-tight">
                        Latihan hari ini selesai!
                      </p>
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        Volume {fmtVolume(completedVolume)} kg · {completedSets} set
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-11 shrink-0 px-4 text-sm font-semibold"
                    disabled={startSessionMutation.isPending}
                    onClick={() => startSessionMutation.mutate()}
                  >
                    {startSessionMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Plus className="h-4 w-4" />
                    )}
                    Mulai sesi tambahan
                  </Button>
                </div>
              ) : inProgressSession ? (
                <Button
                  type="button"
                  size="lg"
                  className="h-14 w-full font-display text-base font-extrabold uppercase tracking-wide"
                  onClick={() => startSession(inProgressSession.id)}
                >
                  <Play className="h-5 w-5" />
                  Lanjutkan Latihan
                </Button>
              ) : (
                <Button
                  type="button"
                  size="lg"
                  className="h-14 w-full font-display text-base font-extrabold uppercase tracking-wide sm:w-auto sm:min-w-72"
                  disabled={startSessionMutation.isPending}
                  onClick={() => startSessionMutation.mutate()}
                >
                  {startSessionMutation.isPending ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Play className="h-5 w-5" />
                  )}
                  Mulai Latihan
                </Button>
              )}
            </section>
          </>
        )}
      </section>
    </div>
  );
}
