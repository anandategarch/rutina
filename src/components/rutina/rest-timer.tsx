"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";

interface RestTimerProps {
  seconds: number;
  exerciseName: string;
  onDone: () => void;
}

const RING_RADIUS = 26;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

/** Bunyi pendek WebAudio 880 Hz / 120 ms (dibuat on-demand, aman gagal). */
function playBeep(ctxRef: { current: AudioContext | null }): void {
  try {
    if (typeof window === "undefined" || typeof window.AudioContext === "undefined") {
      return;
    }
    if (!ctxRef.current) {
      ctxRef.current = new window.AudioContext();
    }
    const ctx = ctxRef.current;
    if (ctx.state === "suspended") {
      void ctx.resume();
    }
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 880;
    osc.connect(gain);
    gain.connect(ctx.destination);
    const now = ctx.currentTime;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.3, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
    osc.start(now);
    osc.stop(now + 0.14);
  } catch {
    // audio diblokir browser — abaikan diam-diam
  }
}

/** Umpan suara "Ayo, set berikutnya!" (id-ID bila tersedia). */
function speakGo(): void {
  try {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance("Ayo, set berikutnya!");
    utterance.lang = "id-ID";
    const indonesian = window.speechSynthesis
      .getVoices()
      .find((v) => v.lang.toLowerCase().startsWith("id"));
    if (indonesian) {
      utterance.voice = indonesian;
    }
    window.speechSynthesis.speak(utterance);
  } catch {
    // speech synthesis tidak tersedia — abaikan
  }
}

export function RestTimer({ seconds, exerciseName, onDone }: RestTimerProps) {
  const [remaining, setRemaining] = useState(seconds);
  const [total, setTotal] = useState(seconds);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const onDoneRef = useRef(onDone);

  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  // Reset bila prop `seconds` berubah tanpa remount.
  useEffect(() => {
    setRemaining(seconds);
    setTotal(seconds);
  }, [seconds]);

  // Tick hitungan mundur 1 detik.
  useEffect(() => {
    const interval = window.setInterval(() => {
      setRemaining((r) => (r > 0 ? r - 1 : 0));
    }, 1000);
    return () => window.clearInterval(interval);
  }, []);

  // Bunyi 3 detik terakhir + penanganan saat mencapai nol.
  useEffect(() => {
    if (remaining === 0) {
      playBeep(audioCtxRef);
      const secondBeep = window.setTimeout(() => playBeep(audioCtxRef), 200);
      speakGo();
      const autoClose = window.setTimeout(() => onDoneRef.current(), 2000);
      return () => {
        window.clearTimeout(secondBeep);
        window.clearTimeout(autoClose);
      };
    }
    if (remaining <= 3) {
      playBeep(audioCtxRef);
    }
    return undefined;
  }, [remaining]);

  const fraction = total > 0 ? Math.max(0, Math.min(1, remaining / total)) : 0;
  const urgent = remaining > 0 && remaining <= 3;

  return (
    <motion.div
      role="timer"
      aria-label={`Istirahat ${Math.max(0, remaining)} detik untuk ${exerciseName}`}
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      className="fixed inset-x-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-[60] sm:left-1/2 sm:right-auto sm:max-w-md sm:-translate-x-1/2"
    >
      <div className="flex items-center gap-3 rounded-2xl border border-primary/40 bg-card p-3 shadow-xl shadow-black/30">
        <div className="relative h-14 w-14 shrink-0">
          <svg viewBox="0 0 64 64" className="h-14 w-14" aria-hidden="true">
            <circle
              cx="32"
              cy="32"
              r={RING_RADIUS}
              fill="none"
              strokeWidth="6"
              className="stroke-muted"
            />
            <circle
              cx="32"
              cy="32"
              r={RING_RADIUS}
              fill="none"
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={RING_CIRCUMFERENCE}
              strokeDashoffset={RING_CIRCUMFERENCE * (1 - fraction)}
              className="stroke-primary"
              transform="rotate(-90 32 32)"
            />
          </svg>
          <motion.span
            animate={urgent ? { scale: [1, 1.18, 1] } : { scale: 1 }}
            transition={{ duration: 1, repeat: urgent ? Infinity : 0 }}
            className="absolute inset-0 flex items-center justify-center font-display text-base font-extrabold stat-num"
          >
            {Math.max(0, remaining)}
          </motion.span>
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-widest text-primary">
            Istirahat
          </p>
          <p className="truncate font-display text-sm font-bold uppercase tracking-tight">
            {exerciseName}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <Button
            type="button"
            variant="ghost"
            className="h-11 px-3 text-xs font-bold"
            onClick={() => {
              setRemaining((r) => r + 15);
              setTotal((t) => t + 15);
            }}
            aria-label="Tambah 15 detik istirahat"
          >
            +15s
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="h-11 px-3 text-xs font-bold"
            onClick={() => onDoneRef.current()}
            aria-label="Lewati istirahat"
          >
            Lewati
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
