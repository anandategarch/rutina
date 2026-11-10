import { NextResponse } from "next/server";
import { isLegacyBackup, applyLegacyMigration } from "@/lib/migrate-legacy";
import { isTursoConfigured } from "@/lib/server/turso";
import { todayISO } from "@/lib/format";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 20 * 1024 * 1024;

export async function POST(request: Request) {
  if (!isTursoConfigured()) {
    return NextResponse.json({ error: "Migrasi membutuhkan koneksi Turso." }, { status: 503 });
  }
  const size = Number(request.headers.get("content-length") ?? 0);
  if (size > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "File backup legacy terlalu besar untuk dimigrasi." }, { status: 413 });
  }
  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "File backup bukan JSON yang valid." }, { status: 400 });
  }
  if (!isLegacyBackup(body)) {
    return NextResponse.json({
      error: "File bukan backup legacy V1 Rutina. Endpoint ini khusus migrasi dari aplikasi Rutina lama (format tanpa envelope `format: rutina-v2-backup`).",
    }, { status: 400 });
  }

  try {
    const result = await applyLegacyMigration(body, todayISO());
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Rutina legacy migration failed:", error);
    // Detail kegagalan (nama env, URL koneksi) hanya ke log server —
    // respons API memakai pesan tetap.
    return NextResponse.json({ error: "Gagal memigrasi backup legacy. Data yang sudah ada tidak dihapus." }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    endpoint: "/api/migrate-legacy",
    description: "Migrasi backup Rutina V1 (format lama tanpa envelope rutina-v2-backup) ke skema V2. Kirim POST dengan body JSON backup lama.",
    expectedFormat: "Objek dengan `data.*` berisi habits, habitLogs, dailyLogs, transactions, fundSources, weeklyBudgets, habitGroups, workRoutines, workTasks, workNotes, appSettings, dll.",
  });
}
