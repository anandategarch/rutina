import { NextResponse } from "next/server";
import { ensurePlateauMessages, getProgressData } from "@/lib/coach-engine";
import { ensureSeeded } from "@/lib/seed";
import type { ProgressResponse } from "@/lib/types";

export async function GET() {
  try {
    await ensureSeeded();
    await ensurePlateauMessages(); // idempotent, dedupe mingguan
    const data = await getProgressData();
    return NextResponse.json(data satisfies ProgressResponse);
  } catch (e) {
    console.error("GET /api/progress error:", e);
    return NextResponse.json({ error: "Gagal memuat data progres" }, { status: 500 });
  }
}
