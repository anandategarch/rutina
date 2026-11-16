"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Loader2, Send, Sprout, Trash2 } from "lucide-react";
import Markdown from "react-markdown";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import type { ChatMessageDTO } from "@/lib/types";
import { cn } from "@/lib/utils";

const QUICK_PROMPTS = [
  "Kenapa beban aku stagnan?",
  "Sarankan latihan kaki",
  "Tips pemulihan DOMS",
  "Evaluasi minggu ini",
  "Cara naik bench press?",
];

const MD_COMPONENTS = {
  p: ({ children }: { children?: React.ReactNode }) => (
    <p className="text-sm leading-relaxed">{children}</p>
  ),
  strong: ({ children }: { children?: React.ReactNode }) => (
    <strong className="font-bold">{children}</strong>
  ),
  ul: ({ children }: { children?: React.ReactNode }) => (
    <ul className="list-disc space-y-1 pl-4">{children}</ul>
  ),
  ol: ({ children }: { children?: React.ReactNode }) => (
    <ol className="list-decimal space-y-1 pl-4">{children}</ol>
  ),
  li: ({ children }: { children?: React.ReactNode }) => (
    <li className="text-sm leading-relaxed">{children}</li>
  ),
  code: ({ children }: { children?: React.ReactNode }) => (
    <code className="rounded bg-muted px-1 py-0.5 text-xs">{children}</code>
  ),
};

function timeNow(): string {
  return new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date());
}

function CoachAvatar({ size = "sm" }: { size?: "sm" | "lg" }) {
  return (
    <span
      className={
        size === "lg"
          ? "flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary"
          : "flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15"
      }
      aria-hidden="true"
    >
      <Sprout
        className={size === "lg" ? "h-7 w-7 text-primary-foreground" : "h-3.5 w-3.5 text-primary"}
        strokeWidth={2.5}
      />
    </span>
  );
}

function MessageBubble({ message }: { message: ChatMessageDTO }) {
  const isUser = message.role === "user";
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
      className={cn("flex flex-col", isUser ? "items-end" : "items-start")}
    >
      {isUser ? (
        <>
          <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-primary px-3.5 py-2.5 text-sm leading-relaxed text-primary-foreground">
            {message.content}
          </div>
          <span className="mt-1 pr-0.5 text-[10px] text-muted-foreground">
            {message.timeLabel}
          </span>
        </>
      ) : (
        <div className="flex items-end gap-2">
          <CoachAvatar />
          <div className="flex max-w-[85%] flex-col">
            <div className="rounded-2xl rounded-bl-md bg-muted px-3.5 py-2.5">
              <Markdown components={MD_COMPONENTS}>{message.content}</Markdown>
            </div>
            <span className="mt-1 pl-0.5 text-[10px] text-muted-foreground">
              {message.timeLabel}
            </span>
          </div>
        </div>
      )}
    </motion.div>
  );
}

function TypingIndicator({ slow }: { slow: boolean }) {
  return (
    <div className="flex items-end gap-2" aria-label="Coach sedang mengetik">
      <CoachAvatar />
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-1 rounded-2xl rounded-bl-md bg-muted px-4 py-3">
          {[0, 150, 300].map((delay) => (
            <span
              key={delay}
              className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground"
              style={{ animationDelay: `${delay}ms` }}
            />
          ))}
        </div>
        {slow ? (
          <span className="text-[10px] text-muted-foreground">
            Coach sedang menyusun jawaban — bisa sampai 25 detik…
          </span>
        ) : null}
      </div>
    </div>
  );
}

function CoachIntro({ onPrompt }: { onPrompt: (prompt: string) => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 py-10 text-center">
      <CoachAvatar size="lg" />
      <div>
        <p className="font-display text-lg font-extrabold uppercase tracking-tight">
          Halo, aku Coach Rutina
        </p>
        <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
          Aku tahu data latihanmu — PR, readiness, streak, sampai plateau. Tanya apa saja!
        </p>
      </div>
      <div className="flex max-w-md flex-wrap justify-center gap-2">
        {QUICK_PROMPTS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onPrompt(p)}
            className="rounded-full border border-border/70 bg-muted/50 px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
          >
            {p}
          </button>
        ))}
      </div>
    </div>
  );
}

