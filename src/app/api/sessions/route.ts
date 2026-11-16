import { NextResponse } from "next/server";
import { sessionToDTO } from "@/lib/coach-engine";
import { db } from "@/lib/db";
import { dateKeyInTZ, dayStart } from "@/lib/date";
import { ensureSeeded } from "@/lib/seed";
import type { SessionDTO, SessionType } from "@/lib/types";

export async function GET() {
  try {
    await ensureSeeded();
    const sessions = await db.workoutSession.findMany({
      where: { status: "COMPLETED" },
      include: { setLogs: { include: { exercise: true } } },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: 30,
    });
    return NextResponse.json(sessions.map(sessionToDTO) satisfies SessionDTO[]);
  } catch (e) {
    console.error("GET /api/sessions error:", e);
    return NextResponse.json({ error: "Gagal memuat riwayat sesi" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await ensureSeeded();
    const body = await req.json();
    const title = String(body.title ?? "Latihan").slice(0, 80);
    const type: SessionType = ["STRENGTH", "CARDIO", "RECOVERY"].includes(body.type)
      ? body.type
      : "STRENGTH";
    const readinessScore =
      Number.isFinite(Number(body.readinessScore)) && Number(body.readinessScore) > 0
        ? Math.round(Number(body.readinessScore))
        : null;

    const today = dayStart(dateKeyInTZ());

    // idempotent: kalau sudah ada sesi IN_PROGRESS hari ini, pakai itu
    const existing = await db.workoutSession.findFirst({
      where: { date: today, status: "IN_PROGRESS" },
      include: { setLogs: { include: { exercise: true } } },
    });
    if (existing) {
      return NextResponse.json(sessionToDTO(existing) satisfies SessionDTO);
    }

    const session = await db.workoutSession.create({
      data: {
        date: today,
        type,
        title,
        status: "IN_PROGRESS",
        readinessScore,
      },
      include: { setLogs: { include: { exercise: true } } },
    });
    return NextResponse.json(sessionToDTO(session) satisfies SessionDTO);
  } catch (e) {
    console.error("POST /api/sessions error:", e);
    return NextResponse.json({ error: "Gagal memulai sesi" }, { status: 500 });
  }
}
