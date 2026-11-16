import { NextResponse } from "next/server";
import { getProfile } from "@/lib/coach-engine";
import { db } from "@/lib/db";
import { addDays, dateKeyInTZ, dayStart, startOfToday } from "@/lib/date";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const accept = body.accept === true;
    const profile = await getProfile();

    if (accept) {
      const until = dayStart(addDays(dateKeyInTZ(), 6)); // 7 hari termasuk hari ini
      await db.profile.update({
        where: { id: profile.id },
        data: { deloadUntil: until },
      });
      await db.coachMessage.create({
        data: {
          type: "DELOAD",
          severity: "info",
          title: "Deload Week dimulai",
          body: "Intensitas latihanmu dipangkas 50% selama 7 hari ke depan. Fokus pada teknik, kualitas gerakan, dan pemulihan. Tubuhmu akan kembali lebih kuat!",
          date: startOfToday(),
        },
      });
      return NextResponse.json({
        active: true,
        daysLeft: 7,
        endDateKey: dateKeyInTZ(until),
      });
    }

    await db.profile.update({
      where: { id: profile.id },
      data: { deloadUntil: null },
    });
    return NextResponse.json({ active: false, daysLeft: 0, endDateKey: null });
  } catch (e) {
    console.error("POST /api/deload error:", e);
    return NextResponse.json({ error: "Gagal mengatur deload" }, { status: 500 });
  }
}
