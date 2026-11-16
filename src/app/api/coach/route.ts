import { NextResponse } from "next/server";
import ZAI from "z-ai-web-dev-sdk";
import { buildCoachContext } from "@/lib/coach-engine";
import { db } from "@/lib/db";
import { ensureSeeded } from "@/lib/seed";
import type { ChatMessageDTO } from "@/lib/types";

function timeLabel(d: Date): string {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function toDTO(m: { id: string; role: string; content: string; createdAt: Date }): ChatMessageDTO {
  return {
    id: m.id,
    role: m.role as "user" | "assistant",
    content: m.content,
    createdAt: m.createdAt.toISOString(),
    timeLabel: timeLabel(m.createdAt),
  };
}

export async function GET() {
  try {
    await ensureSeeded();
    const messages = await db.chatMessage.findMany({
      orderBy: { createdAt: "asc" },
      take: 100,
    });
    return NextResponse.json(messages.map(toDTO) satisfies ChatMessageDTO[]);
  } catch (e) {
    console.error("GET /api/coach error:", e);
    return NextResponse.json({ error: "Gagal memuat percakapan" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await ensureSeeded();
    const body = await req.json();
    const message = String(body.message ?? "").trim().slice(0, 2000);
    if (!message) {
      return NextResponse.json({ error: "Pesan tidak boleh kosong" }, { status: 400 });
    }

    const userMsg = await db.chatMessage.create({
      data: { role: "user", content: message },
    });

    // konteks data atlet untuk coach
    const context = await buildCoachContext();
    const systemPrompt = [
      "Kamu adalah 'Coach Rutina', personal trainer dan coach digital yang ramah, memotivasi, dan berbasis data.",
      "Kamu melatih satu atlet (pengguna aplikasi Rutina) dan MENGETAHUI data latihannya terkini di bawah ini.",
      "Aturan menjawab:",
      "- Selalu jawab dalam Bahasa Indonesia yang hangat tapi to the point.",
      "- Rujuk data konkret atlet (beban, repetisi, pace, PR, readiness, streak) kalau relevan.",
      "- Terapkan prinsip progressive overload, autoregulasi, dan pencegahan cedera.",
      "- Jangan menyarankan obat/medis; kalau pertanyaan soal cedera serius, sarankan konsultasi profesional.",
      "- Jawaban ringkas (maksimal ~150 kata), pakai bullet kalau perlu.",
      "",
      "=== DATA ATLET SAAT INI ===",
      context,
    ].join("\n");

    // riwayat percakapan terakhir (maks 12 pesan utk konteks)
    const history = await db.chatMessage.findMany({
      orderBy: { createdAt: "asc" },
      take: 13,
      skip: Math.max(0, (await db.chatMessage.count()) - 13),
    });
    const llmMessages: { role: "assistant" | "user"; content: string }[] = [
      { role: "assistant", content: systemPrompt },
      ...history
        .slice(0, -1)
        .map((m): { role: "user" | "assistant"; content: string } => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
      { role: "user", content: message },
    ];

    const zai = await ZAI.create();
    const completion = await zai.chat.completions.create({
      messages: llmMessages,
      thinking: { type: "disabled" },
    });
    const reply = completion.choices[0]?.message?.content?.trim();
    if (!reply) {
      throw new Error("Respons AI kosong");
    }

    const assistantMsg = await db.chatMessage.create({
      data: { role: "assistant", content: reply },
    });

    return NextResponse.json({
      userMessage: toDTO(userMsg),
      reply: toDTO(assistantMsg),
    });
  } catch (e) {
    console.error("POST /api/coach error:", e);
    return NextResponse.json(
      { error: "Coach sedang tidak bisa membalas. Coba lagi sebentar." },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    await db.chatMessage.deleteMany({});
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("DELETE /api/coach error:", e);
    return NextResponse.json({ error: "Gagal menghapus percakapan" }, { status: 500 });
  }
}
