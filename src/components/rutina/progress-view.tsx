"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  BatteryCharging,
  CheckCircle2,
  Dumbbell,
  Flame,
  HeartPulse,
  Loader2,
  TrendingUp,
  Trophy,
  Weight,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, SectionHeader, StatCard } from "@/components/rutina/shared";
import { formatDateLabel } from "@/lib/date";
import type { ProgressResponse } from "@/lib/types";
import { cn } from "@/lib/utils";

type WeeklyVolumeItem = ProgressResponse["weeklyVolume"][number];
type ExerciseProgress = ProgressResponse["exercises"][number];

/** "Sen, 28 Sep" -> "28 Sep" (label pendek untuk sumbu X) */
function shortLabel(label: string): string {
  const idx = label.indexOf(", ");
  return idx >= 0 ? label.slice(idx + 2) : label;
}

/** Format volume total: >= 1000 kg -> ton dengan koma desimal */
function formatTotalVolume(kg: number): { value: string; unit: string } {
  if (kg >= 1000) {
    return { value: (kg / 1000).toFixed(1).replace(".", ","), unit: "ton" };
  }
  return { value: String(kg), unit: "kg" };
}

// ---- Tooltip kustom: volume mingguan ----
function VolumeTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: WeeklyVolumeItem }[];
}) {
  if (!active || !payload?.length) return null;
  const item = payload[0].payload;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-popover-foreground shadow-md">
      <p className="text-xs font-bold">{item.weekLabel}</p>
      <p className="mt-1 text-xs">
        Volume: <span className="font-bold">{item.volume.toLocaleString("id-ID")}</span> kg
      </p>
      <p className="text-xs">Sesi: {item.sessions}</p>
      <p className="text-xs">Kardio: {item.cardioKm} km</p>
    </div>
  );
}

// ---- Tooltip kustom: tren e1RM ----
function E1RMTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: ExerciseProgress["history"][number] }[];
}) {
  if (!active || !payload?.length) return null;
  const item = payload[0].payload;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-popover-foreground shadow-md">
      <p className="text-xs font-bold">{item.dateLabel}</p>
      <p className="mt-1 text-xs">
        e1RM: <span className="font-bold">{item.e1RM}</span> kg
      </p>
    </div>
  );
}

