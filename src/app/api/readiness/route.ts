import { NextResponse } from "next/server";
import { computeReadiness } from "@/lib/coach-engine";
import { db } from "@/lib/db";
import { dateKeyInTZ, dayStart } from "@/lib/date";
import { ensureSeeded } from "@/lib/seed";
import type { ReadinessDTO } from "@/lib/types";

function levelLabel(level: string): string {
  return level === "PRIME" ? "Prime" : level === "GOOD" ? "Siap" : level === "MODERATE" ? "Moderat" : "Pemulihan";
}

export async function GET() {
  try {
    await ensureSeeded();
    const today = dayStart(dateKeyInTZ());
    const rc = await db.readinessCheck.findFirst({ where: { date: today } });
    const key = dateKeyInTZ();
    const dto: ReadinessDTO = rc
      ? {
          dateKey: key,
          done: true,
          sleepHours: rc.sleepHours,
          soreness: rc.soreness,
          stress: rc.stress,
          energy: rc.energy,
          score: rc.score,
          level: rc.level as ReadinessDTO["level"],
          levelLabel: levelLabel(rc.level),
          recommendation: rc.recommendation,
        }
      : {
          dateKey: key,
          done: false,
          sleepHours: 7,
          soreness: 3,
          stress: 3,
          energy: 3,
          score: 0,
          level: "GOOD",
          levelLabel: "—",
          recommendation: "Lakukan check-in dulu supaya Rutina bisa menyesuaikan targetmu hari ini.",
        };
    return NextResponse.json(dto);
  } catch (e) {
    console.error("GET /api/readiness error:", e);
    return NextResponse.json({ error: "Gagal memuat readiness" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await ensureSeeded();
    const body = await req.json();
    const sleepHours = Number(body.sleepHours);
    const soreness = Number(body.soreness);
    const stress = Number(body.stress);
    const energy = Number(body.energy);
    if (
      !Number.isFinite(sleepHours) ||
      sleepHours < 0 ||
      sleepHours > 14 ||
      !Number.isFinite(soreness) ||
      soreness < 1 ||
      soreness > 5 ||
      !Number.isFinite(stress) ||
      stress < 1 ||
      stress > 5 ||
      !Number.isFinite(energy) ||
      energy < 1 ||
      energy > 5
    ) {
      return NextResponse.json({ error: "Input readiness tidak valid" }, { status: 400 });
    }

    const result = computeReadiness({ sleepHours, soreness, stress, energy });
    const today = dayStart(dateKeyInTZ());
    const data = {
      date: today,
      sleepHours,
      soreness: Math.round(soreness),
      stress: Math.round(stress),
      energy: Math.round(energy),
      score: result.score,
      level: result.level,
      recommendation: result.recommendation,
    };
    const rc = await db.readinessCheck.upsert({
      where: { date: today },
      update: data,
      create: data,
    });

    // sinkronkan readinessScore sesi in-progress hari ini
    const inProgress = await db.workoutSession.findFirst({
      where: { date: today, status: "IN_PROGRESS" },
    });
    if (inProgress) {
      await db.workoutSession.update({
        where: { id: inProgress.id },
        data: { readinessScore: result.score },
      });
    }

    return NextResponse.json({
      dateKey: dateKeyInTZ(),
      done: true,
      sleepHours: rc.sleepHours,
      soreness: rc.soreness,
      stress: rc.stress,
      energy: rc.energy,
      score: rc.score,
      level: rc.level as ReadinessDTO["level"],
      levelLabel: levelLabel(rc.level),
      recommendation: rc.recommendation,
    } satisfies ReadinessDTO);
  } catch (e) {
    console.error("POST /api/readiness error:", e);
    return NextResponse.json({ error: "Gagal menyimpan check-in readiness" }, { status: 500 });
  }
}
