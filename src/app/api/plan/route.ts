import { NextResponse } from "next/server";
import { getPlan } from "@/lib/coach-engine";
import { ensureSeeded } from "@/lib/seed";

export async function GET() {
  try {
    await ensureSeeded();
    const plan = await getPlan();
    return NextResponse.json(plan);
  } catch (e) {
    console.error("GET /api/plan error:", e);
    return NextResponse.json({ error: "Gagal memuat rencana latihan" }, { status: 500 });
  }
}