export function CoachChatView() {
  const queryClient = useQueryClient();
  const [input, setInput] = useState("");
  const [optimistic, setOptimistic] = useState<ChatMessageDTO | null>(null);
  const [slow, setSlow] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data, isLoading } = useQuery<ChatMessageDTO[]>({
    queryKey: ["coach"],
    queryFn: async () => {
      const res = await fetch("/api/coach");
      if (!res.ok) throw new Error("Gagal memuat percakapan");
      return res.json();
    },
  });

  const sendMutation = useMutation({
    mutationFn: async (
      message: string
    ): Promise<{ userMessage: ChatMessageDTO; reply: ChatMessageDTO }> => {
      const res = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      if (!res.ok) throw new Error("Coach gagal membalas");
      return res.json();
    },
    onSuccess: (result) => {
      setOptimistic(null);
      queryClient.setQueryData<ChatMessageDTO[]>(["coach"], (old) => [
        ...(old ?? []),
        result.userMessage,
        result.reply,
      ]);
    },
    onError: () => {
      setOptimistic(null);
      toast.error("Coach sedang tidak bisa membalas. Coba lagi sebentar.");
    },
    onSettled: () => {
      setSlow(false);
    },
  });

  const clearMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/coach", { method: "DELETE" });
      if (!res.ok) throw new Error("Gagal menghapus percakapan");
    },
    onSuccess: () => {
      queryClient.setQueryData<ChatMessageDTO[]>(["coach"], []);
      toast.success("Percakapan dihapus");
    },
    onError: () => {
      toast.error("Gagal menghapus percakapan. Coba lagi.");
    },
  });

  const messages = useMemo(
    () => [...(data ?? []), ...(optimistic ? [optimistic] : [])],
    [data, optimistic]
  );

  // Auto-scroll ke bawah saat ada pesan baru / indikator mengetik
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, sendMutation.isPending]);

  // Catatan "lambat" jika balasan > 12 detik
  // (reset dilakukan di onSettled mutation & saat kirim pesan baru,
  //  setState di sini hanya terjadi dalam callback timeout)
  useEffect(() => {
    if (!sendMutation.isPending) return;
    const t = setTimeout(() => setSlow(true), 12000);
    return () => clearTimeout(t);
  }, [sendMutation.isPending]);

  function send(text: string) {
    const message = text.trim();
    if (!message || sendMutation.isPending) return;
    const now = new Date();
    setSlow(false);
    setOptimistic({
      id: `optimistic-${now.getTime()}`,
      role: "user",
      content: message,
      createdAt: now.toISOString(),
      timeLabel: timeNow(),
    });
    setInput("");
    sendMutation.mutate(message);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    send(input);
  }

  const showIntro = !isLoading && messages.length === 0 && !sendMutation.isPending;

  return (
    <Card className="flex h-[calc(100dvh-19rem)] flex-col gap-0 overflow-hidden py-0 md:h-[calc(100dvh-17rem)]">
      {/* ===== Header ===== */}
      <CardHeader className="flex-row items-center justify-between gap-3 border-b border-border/60 px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary">
            <Sprout className="h-5 w-5 text-primary-foreground" strokeWidth={2.5} />
          </span>
          <div className="min-w-0">
            <CardTitle className="font-display text-base font-extrabold uppercase tracking-tight">
              Coach Rutina
            </CardTitle>
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="relative flex h-2 w-2" aria-hidden="true">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
              </span>
              online — AI coach dengan akses data latihanmu
            </p>
          </div>
        </div>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Hapus percakapan"
              disabled={clearMutation.isPending || messages.length === 0}
            >
              {clearMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Hapus percakapan?</AlertDialogTitle>
              <AlertDialogDescription>
                Seluruh riwayat chat dengan Coach Rutina akan dihapus permanen. Tindakan
                ini tidak bisa dibatalkan.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Batal</AlertDialogCancel>
              <AlertDialogAction onClick={() => clearMutation.mutate()}>
                Hapus
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardHeader>

      {/* ===== Daftar pesan ===== */}
      <ScrollArea className="min-h-0 flex-1">
        <CardContent
          className="flex flex-col gap-4 px-4 py-4 sm:px-6"
          role="log"
          aria-live="polite"
          aria-label="Percakapan dengan Coach Rutina"
        >
          {isLoading ? (
            <>
              <Skeleton className="h-10 w-3/5 rounded-2xl" />
              <Skeleton className="h-16 w-4/5 self-end rounded-2xl" />
              <Skeleton className="h-12 w-2/3 rounded-2xl" />
            </>
          ) : showIntro ? (
            <CoachIntro onPrompt={send} />
          ) : (
            <>
              {messages.map((m) => (
                <MessageBubble key={m.id} message={m} />
              ))}
              {sendMutation.isPending ? <TypingIndicator slow={slow} /> : null}
            </>
          )}
          <div ref={bottomRef} aria-hidden="true" />
        </CardContent>
      </ScrollArea>

      {/* ===== Input ===== */}
      <form
        onSubmit={handleSubmit}
        className="flex shrink-0 items-center gap-2 border-t border-border/60 p-3 sm:px-4"
      >
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Tanya coach…"
          aria-label="Tulis pesan untuk Coach Rutina"
          maxLength={2000}
          autoComplete="off"
        />
        <Button
          type="submit"
          size="icon"
          aria-label="Kirim pesan"
          disabled={sendMutation.isPending || !input.trim()}
        >
          {sendMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </form>
    </Card>
  );
}
