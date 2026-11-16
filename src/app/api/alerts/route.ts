import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { dateKeyInTZ, formatDateLabel, startOfToday } from "@/lib/date";
import type { CoachMessageDTO } from "@/lib/types";

export async function GET() {
  try {
    const messages = await db.coachMessage.findMany({
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: 20,
    });
    const dtos: CoachMessageDTO[] = messages.map((m) => ({
      id: m.id,
      type: m.type as CoachMessageDTO["type"],
      title: m.title,
      body: m.body,
      severity: m.severity as CoachMessageDTO["severity"],
      dateKey: dateKeyInTZ(m.date),
      dateLabel: formatDateLabel(dateKeyInTZ(m.date)),
      read: m.read,
    }));
    return NextResponse.json(dtos);
  } catch (e) {
    console.error("GET /api/alerts error:", e);
    return NextResponse.json({ error: "Gagal memuat pesan coach" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    if (body.all === true) {
      await db.coachMessage.updateMany({ data: { read: true } });
    } else if (typeof body.id === "string") {
      await db.coachMessage.update({ where: { id: body.id }, data: { read: true } });
    }
    const unread = await db.coachMessage.count({ where: { read: false } });
    return NextResponse.json({ ok: true, unread });
  } catch (e) {
    console.error("PATCH /api/alerts error:", e);
    return NextResponse.json({ error: "Gagal menandai pesan" }, { status: 500 });
  }
}
