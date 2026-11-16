"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  ChevronDown,
  ClipboardList,
  Dumbbell,
  Footprints,
  Leaf,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, SectionHeader } from "@/components/rutina/shared";
import { formatDuration, formatPace } from "@/lib/date";
import type { ExerciseType, SessionDTO, SessionType, SetLogDTO } from "@/lib/types";
import { cn } from "@/lib/utils";

const SESSION_TYPE_META: Record<SessionType, { label: string; icon: LucideIcon }> = {
  STRENGTH: { label: "Angkat Beban", icon: Dumbbell },
  CARDIO: { label: "Kardio", icon: Footprints },
  RECOVERY: { label: "Recovery", icon: Leaf },
};

const STATUS_LABEL: Record<string, string> = {
  COMPLETED: "Selesai",
  IN_PROGRESS: "Berlangsung",
};

interface ExerciseGroup {
  name: string;
  type: ExerciseType;
  sets: SetLogDTO[];
}

/** Kelompokkan set per nama latihan, menjaga urutan kemunculan pertama. */
function groupSets(sets: SetLogDTO[]): ExerciseGroup[] {
  const groups: ExerciseGroup[] = [];
  const byName = new Map<string, ExerciseGroup>();
  for (const s of sets) {
    let g = byName.get(s.exerciseName);
    if (!g) {
      g = { name: s.exerciseName, type: s.exerciseType, sets: [] };
      byName.set(s.exerciseName, g);
      groups.push(g);
    }
    g.sets.push(s);
  }
  return groups;
}

function SetRow({ set, index, type }: { set: SetLogDTO; index: number; type: ExerciseType }) {
  const isCardio = type === "CARDIO";
  const km = set.distanceKm;
  const dur = set.durationSec;
  const pace = km != null && km > 0 && dur != null ? ` (${formatPace(dur / km)}/km)` : "";

  return (
    <li className="flex items-center justify-between gap-2 py-0.5">
      <span className="min-w-0 text-sm">
        {isCardio ? (
          <>
            Set {index + 1}:{" "}
            <span className="font-semibold stat-num">{km != null ? km : "—"}</span> km ·{" "}
            {dur != null ? formatDuration(dur) : "—"}
            {pace}
          </>
        ) : (
          <>
            Set {index + 1}:{" "}
            <span className="font-semibold stat-num">{set.weightKg}</span> kg × {set.reps}
          </>
        )}
      </span>
      <span className="flex shrink-0 items-center gap-1.5">
        {set.rpe != null ? (
          <span className="text-[11px] text-muted-foreground">RPE {set.rpe}</span>
        ) : null}
        {set.isWarmup ? (
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
            Pemanasan
          </span>
        ) : null}
      </span>
    </li>
  );
}

