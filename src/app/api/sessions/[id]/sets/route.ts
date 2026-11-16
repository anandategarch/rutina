import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import type { SetLogDTO } from "@/lib/types";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const body = await req.json();
    const exerciseId = String(body.exerciseId ?? "");
    if (!exerciseId) {
      return NextResponse.json({ error: "exerciseId wajib diisi" }, { status: 400 });
    }

    const session = await db.workoutSession.findUnique({ where: { id } });
    if (!session) {
      return NextResponse.json({ error: "Sesi tidak ditemukan" }, { status: 404 });
    }
    if (session.status === "COMPLETED") {
      return NextResponse.json(
        { error: "Sesi sudah selesai — tidak bisa menambah set" },
        { status: 400 }
      );
    }

    const exercise = await db.exercise.findUnique({ where: { id: exerciseId } });
    if (!exercise) {
      return NextResponse.json({ error: "Latihan tidak ditemukan" }, { status: 404 });
    }

    const setNumber = Number.isFinite(Number(body.setNumber)) ? Math.max(1, Math.round(Number(body.setNumber))) : 1;
    const weightKg = Number.isFinite(Number(body.weightKg)) ? Math.max(0, Number(body.weightKg)) : 0;
    const reps = Number.isFinite(Number(body.reps)) ? Math.max(0, Math.round(Number(body.reps))) : 0;
    const distanceKm = Number.isFinite(Number(body.distanceKm)) ? Math.max(0, Number(body.distanceKm)) : null;
    const durationSec = Number.isFinite(Number(body.durationSec)) ? Math.max(0, Math.round(Number(body.durationSec))) : null;
    const rpe = Number.isFinite(Number(body.rpe)) && Number(body.rpe) > 0 ? Number(body.rpe) : null;
    const isWarmup = body.isWarmup === true;

    if (exercise.type === "STRENGTH" && (weightKg <= 0 || reps <= 0)) {
      return NextResponse.json({ error: "Beban dan repetisi wajib > 0" }, { status: 400 });
    }
    if (exercise.type === "CARDIO" && (!distanceKm || !durationSec)) {
      return NextResponse.json({ error: "Jarak dan durasi wajib diisi" }, { status: 400 });
    }

    const log = await db.setLog.create({
      data: {
        sessionId: id,
        exerciseId,
        setNumber,
        weightKg,
        reps,
        rpe,
        isWarmup,
        distanceKm,
        durationSec,
      },
      include: { exercise: true },
    });

    // update volume sesi
    const logs = await db.setLog.findMany({
      where: { sessionId: id },
      include: { exercise: true },
    });
    const volume = logs
      .filter((l) => !l.isWarmup && l.exercise.type === "STRENGTH")
      .reduce((a, l) => a + l.weightKg * l.reps, 0);
    await db.workoutSession.update({
      where: { id },
      data: { totalVolumeKg: Math.round(volume * 10) / 10 },
    });

    const dto: SetLogDTO = {
      id: log.id,
      exerciseId: log.exerciseId,
      exerciseName: log.exercise.name,
      exerciseType: log.exercise.type as "STRENGTH" | "CARDIO",
      setNumber: log.setNumber,
      weightKg: log.weightKg,
      reps: log.reps,
      rpe: log.rpe,
      isWarmup: log.isWarmup,
      distanceKm: log.distanceKm,
      durationSec: log.durationSec,
      createdAt: log.createdAt.toISOString(),
    };
    return NextResponse.json({
      set: dto,
      sessionVolumeKg: Math.round(volume * 10) / 10,
      setCount: logs.length,
    });
  } catch (e) {
    console.error("POST /api/sessions/[id]/sets error:", e);
    return NextResponse.json({ error: "Gagal menyimpan set" }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const url = new URL(req.url);
    const setId = url.searchParams.get("setId");
    if (!setId) {
      return NextResponse.json({ error: "setId wajib diisi" }, { status: 400 });
    }
    const log = await db.setLog.findUnique({ where: { id: setId } });
    if (!log || log.sessionId !== id) {
      return NextResponse.json({ error: "Set tidak ditemukan" }, { status: 404 });
    }
    await db.setLog.delete({ where: { id: setId } });

    const logs = await db.setLog.findMany({
      where: { sessionId: id },
      include: { exercise: true },
    });
    const volume = logs
      .filter((l) => !l.isWarmup && l.exercise.type === "STRENGTH")
      .reduce((a, l) => a + l.weightKg * l.reps, 0);
    await db.workoutSession.update({
      where: { id },
      data: { totalVolumeKg: Math.round(volume * 10) / 10 },
    });
    return NextResponse.json({ ok: true, sessionVolumeKg: Math.round(volume * 10) / 10 });
  } catch (e) {
    console.error("DELETE /api/sessions/[id]/sets error:", e);
    return NextResponse.json({ error: "Gagal menghapus set" }, { status: 500 });
  }
}
