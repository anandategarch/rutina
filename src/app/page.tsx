"use client";

import { useQuery } from "@tanstack/react-query";
import {
  ClipboardList,
  Dumbbell,
  Flame,
  MessageCircle,
  Sprout,
  TrendingUp,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { ThemeToggle } from "@/components/rutina/shared";
import { TodayView } from "@/components/rutina/today-view";
import { HistoryView } from "@/components/rutina/history-view";
import { ProgressView } from "@/components/rutina/progress-view";
import { CoachChatView } from "@/components/rutina/coach-chat-view";
import { SessionView } from "@/components/rutina/session-view";
import { useRutinaStore, type View } from "@/lib/store";
import type { PlanResponse } from "@/lib/types";
import { cn } from "@/lib/utils";

const NAV: { id: View; label: string; icon: LucideIcon }[] = [
  { id: "today", label: "Hari Ini", icon: Dumbbell },
  { id: "history", label: "Riwayat", icon: ClipboardList },
  { id: "progress", label: "Progres", icon: TrendingUp },
  { id: "coach", label: "Coach", icon: MessageCircle },
];

export default function Home() {
  const { view, setView, activeSessionId } = useRutinaStore();

  const { data: plan } = useQuery<PlanResponse>({
    queryKey: ["plan"],
    queryFn: async () => {
      const res = await fetch("/api/plan");
      if (!res.ok) throw new Error("Gagal memuat rencana");
      return res.json();
    },
  });

  const streak = plan?.streak;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* ===== Header ===== */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-4">
          <button
            className="flex items-center gap-2"
            onClick={() => setView("today")}
            aria-label="Rutina — kembali ke Hari Ini"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <Sprout className="h-4.5 w-4.5 text-primary-foreground" strokeWidth={2.5} />
            </span>
            <span className="font-display text-lg font-black uppercase tracking-tight">
              Rutina
            </span>
          </button>
          <div className="flex items-center gap-1.5">
            {streak && streak.weeks > 0 ? (
              <span className="mr-1 inline-flex items-center gap-1 rounded-full border border-border/70 bg-card px-2.5 py-1 text-xs font-bold">
                <Flame className="h-3.5 w-3.5 text-primary" strokeWidth={2.5} />
                <span className="stat-num">{streak.weeks}</span>
                <span className="hidden text-muted-foreground sm:inline">minggu</span>
              </span>
            ) : null}
            <ThemeToggle />
          </div>
        </div>
      </header>

      <div className="flex flex-1">
        {/* ===== Sidebar desktop ===== */}
        <aside className="sticky top-14 hidden h-[calc(100vh-3.5rem)] w-60 shrink-0 flex-col justify-between border-r border-border/60 bg-sidebar p-4 md:flex">
          <nav className="flex flex-col gap-1" aria-label="Navigasi utama">
            {NAV.map((item) => {
              const active = view === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setView(item.id)}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors",
                    active
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  )}
                  aria-current={active ? "page" : undefined}
                >
                  <item.icon className="h-4.5 w-4.5" strokeWidth={2.25} />
                  {item.label}
                </button>
              );
            })}
          </nav>
          <div className="rounded-xl border border-border/60 bg-card p-3">
            <p className="font-display text-xs font-extrabold uppercase tracking-wide text-primary">
              Mode Coach Aktif
            </p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Target harianmu menyesuaikan otomatis: progression, readiness,
              plateau &amp; deload.
            </p>
          </div>
        </aside>

        {/* ===== Konten utama ===== */}
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-28 pt-4 md:pb-10 md:pt-6">
          {view === "today" ? <TodayView /> : null}
          {view === "history" ? <HistoryView /> : null}
          {view === "progress" ? <ProgressView /> : null}
          {view === "coach" ? <CoachChatView /> : null}
        </main>
      </div>

      {/* ===== Footer (sticky bottom) ===== */}
      <footer className="mt-auto border-t border-border/60 bg-background pb-[calc(env(safe-area-inset-bottom)+4.75rem)] md:pb-0">
        <div className="mx-auto flex w-full max-w-5xl flex-col items-center justify-between gap-1 px-4 py-4 text-[11px] text-muted-foreground sm:flex-row">
          <span className="font-display font-bold uppercase tracking-widest">
            Rutina — Personal Coach Digital
          </span>
          <span>Progressive Overload · Readiness · Deload · AI Coach</span>
        </div>
      </footer>

      {/* ===== Bottom nav mobile ===== */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border/60 bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/75 md:hidden"
        aria-label="Navigasi utama"
      >
        <div className="grid grid-cols-4 pb-[env(safe-area-inset-bottom)]">
          {NAV.map((item) => {
            const active = view === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setView(item.id)}
                className={cn(
                  "flex min-h-[56px] flex-col items-center justify-center gap-0.5 px-1 pt-1.5 pb-1 transition-colors",
                  active ? "text-primary" : "text-muted-foreground"
                )}
                aria-current={active ? "page" : undefined}
              >
                <item.icon className="h-5 w-5" strokeWidth={active ? 2.5 : 2} />
                <span
                  className={cn(
                    "text-[10px] font-bold uppercase tracking-wide",
                    active && "text-primary"
                  )}
                >
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* ===== Mode sesi latihan (full-screen overlay) ===== */}
      {activeSessionId ? <SessionView /> : null}
    </div>
  );
}