function SessionCard({ session }: { session: SessionDTO }) {
  const [open, setOpen] = useState(false);
  const groups = useMemo(() => groupSets(session.sets), [session.sets]);

  const meta = SESSION_TYPE_META[session.type] ?? SESSION_TYPE_META.STRENGTH;
  const TypeIcon = meta.icon;

  return (
    <Card className="volt-edge gap-0 py-4">
      <CardContent className="px-4 sm:px-5">
        {/* Baris judul */}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls={`detail-${session.id}`}
          className="flex w-full items-start justify-between gap-3 text-left"
        >
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {session.dateLabel}
            </p>
            <p className="mt-0.5 truncate font-display text-base font-extrabold uppercase tracking-tight">
              {session.title}
            </p>
          </div>
          <ChevronDown
            className={cn(
              "mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200",
              open && "rotate-180"
            )}
            aria-hidden="true"
          />
        </button>

        {/* Badge & statistik */}
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <Badge variant="secondary" className="gap-1 text-[10px] uppercase">
            <TypeIcon className="h-3 w-3" aria-hidden="true" />
            {meta.label}
          </Badge>
          <Badge variant="outline" className="text-[10px] uppercase">
            {STATUS_LABEL[session.status] ?? session.status}
          </Badge>
          {session.readinessScore != null ? (
            <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
              Readiness {session.readinessScore}
            </span>
          ) : null}
        </div>

        <div className="mt-2.5 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span>
            <span className="font-display text-sm font-extrabold stat-num text-foreground">
              {session.totalVolumeKg.toLocaleString("id-ID")}
            </span>{" "}
            kg volume
          </span>
          <span>
            <span className="font-display text-sm font-extrabold stat-num text-foreground">
              {session.sets.length}
            </span>{" "}
            set
          </span>
          {session.durationMin != null ? (
            <span>
              <span className="font-display text-sm font-extrabold stat-num text-foreground">
                {session.durationMin}
              </span>{" "}
              menit
            </span>
          ) : null}
        </div>

        {/* Detail set (expandable) */}
        <motion.div
          id={`detail-${session.id}`}
          initial={false}
          animate={{ height: open ? "auto" : 0, opacity: open ? 1 : 0 }}
          transition={{ duration: 0.22, ease: "easeInOut" }}
          className="overflow-hidden"
          aria-hidden={!open}
        >
          <div className="mt-3 flex flex-col gap-3 rounded-lg border border-border/60 bg-muted/30 p-3">
            {groups.length === 0 ? (
              <p className="text-sm text-muted-foreground">Tidak ada set tercatat.</p>
            ) : (
              groups.map((g) => (
                <div key={g.name}>
                  <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                    {g.name}
                  </p>
                  <ul className="mt-1 flex flex-col">
                    {g.sets.map((s, i) => (
                      <SetRow key={s.id} set={s} index={i} type={g.type} />
                    ))}
                  </ul>
                </div>
              ))
            )}
            {session.notes ? (
              <p className="border-t border-border/60 pt-2 text-xs italic text-muted-foreground">
                &ldquo;{session.notes}&rdquo;
              </p>
            ) : null}
          </div>
        </motion.div>
      </CardContent>
    </Card>
  );
}

export function HistoryView() {
  const { data, isLoading, isError } = useQuery<SessionDTO[]>({
    queryKey: ["history"],
    queryFn: async () => {
      const res = await fetch("/api/sessions");
      if (!res.ok) throw new Error("Gagal memuat riwayat sesi");
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <section className="flex flex-col gap-6" aria-busy="true" aria-label="Memuat riwayat">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
        <div className="flex flex-col gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      </section>
    );
  }

  if (isError) {
    return (
      <section className="flex flex-col gap-6">
        <SectionHeader title="Riwayat Latihan" />
        <EmptyState
          icon={ClipboardList}
          title="Gagal memuat riwayat"
          description="Terjadi kesalahan saat mengambil data sesi. Coba muat ulang halaman."
        />
      </section>
    );
  }

  const sessions = data ?? [];
  const totalVolume = Math.round(sessions.reduce((acc, s) => acc + s.totalVolumeKg, 0));
  const scrollable = sessions.length > 15;

  return (
    <section className="flex flex-col gap-5">
      {/* ===== Header ===== */}
      <SectionHeader
        title="Riwayat Latihan"
        subtitle="Semua sesi yang telah kamu selesaikan"
      />

      {sessions.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="Belum ada sesi"
          description="Selesaikan latihan pertamamu — riwayat akan muncul di sini."
        />
      ) : (
        <>
          {/* ===== Ringkasan ===== */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-card px-3 py-1.5 text-xs font-bold">
              <ClipboardList className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
              <span className="stat-num">{sessions.length}</span> sesi
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-card px-3 py-1.5 text-xs font-bold">
              <Dumbbell className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
              Total volume{" "}
              <span className="stat-num">{totalVolume.toLocaleString("id-ID")}</span> kg
            </span>
          </div>

          {/* ===== Daftar sesi ===== */}
          <div
            className={cn(
              "flex flex-col gap-3",
              scrollable &&
                "max-h-[72vh] overflow-y-auto pr-1 [scrollbar-width:thin] [scrollbar-color:var(--border)_transparent]"
            )}
            aria-label="Daftar sesi latihan"
          >
            {sessions.map((s) => (
              <SessionCard key={s.id} session={s} />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
