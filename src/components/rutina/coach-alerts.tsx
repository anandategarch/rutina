"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  BatteryLow,
  CheckCheck,
  Info,
  Lightbulb,
  Loader2,
  Trophy,
  TriangleAlert,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { SectionHeader, SeverityBadge } from "@/components/rutina/shared";
import { cn } from "@/lib/utils";
import type { CoachMessageDTO, CoachMessageType } from "@/lib/types";

const TYPE_ICONS: Record<CoachMessageType, { icon: LucideIcon; className: string }> = {
  CELEBRATION: { icon: Trophy, className: "text-primary" },
  WARNING: { icon: TriangleAlert, className: "text-destructive" },
  SUGGESTION: { icon: Lightbulb, className: "text-primary" },
  DELOAD: { icon: BatteryLow, className: "text-amber-500" },
  INFO: { icon: Info, className: "text-muted-foreground" },
};

function CoachMessageRow({
  message,
  index,
  onMarkRead,
  busy,
}: {
  message: CoachMessageDTO;
  index: number;
  onMarkRead: () => void;
  busy: boolean;
}) {
  const config = TYPE_ICONS[message.type] ?? TYPE_ICONS.INFO;
  const unread = !message.read;
  const Icon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className={cn(
        "rounded-xl border p-3.5 sm:p-4",
        unread ? "cursor-pointer border-primary/40 bg-card" : "border-border/70 bg-card/60"
      )}
      role={unread ? "button" : undefined}
      tabIndex={unread ? 0 : undefined}
      aria-label={unread ? `Pesan coach: ${message.title} — belum dibaca` : undefined}
      onClick={unread ? onMarkRead : undefined}
      onKeyDown={(e: React.KeyboardEvent) => {
        if (unread && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onMarkRead();
        }
      }}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted",
            config.className
          )}
          aria-hidden="true"
        >
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="font-display text-sm font-bold">{message.title}</p>
            {unread ? (
              <span
                className="h-2 w-2 shrink-0 rounded-full bg-primary"
                aria-label="Belum dibaca"
              />
            ) : null}
            <SeverityBadge severity={message.severity} />
          </div>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            {message.body}
          </p>
          <p className="mt-1.5 text-[11px] text-muted-foreground/80">
            {message.dateLabel}
          </p>
        </div>
        {unread ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-11 w-11 shrink-0 text-muted-foreground"
            aria-label={`Tandai pesan "${message.title}" sebagai dibaca`}
            disabled={busy}
            onClick={(e) => {
              e.stopPropagation();
              onMarkRead();
            }}
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <X className="h-4 w-4" />
            )}
          </Button>
        ) : null}
      </div>
    </motion.div>
  );
}

export function CoachAlerts({
  messages,
  unreadCount,
}: {
  messages: CoachMessageDTO[];
  unreadCount: number;
}) {
  const queryClient = useQueryClient();

  const markOneMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch("/api/alerts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) {
        throw new Error("Gagal menandai pesan");
      }
      return res.json() as Promise<{ ok: boolean; unread: number }>;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["plan"] });
    },
    onError: () => {
      toast.error("Gagal menandai pesan sebagai dibaca");
    },
  });

  const markAllMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/alerts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      });
      if (!res.ok) {
        throw new Error("Gagal menandai pesan");
      }
      return res.json() as Promise<{ ok: boolean; unread: number }>;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["plan"] });
    },
    onError: () => {
      toast.error("Gagal menandai semua pesan");
    },
  });

  if (messages.length === 0) {
    return null;
  }

  const visible = messages.slice(0, 5);

  return (
    <section aria-label="Pesan coach">
      <SectionHeader
        title="Pesan Coach"
        subtitle={
          unreadCount > 0
            ? `${unreadCount} pesan belum dibaca`
            : "Semua pesan sudah dibaca"
        }
        action={
          <Button
            type="button"
            variant="ghost"
            className="h-11 px-3 text-xs font-semibold"
            disabled={unreadCount === 0 || markAllMutation.isPending}
            onClick={() => markAllMutation.mutate()}
          >
            {markAllMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCheck className="h-4 w-4" />
            )}
            Tandai dibaca
          </Button>
        }
      />
      <div className="mt-3 flex flex-col gap-2">
        {visible.map((message, i) => (
          <CoachMessageRow
            key={message.id}
            message={message}
            index={i}
            busy={markOneMutation.isPending && markOneMutation.variables === message.id}
            onMarkRead={() => markOneMutation.mutate(message.id)}
          />
        ))}
      </div>
    </section>
  );
}
