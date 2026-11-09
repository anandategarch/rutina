import { NextResponse } from "next/server";
import { createClient, type Client } from "@libsql/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

let cached: Client | null = null;

function getClient(): Client | null {
  const url = process.env.RUTINA_TURSO_URL?.trim();
  const token = process.env.RUTINA_TURSO_TOKEN?.trim();
  if (!url || !token) return null;
  if (!cached) cached = createClient({ url, authToken: token });
  return cached;
}

const dpart = (v: unknown): string => String(v ?? "").slice(0, 10);
const num = (v: unknown): number => {
  const n = typeof v === "number" ? v : Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

const NO_STORE = { "Cache-Control": "no-store" } as const;

export async function GET() {
  const client = getClient();
  if (!client) {
    return NextResponse.json(
      { ok: false, error: "RUTINA_TURSO_URL / RUTINA_TURSO_TOKEN belum diisi." },
      { status: 503, headers: NO_STORE },
    );
  }

  try {
    const [habits, groups, logs, options, finCats, txs, budgets, sources, daily, settings] =
      await Promise.all([
        client.execute(
          `SELECT "id","name","emoji","category","priority","difficulty","habitType","target","unit","reminder","groupId" FROM "Habit" WHERE "isActive"=1 AND "isArchived"=0`,
        ),
        client.execute(`SELECT "id","name","color" FROM "HabitGroup" ORDER BY "sortOrder"`),
        client.execute(`SELECT "habitId","date","completed","value" FROM "HabitLog"`),
        client.execute(
          `SELECT "type","label","color" FROM "HabitOption" WHERE "type"='category' ORDER BY "sortOrder"`,
        ),
        client.execute(`SELECT "name","emoji","color","type" FROM "FinanceCategory"`),
        client.execute(
          `SELECT "id","type","amount","category","sourceId","description","date" FROM "Transaction" ORDER BY "date" DESC`,
        ),
        client.execute(`SELECT "category","month","amount" FROM "WeeklyBudget"`),
        client.execute(
          `SELECT "id","name","type","emoji","initialBalance" FROM "FundSource" WHERE "isArchived"=0 ORDER BY "sortOrder"`,
        ),
        client.execute(`SELECT "date","mood","energy","sleep" FROM "DailyLog"`),
        client.execute(`SELECT "userName","weekStart","targetCompletion" FROM "AppSettings" LIMIT 1`),
      ]);

    const data = {
      settings: {
        userName: String(settings.rows[0]?.userName ?? "Sahabat Rutina"),
        weekStart: Number(settings.rows[0]?.weekStart ?? 1),
        targetCompletion: Number(settings.rows[0]?.targetCompletion ?? 80),
      },
      habitGroups: groups.rows.map((r) => ({
        id: String(r.id),
        name: String(r.name),
        color: String(r.color ?? "#10B981"),
      })),
      habitCategories: options.rows.map((r) => ({
        name: String(r.label),
        color: String(r.color ?? "#64748B"),
      })),
      habits: habits.rows.map((r) => ({
        id: String(r.id),
        name: String(r.name),
        emoji: String(r.emoji ?? ""),
        category: String(r.category ?? "General"),
        priority: String(r.priority ?? "Medium"),
        difficulty: String(r.difficulty ?? "Medium"),
        habitType: String(r.habitType ?? "normal"),
        target: Number(r.target ?? 1),
        unit: r.unit ? String(r.unit) : null,
        reminder: r.reminder ? String(r.reminder) : null,
        groupId: r.groupId ? String(r.groupId) : null,
      })),
      habitLogs: logs.rows.map((r) => ({
        habitId: String(r.habitId),
        date: dpart(r.date),
        completed: num(r.completed) === 1,
        value: Number(r.value ?? 1),
      })),
      financeCategories: finCats.rows.map((r) => ({
        name: String(r.name),
        emoji: String(r.emoji ?? ""),
        color: String(r.color ?? "#64748B"),
        type: String(r.type) === "income" ? "income" : "expense",
      })),
      fundSources: sources.rows.map((r) => ({
        id: String(r.id),
        name: String(r.name),
        type: String(r.type ?? "bank"),
        emoji: String(r.emoji ?? ""),
        initialBalance: num(r.initialBalance),
      })),
      transactions: txs.rows.map((r) => ({
        id: String(r.id),
        type: String(r.type),
        amount: Math.round(num(r.amount)),
        category: String(r.category ?? "Lainnya"),
        sourceId: r.sourceId ? String(r.sourceId) : null,
        description: String(r.description ?? ""),
        date: dpart(r.date),
      })),
      weeklyBudgets: budgets.rows.map((r) => ({
        category: String(r.category),
        month: String(r.month ?? ""),
        amount: Math.round(num(r.amount)),
      })),
      dailyLogs: daily.rows.map((r) => ({
        date: dpart(r.date),
        mood: num(r.mood),
        energy: num(r.energy),
        sleep: num(r.sleep),
      })),
    };

    return NextResponse.json(
      { ok: true, source: "turso", fetchedAt: new Date().toISOString(), data },
      { headers: NO_STORE },
    );
  } catch (error) {
    console.error("[/api/rutina] gagal membaca database:", error);
    return NextResponse.json(
      { ok: false, error: "Gagal membaca database Turso." },
      { status: 502, headers: NO_STORE },
    );
  }
}
