import { NextResponse } from "next/server";
import { completeSession, sessionToDTO } from "@/lib/coach-engine";
import { db } from "@/lib/db";
import type { CompleteSessionResult, SessionDTO } from "@/lib/types";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const session = await db.workoutSession.findUnique({
      where: { id },
      include: { setLogs: { include: { exercise: true } } },
    });
    if (!session) {
      return NextResponse.json({ error: "Sesi tidak ditemukan" }, { status: 404 });
    }
    return NextResponse.json(sessionToDTO(session) satisfies SessionDTO);
  } catch (e) {
    console.error("GET /api/sessions/[id] error:", e);
    return NextResponse.json({ error: "Gagal memuat sesi" }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const body = await req.json();
    const complete = body.complete === true;

    if (complete) {
      const result = await completeSession(id, {
        notes: typeof body.notes === "string" ? body.notes.slice(0, 500) : undefined,
        durationMin:
          Number.isFinite(Number(body.durationMin)) && Number(body.durationMin) > 0
            ? Math.round(Number(body.durationMin))
            : undefined,
      });
      return NextResponse.json(result satisfies CompleteSessionResult);
    }

    const session = await db.workoutSession.update({
      where: { id },
      data: {
        notes: typeof body.notes === "string" ? body.notes.slice(0, 500) : undefined,
        durationMin:
          Number.isFinite(Number(body.durationMin)) && Number(body.durationMin) > 0
            ? Math.round(Number(body.durationMin))
            : undefined,
      },
      include: { setLogs: { include: { exercise: true } } },
    });
    return NextResponse.json(sessionToDTO(session) satisfies SessionDTO);
  } catch (e) {
    console.error("PATCH /api/sessions/[id] error:", e);
    return NextResponse.json({ error: "Gagal memperbarui sesi" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const session = await db.workoutSession.findUnique({ where: { id } });
    if (!session) {
      return NextResponse.json({ error: "Sesi tidak ditemukan" }, { status: 404 });
    }
    if (session.status === "COMPLETED") {
      return NextResponse.json(
        { error: "Sesi yang sudah selesai tidak bisa dihapus" },
        { status: 400 }
      );
    }
    await db.workoutSession.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("DELETE /api/sessions/[id] error:", e);
    return NextResponse.json({ error: "Gagal menghapus sesi" }, { status: 500 });
  }
}