export function ProgressView() {
  const queryClient = useQueryClient();
  const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery<ProgressResponse>({
    queryKey: ["progress"],
    queryFn: async () => {
      const res = await fetch("/api/progress");
      if (!res.ok) throw new Error("Gagal memuat data progres");
      return res.json();
    },
  });

  const deloadMutation = useMutation({
    mutationFn: async (accept: boolean) => {
      const res = await fetch("/api/deload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accept }),
      });
      if (!res.ok) throw new Error("Gagal mengatur deload");
    },
    onSuccess: async (_result, accept) => {
      toast.success(
        accept
          ? "Deload Week dimulai — intensitas 50%"
          : "Deload Week diakhiri — kembali latihan normal"
      );
      await queryClient.invalidateQueries({ queryKey: ["progress"] });
      await queryClient.invalidateQueries({ queryKey: ["plan"] });
    },
    onError: () => {
      toast.error("Gagal mengatur deload. Coba lagi sebentar.");
    },
  });

  if (isLoading) {
    return (
      <section className="flex flex-col gap-6" aria-busy="true" aria-label="Memuat progres">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-16 rounded-xl" />
        <Skeleton className="h-72 rounded-xl" />
        <Skeleton className="h-72 rounded-xl" />
      </section>
    );
  }

  if (isError || !data) {
    return (
      <section className="flex flex-col gap-6">
        <SectionHeader title="Progres" subtitle="Tren performa & adaptasi bebanmu" />
        <EmptyState
          icon={AlertTriangle}
          title="Gagal memuat progres"
          description="Terjadi kesalahan saat mengambil data. Coba muat ulang halaman."
        />
      </section>
    );
  }

  const { stats } = data;
  const volume = formatTotalVolume(stats.totalVolumeKg);
  const exercises = data.exercises;
  const selected =
    exercises.find((e) => e.id === selectedExerciseId) ?? exercises[0] ?? null;
  const selectedPlateau = selected
    ? data.plateaus.find((p) => p.exerciseId === selected.id)
    : undefined;

  const goalPct = Math.min(
    100,
    Math.round((stats.thisWeekSessions / Math.max(1, stats.weeklyGoal)) * 100)
  );
  const sisaSesi = Math.max(0, stats.weeklyGoal - stats.thisWeekSessions);

  return (
    <section className="flex flex-col gap-6">
      {/* ===== Header ===== */}
      <SectionHeader title="Progres" subtitle="Tren performa & adaptasi bebanmu" />

      {/* ===== Statistik utama ===== */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Total Sesi" value={stats.totalSessions} icon={Dumbbell} />
        <StatCard
          label="Total Volume"
          value={volume.value}
          unit={volume.unit}
          icon={Weight}
        />
        <StatCard
          label="Streak"
          value={stats.streakWeeks}
          unit="minggu"
          icon={Flame}
        />
        <StatCard
          label="Rata-rata Readiness 7h"
          value={stats.avgReadiness7d ?? "—"}
          unit={stats.avgReadiness7d != null ? "/100" : undefined}
          icon={HeartPulse}
        />
      </div>

      {/* ===== Target mingguan ===== */}
      <Card className="volt-edge gap-0 py-4">
        <CardContent className="px-4 sm:px-6">
          <div className="flex items-end justify-between gap-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Sesi minggu ini
            </p>
            <p className="font-display text-2xl font-extrabold stat-num">
              {stats.thisWeekSessions}
              <span className="text-muted-foreground">/{stats.weeklyGoal}</span>
            </p>
          </div>
          <Progress value={goalPct} className="mt-2 h-2.5" aria-label="Progres sesi mingguan" />
          <p className="mt-1.5 text-xs text-muted-foreground">
            {sisaSesi > 0
              ? `Sisa ${sisaSesi} sesi lagi untuk penuhi target minggu ini`
              : "Target mingguan tercapai. Kerja bagus!"}
          </p>
        </CardContent>
      </Card>

      {/* ===== Chart 1: Volume mingguan ===== */}
      <Card className="gap-0">
        <CardHeader className="px-4 pb-2 sm:px-6">
          <CardTitle className="flex items-center gap-2 font-display text-sm font-extrabold uppercase tracking-tight">
            <TrendingUp className="h-4 w-4 text-primary" />
            Volume Mingguan
          </CardTitle>
        </CardHeader>
        <CardContent className="px-2 pb-2 sm:px-4">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data.weeklyVolume} margin={{ top: 8, right: 4, left: -14, bottom: 0 }}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--muted-foreground)"
                strokeOpacity={0.1}
                vertical={false}
              />
              <XAxis
                dataKey="weekLabel"
                tickFormatter={(v: string) => shortLabel(v)}
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                tickLine={false}
                axisLine={false}
                dy={6}
              />
              <YAxis
                tickFormatter={(v: number) =>
                  v >= 1000 ? `${(v / 1000).toFixed(1).replace(".", ",")}k` : String(v)
                }
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                tickLine={false}
                axisLine={false}
                width={44}
              />
              <Tooltip
                content={<VolumeTooltip />}
                cursor={{ fill: "var(--muted)", opacity: 0.35 }}
              />
              <Bar dataKey="volume" fill="var(--chart-1)" radius={[4, 4, 0, 0]} maxBarSize={42} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* ===== Chart 2: Tren e1RM ===== */}
      <Card className="gap-0">
        <CardHeader className="px-4 pb-3 sm:px-6">
          <CardTitle className="flex items-center gap-2 font-display text-sm font-extrabold uppercase tracking-tight">
            <TrendingUp className="h-4 w-4 text-primary" />
            Tren e1RM
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 sm:px-6">
          {exercises.length === 0 || !selected ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Belum ada data latihan untuk ditampilkan.
            </p>
          ) : (
            <>
              {/* Pemilih latihan */}
              <div
                className="flex gap-2 overflow-x-auto pb-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                role="tablist"
                aria-label="Pilih latihan"
              >
                {exercises.map((ex) => {
                  const isSel = ex.id === selected.id;
                  return (
                    <button
                      key={ex.id}
                      type="button"
                      role="tab"
                      aria-selected={isSel}
                      onClick={() => setSelectedExerciseId(ex.id)}
                      className={cn(
                        "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition-colors",
                        isSel
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border/70 bg-muted/50 text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {ex.plateau ? (
                        <span
                          className="h-1.5 w-1.5 rounded-full bg-amber-400"
                          aria-label="Plateau"
                        />
                      ) : null}
                      {ex.name}
                    </button>
                  );
                })}
              </div>

              <ResponsiveContainer width="100%" height={240}>
                <LineChart
                  data={selected.history}
                  margin={{ top: 8, right: 10, left: -14, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="var(--muted-foreground)"
                    strokeOpacity={0.1}
                    vertical={false}
                  />
                  <XAxis
                    dataKey="dateLabel"
                    tickFormatter={(v: string) => shortLabel(v)}
                    tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                    tickLine={false}
                    axisLine={false}
                    dy={6}
                  />
                  <YAxis
                    domain={["auto", "auto"]}
                    tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    tickLine={false}
                    axisLine={false}
                    width={40}
                  />
                  <Tooltip content={<E1RMTooltip />} />
                  <Line
                    type="monotone"
                    dataKey="e1RM"
                    stroke="var(--chart-1)"
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: "var(--chart-1)", strokeWidth: 0 }}
                    activeDot={{
                      r: 5,
                      fill: "var(--chart-1)",
                      stroke: "var(--background)",
                      strokeWidth: 2,
                    }}
                  />
                </LineChart>
              </ResponsiveContainer>

              <div className="mt-3 flex flex-col gap-1">
                <p className="text-sm">
                  <span className="text-muted-foreground">e1RM saat ini: </span>
                  <span className="font-display font-extrabold stat-num">
                    {selected.currentE1RM ?? "—"} kg
                  </span>
                </p>
                {selected.plateau ? (
                  <p className="flex items-start gap-1.5 text-xs font-medium text-amber-400">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    {selectedPlateau?.detail ?? "e1RM stagnan pada beberapa sesi terakhir."}
                  </p>
                ) : null}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ===== Plateau & Deload ===== */}
      <SectionHeader
        title="Plateau & Deload"
        subtitle="Deteksi stagnasi & strategi pemulihan"
      />

      {data.deload.active ? (
        <Card className="border-amber-400/30 bg-amber-400/5 gap-0 py-4">
          <CardContent className="flex flex-col gap-3 px-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-400/15">
                <BatteryCharging className="h-5 w-5 text-amber-400" />
              </span>
              <div>
                <p className="font-display text-sm font-extrabold uppercase tracking-tight text-amber-400">
                  Deload Week aktif
                </p>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  Sisa {data.deload.daysLeft} hari (sampai{" "}
                  {data.deload.endDateKey ? formatDateLabel(data.deload.endDateKey) : "—"})
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              className="shrink-0"
              disabled={deloadMutation.isPending}
              onClick={() => deloadMutation.mutate(false)}
            >
              {deloadMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : null}
              Akhiri Deload
            </Button>
          </CardContent>
        </Card>
      ) : data.plateaus.length > 0 ? (
        <div className="flex flex-col gap-3">
          {data.plateaus.map((p) => (
            <Card key={p.exerciseId} className="gap-0 py-4">
              <CardContent className="flex flex-col gap-3 px-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-destructive/15">
                    <AlertTriangle className="h-5 w-5 text-destructive" />
                  </span>
                  <div>
                    <p className="font-display text-sm font-extrabold uppercase tracking-tight">
                      Plateau: {p.exerciseName}
                    </p>
                    <p className="mt-0.5 text-sm text-muted-foreground">{p.detail}</p>
                    <p className="mt-1 text-sm">
                      Bagaimana kalau Deload Week dengan intensitas 50%?
                    </p>
                  </div>
                </div>
                <Button
                  className="shrink-0"
                  disabled={deloadMutation.isPending}
                  onClick={() => deloadMutation.mutate(true)}
                >
                  {deloadMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : null}
                  Mulai Deload Week
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="gap-0 border-border/70 bg-card/60 py-4">
          <CardContent className="flex items-center gap-3 px-4 sm:px-6">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-primary" />
            <p className="text-sm text-muted-foreground">
              Tidak ada plateau — progresmu konsisten!
            </p>
          </CardContent>
        </Card>
      )}

      {/* ===== Personal Records ===== */}
      <SectionHeader
        title="Personal Records"
        subtitle="Rekor terbaikmu sepanjang waktu"
      />

      {data.prs.length === 0 ? (
        <EmptyState
          icon={Trophy}
          title="Belum ada PR"
          description="Selesaikan sesi latihan untuk mulai mengumpulkan personal records."
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.prs.map((pr) => (
            <Card key={pr.id} className="volt-edge gap-0 py-4">
              <CardContent className="px-4 sm:px-5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <Trophy className="h-4 w-4 shrink-0 text-primary" />
                    <p className="truncate font-display text-sm font-bold uppercase tracking-tight">
                      {pr.exerciseName}
                    </p>
                  </div>
                  <Badge variant="secondary" className="shrink-0 text-[10px]">
                    {pr.muscleGroup}
                  </Badge>
                </div>
                <p className="mt-2.5 font-display text-2xl font-extrabold stat-num">
                  {pr.weightKg}
                  <span className="ml-1 text-sm font-semibold text-muted-foreground">
                    kg × {pr.reps}
                  </span>
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  e1RM {pr.estimated1RM} kg
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">{pr.dateLabel}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}
