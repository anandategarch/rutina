"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Activity, Loader2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import type { ReadinessDTO, ReadinessLevel } from "@/lib/types";

const SORENESS_LABELS = [
  "Tidak pegal sekali",
  "Sedikit pegal",
  "Pegal sedang",
  "Pegal cukup kuat",
  "Sangat pegal",
];

const STRESS_LABELS = [
  "Sangat santai",
  "Santai",
  "Stres sedang",
  "Cukup stres",
  "Sangat stres",
];

const ENERGY_LABELS = [
  "Tidak bertenaga",
  "Lemas",
  "Cukup",
  "Bertenaga",
  "Energi penuh",
];

function levelBadgeClass(level: ReadinessLevel): string {
  switch (level) {
    case "PRIME":
      return "bg-primary/15 text-primary";
    case "GOOD":
      return "bg-muted text-foreground";
    case "MODERATE":
      return "bg-amber-500/15 text-amber-700 dark:text-amber-400";
    case "LOW":
      return "bg-destructive/15 text-destructive";
  }
}

function ScaleRow({
  label,
  value,
  labels,
  onChange,
}: {
  label: string;
  value: number;
  labels: string[];
  onChange: (v: number) => void;
}) {
  return (
    <div className="mt-4">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-sm font-semibold">{label}</Label>
        <span className="text-xs text-muted-foreground" aria-live="polite">
          {labels[value - 1]}
        </span>
      </div>
      <div className="mt-1.5 grid grid-cols-5 gap-1.5" role="group" aria-label={label}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            aria-pressed={value === n}
            aria-label={`${label}: ${n} dari 5`}
            className={cn(
              "flex h-11 items-center justify-center rounded-lg border text-sm font-bold stat-num transition-colors",
              value === n
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border/70 bg-muted/50 text-muted-foreground hover:border-primary/50 hover:text-foreground"
            )}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}

interface ReadinessFormValues {
  sleepHours: number;
  soreness: number;
  stress: number;
  energy: number;
}

function ReadinessForm({
  initial,
  onSaved,
}: {
  initial: ReadinessFormValues;
  onSaved: () => void;
}) {
  const queryClient = useQueryClient();
  const [sleepHours, setSleepHours] = useState(initial.sleepHours);
  const [soreness, setSoreness] = useState(initial.soreness);
  const [stress, setStress] = useState(initial.stress);
  const [energy, setEnergy] = useState(initial.energy);

  const submitMutation = useMutation({
    mutationFn: async (): Promise<ReadinessDTO> => {
      const res = await fetch("/api/readiness", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sleepHours, soreness, stress, energy }),
      });
      if (!res.ok) {
        const body: { error?: string } | null = await res.json().catch(() => null);
        throw new Error(body?.error ?? "Gagal mengirim check-in");
      }
      return res.json();
    },
    onSuccess: (result) => {
      toast.success(`Check-in terkirim — skor readiness ${result.score}`);
      void queryClient.invalidateQueries({ queryKey: ["plan"] });
      onSaved();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  return (
    <div className="rounded-xl border border-border/70 bg-card p-4 sm:p-6">
      <div className="flex items-center gap-2">
        <Activity className="h-4 w-4 text-primary" />
        <h3 className="font-display text-base font-extrabold uppercase tracking-tight">
          Check-in Readiness
        </h3>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Ceritakan kondisimu hari ini supaya coach bisa menyesuaikan target latihan.
      </p>

      <div className="mt-5">
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor="readiness-sleep" className="text-sm font-semibold">
            Tidur semalam (jam)
          </Label>
          <span
            className="font-display text-lg font-extrabold stat-num text-primary"
            aria-live="polite"
          >
            {sleepHours} jam
          </span>
        </div>
        <Slider
          id="readiness-sleep"
          className="mt-3"
          value={[sleepHours]}
          min={3}
          max={10}
          step={0.5}
          onValueChange={(v) => setSleepHours(v[0] ?? initial.sleepHours)}
          aria-label="Jam tidur semalam"
        />
      </div>

      <ScaleRow
        label="Pegal / DOMS"
        value={soreness}
        labels={SORENESS_LABELS}
        onChange={setSoreness}
      />
      <ScaleRow
        label="Stres"
        value={stress}
        labels={STRESS_LABELS}
        onChange={setStress}
      />
      <ScaleRow
        label="Energi"
        value={energy}
        labels={ENERGY_LABELS}
        onChange={setEnergy}
      />

      <Button
        type="button"
        className="mt-5 h-12 w-full font-display text-sm font-extrabold uppercase tracking-wide"
        disabled={submitMutation.isPending}
        onClick={() => submitMutation.mutate()}
      >
        {submitMutation.isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Activity className="h-4 w-4" />
        )}
        Kirim Check-in
      </Button>
    </div>
  );
}

export function ReadinessCard({ readiness }: { readiness: ReadinessDTO }) {
  const [editing, setEditing] = useState(false);
  const showForm = !readiness.done || editing;

  if (showForm) {
    return (
      <ReadinessForm
        key={`${readiness.dateKey}-${readiness.done ? "edit" : "new"}`}
        initial={{
          sleepHours: readiness.sleepHours,
          soreness: readiness.soreness,
          stress: readiness.stress,
          energy: readiness.energy,
        }}
        onSaved={() => setEditing(false)}
      />
    );
  }

  return (
    <div className="rounded-xl border border-border/70 bg-card p-4 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          <h3 className="font-display text-base font-extrabold uppercase tracking-tight">
            Readiness Hari Ini
          </h3>
        </div>
        <Button
          type="button"
          variant="ghost"
          className="h-11 px-3 text-xs font-semibold"
          onClick={() => setEditing(true)}
          aria-label="Edit check-in readiness"
        >
          <Pencil className="h-3.5 w-3.5" />
          Edit
        </Button>
      </div>

      <div className="mt-4 flex items-center gap-4 sm:gap-5">
        <div
          className="font-display text-5xl font-black leading-none stat-num text-primary sm:text-6xl"
          aria-label={`Skor readiness ${readiness.score} dari 100`}
        >
          {readiness.score}
        </div>
        <div className="min-w-0">
          <span
            className={cn(
              "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide",
              levelBadgeClass(readiness.level)
            )}
          >
            {readiness.levelLabel}
          </span>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            {readiness.recommendation}
          </p>
        </div>
      </div>
    </div>
  );
}
