import { NextResponse } from "next/server";
import { createClient, type Client, type InValue } from "@libsql/client";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ==========================================================================
   /api/rutina — jembatan data untuk konsep Rutina (public/rutina.html).

   v2.22 · BACA-TULIS PENUH.
   - GET  : membaca seluruh isi database (bentuk respons sama seperti
            versi sebelumnya, klien lama tetap kompatibel).
   - POST : menerima "lapisan catatan pengguna" (overlay — struktur yang sama
            dengan jurnal localStorage di perangkat) + daftar final anggaran
            & kategori, lalu menerapkannya secara IDEMPOTEN: diputar ulang
            berapa pun kali hasil akhirnya sama. Aman untuk retry saat
            koneksi goyah, dan aman bila respons sukses hilang di jaringan.

   Sumber database dipilih otomatis:
   - RUTINA_TURSO_URL + RUTINA_TURSO_TOKEN terisi → Turso (produksi).
   - Belum terisi (mis. pratinjau lokal) → SQLite file db/rutina-preview.db
     dengan skema V1 (nama tabel/kolom identik), otomatis dibuat & diisi
     dari snapshot yang tertanam di public/rutina.html saat pertama kali
     diakses — jalur baca-tulis tetap hidup penuh tanpa kredensial.

   v2.35 · kolom Atomic Habits: Habit.mini + Habit.afterId (versi 2 menit
   & jangkar "susun kebiasaan") dan AppSettings.identityText (pernyataan
   identitas "aku yang ingin jadi…"). Ditambahkan lewat migrasi ALTER
   idempoten — database lama (lokal maupun Turso) tak perlu dibuat ulang.

   v2.37 · kolom Transaction.recurrence ("weekly"/"monthly" — transaksi
   berulang) + habitMeta diperluas: sunting kebiasaan kini membawa nama,
   emoji (ilustrasi), kategori, jam pengingat, dan grup — UPDATE dibangun
   dinamis dari kunci yang HADIR di jurnal (jurnal lama tetap kompatibel:
   hanya mini/afterId yang tersentuh).

   v2.39 · jurnal dailyLog: check-in harian mood/energi/tidur — peta
   tanggal → nilai, UPSERT ke tabel DailyLog (sudah ada sejak skema V1
   via CREATE TABLE IF NOT EXISTS). Tabel "date" PRIMARY KEY membuatnya
   idempoten alami: diputar ulang berapa pun kali, baris hari itu tetap
   satu dengan nilai terakhir.

   Semua nilai di-bind lewat prepared statement; nama tabel & kolom selalu
   hardcoded, tidak pernah berasal dari input klien.
   ========================================================================== */

const NO_STORE = { "Cache-Control": "no-store" } as const;
const MAX_BODY_BYTES = 2 * 1024 * 1024;
const LOCAL_DB = resolve(process.cwd(), "db", "rutina-preview.db");
const HTML_SNAPSHOT = resolve(process.cwd(), "public", "rutina.html");

/* ---------------------------------------------------------------- utilitas */

const dpart = (v: unknown): string => String(v ?? "").slice(0, 10);
const num = (v: unknown): number => {
  const n = typeof v === "number" ? v : Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};
const str = (v: unknown, fallback = ""): string =>
  v === null || v === undefined ? fallback : String(v);
/* Koersi nilai argumen SQL ke tipe yang diterima libsql. Data lapisan
   catatan pengguna datang dari JSON (unknown), sementara InValue hanya
   menerima null|number|bigint|string|Date (dsb.) — tanpa ini tsc gagal
   saat `next build` di Vercel (TS2769 di insertRow). */
const inVal = (v: unknown): InValue => {
  if (v === null || v === undefined) return null;
  if (typeof v === "number" || typeof v === "bigint" || typeof v === "string") return v;
  if (typeof v === "boolean") return v ? 1 : 0; /* SQLite tak punya BOOLEAN → 0/1 */
  if (v instanceof Date) return v;
  return String(v); /* objek/ragam lain → bentuk string yang aman */
};

/* ------------------------------------------------------- pemilihan klien */

type DbTarget = { client: Client; source: "turso" | "local" };

let cachedTurso: Client | null = null;
let tursoMigrated = false; /* v2.35 · migrasi kolom Atomic Habits sekali per proses */
let cachedLocal: { client: Client; ready: Promise<void> } | null = null;

function tursoClient(): Client | null {
  const url = process.env.RUTINA_TURSO_URL?.trim();
  const token = process.env.RUTINA_TURSO_TOKEN?.trim();
  if (!url || !token) return null;
  if (!cachedTurso) cachedTurso = createClient({ url, authToken: token });
  return cachedTurso;
}

async function getTarget(): Promise<DbTarget> {
  const turso = tursoClient();
  if (turso) {
    /* v2.35 · pastikan kolom Atomic Habits hadir di database produksi.
       v2.58 · tabel Bugar juga dibuat idempoten di Turso (CREATE IF NOT
       EXISTS aman diputar ulang tiap boot proses). */
    if (!tursoMigrated) {
      for (const sql of DDL) {
        try { await turso.execute(sql); } catch { /* tabel sudah ada — lanjut */ }
      }
      await migrateColumns(turso);
      tursoMigrated = true;
    }
    return { client: turso, source: "turso" };
  }
  if (!cachedLocal) {
    mkdirSync(dirname(LOCAL_DB), { recursive: true });
    const client = createClient({ url: `file:${LOCAL_DB}` });
    const ready = ensureLocalSchema(client).catch((error) => {
      console.error("[/api/rutina] gagal menyiapkan database lokal:", error);
      cachedLocal = null;
      throw error;
    });
    cachedLocal = { client, ready };
  }
  await cachedLocal.ready;
  return { client: cachedLocal.client, source: "local" };
}

/* ----------------------------------------------- skema lokal (pratinjau) */

const DDL: string[] = [
  `CREATE TABLE IF NOT EXISTS "Habit"("id" TEXT PRIMARY KEY,"name" TEXT NOT NULL,"emoji" TEXT,"category" TEXT,"priority" TEXT,"difficulty" TEXT,"habitType" TEXT,"target" INTEGER,"unit" TEXT,"reminder" TEXT,"groupId" TEXT,"isActive" INTEGER DEFAULT 1,"isArchived" INTEGER DEFAULT 0,"mini" TEXT,"afterId" TEXT,"restDays" TEXT)`,
  `CREATE TABLE IF NOT EXISTS "HabitGroup"("id" TEXT PRIMARY KEY,"name" TEXT NOT NULL,"color" TEXT,"sortOrder" INTEGER DEFAULT 0)`,
  `CREATE TABLE IF NOT EXISTS "HabitLog"("habitId" TEXT NOT NULL,"date" TEXT NOT NULL,"completed" INTEGER DEFAULT 1,"value" REAL DEFAULT 1,PRIMARY KEY("habitId","date"))`,
  `CREATE TABLE IF NOT EXISTS "HabitOption"("type" TEXT NOT NULL,"label" TEXT NOT NULL,"color" TEXT,"sortOrder" INTEGER DEFAULT 0,PRIMARY KEY("type","label"))`,
  `CREATE TABLE IF NOT EXISTS "FinanceCategory"("id" TEXT PRIMARY KEY,"name" TEXT UNIQUE NOT NULL,"emoji" TEXT,"color" TEXT,"type" TEXT DEFAULT 'expense',"sortOrder" INTEGER DEFAULT 0)`,
  `CREATE TABLE IF NOT EXISTS "Transaction"("id" TEXT PRIMARY KEY,"type" TEXT NOT NULL,"amount" INTEGER,"category" TEXT,"sourceId" TEXT,"description" TEXT,"date" TEXT,"recurrence" TEXT)`,
  `CREATE TABLE IF NOT EXISTS "WeeklyBudget"("category" TEXT NOT NULL,"month" TEXT NOT NULL,"amount" INTEGER,PRIMARY KEY("category","month"))`,
  `CREATE TABLE IF NOT EXISTS "FundSource"("id" TEXT PRIMARY KEY,"name" TEXT NOT NULL,"type" TEXT,"emoji" TEXT,"initialBalance" INTEGER DEFAULT 0,"sortOrder" INTEGER DEFAULT 0,"isArchived" INTEGER DEFAULT 0)`,
  `CREATE TABLE IF NOT EXISTS "DailyLog"("date" TEXT PRIMARY KEY,"mood" INTEGER,"energy" INTEGER,"sleep" INTEGER)`,
  `CREATE TABLE IF NOT EXISTS "AppSettings"("userName" TEXT,"weekStart" INTEGER DEFAULT 1,"targetCompletion" INTEGER DEFAULT 80,"identityText" TEXT)`,
  /* v2.58 · tab Bugar — latihan (beban & kardio), asupan kalori/makro, tubuh
     (hidrasi · berat · pemulihan). WorkoutSet.id menyatu dengan sesinya
     (hapus sesi = hapus serentetan set); BodyLog per-tanggal (PRIMARY KEY)
     membuat upsert idempoten alami seperti DailyLog. */
  `CREATE TABLE IF NOT EXISTS "Workout"("id" TEXT PRIMARY KEY,"date" TEXT NOT NULL,"kind" TEXT NOT NULL,"duration" INTEGER,"distance" REAL,"note" TEXT)`,
  `CREATE TABLE IF NOT EXISTS "WorkoutSet"("id" TEXT PRIMARY KEY,"workoutId" TEXT NOT NULL,"exercise" TEXT,"reps" INTEGER,"weight" REAL)`,
  `CREATE TABLE IF NOT EXISTS "FoodLog"("id" TEXT PRIMARY KEY,"date" TEXT NOT NULL,"meal" TEXT,"name" TEXT,"kcal" INTEGER,"protein" REAL,"carb" REAL,"fat" REAL)`,
  `CREATE TABLE IF NOT EXISTS "BodyLog"("date" TEXT PRIMARY KEY,"water" INTEGER,"weight" REAL,"recover" INTEGER)`,
];

/* v2.35 · migrasi kolom Atomic Habits — ALTER per kolom; gagal "duplicate
   column" berarti kolom sudah ada → diabaikan (idempoten, aman diulang). */
const COLUMN_MIGRATIONS: [string, string][] = [
  ["Habit", "mini"],
  ["Habit", "afterId"],
  ["AppSettings", "identityText"],
  ["Transaction", "recurrence"], /* v2.37 · transaksi berulang */
  ["Habit", "restDays"], /* v2.54 · jeda runtun aman (CSV YYYY-MM-DD) */
  ["AppSettings", "fitness"], /* v2.58 · sasaran Bugar (JSON teks) */
];
async function migrateColumns(client: Client): Promise<void> {
  for (const [table, col] of COLUMN_MIGRATIONS) {
    try {
      await client.execute(`ALTER TABLE "${table}" ADD COLUMN "${col}" TEXT`);
    } catch { /* kolom sudah ada — lanjut */ }
  }
}

async function ensureLocalSchema(client: Client): Promise<void> {
  /* v2.60 · hardening SQLite pratinjau — audit "koneksi ke database aman
     dan sehat ya?" menemukan file db memakai journal_mode=delete bawaan:
     satu penulis mengunci seluruh file → pembacaan GET saat sinkronisasi
     POST berjalan bisa kena SQLITE_BUSY. Dua pragma permanen memperbaikinya
     tanpa mengubah semantik transaksi:
     · WAL — pembaca & penulis hidup bersamaan; file -wal/-shm akan muncul
       di samping db/rutina-preview.db (normal, bukan kebocoran).
     · busy_timeout 5 dtk — penulis kedua menunggu antrean, bukan gagal.
     klien lokal adalah singleton per proses, jadi pragma sekali di boot
     berlaku untuk seluruh umur server; idempoten & aman diulang. */
  try {
    await client.execute("PRAGMA journal_mode=WAL");
    await client.execute("PRAGMA busy_timeout=5000");
  } catch { /* modul read-only / fs aneh → lanjut dengan perilaku lama */ }
  for (const sql of DDL) await client.execute(sql);
  await migrateColumns(client);
  const res = await client.execute(`SELECT COUNT(*) AS n FROM "Habit"`);
  const n = Number((res.rows[0] as { n?: unknown } | undefined)?.n ?? 0);
  if (n === 0) await seedFromSnapshot(client);
}

/* snapshot awal diambil dari blok <script id="dbSnapshot"> dalam rutina.html
   (sumber kebenaran tunggal — pratinjau selalu mulai dari data yang sama
   dengan yang dilihat klien saat server tak terjangkau) */
let snapshotCache: Record<string, unknown> | null | undefined;
function loadSnapshot(): Record<string, unknown> | null {
  if (snapshotCache !== undefined) return snapshotCache;
  snapshotCache = null;
  try {
    if (!existsSync(HTML_SNAPSHOT)) return snapshotCache;
    const html = readFileSync(HTML_SNAPSHOT, "utf8");
    const m = html.match(/<script[^>]*id="dbSnapshot"[^>]*>([\s\S]*?)<\/script>/);
    if (!m) return snapshotCache;
    const parsed = JSON.parse(m[1]) as { ok?: boolean; data?: Record<string, unknown> };
    if (parsed?.ok && parsed?.data) snapshotCache = parsed.data;
  } catch {
    snapshotCache = null;
  }
  return snapshotCache;
}

function catRowId(name: string): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "cat";
  return `fc-${slug}`;
}

async function seedFromSnapshot(client: Client): Promise<void> {
  const data = loadSnapshot();
  if (!data) return;
  const rows = (key: string): Record<string, unknown>[] =>
    Array.isArray(data[key]) ? (data[key] as Record<string, unknown>[]) : [];

  const settings = (data.settings ?? {}) as Record<string, unknown>;
  await client.execute({
    sql: `INSERT INTO "AppSettings"("userName","weekStart","targetCompletion") VALUES (?,?,?)`,
    args: [str(settings.userName, "Sahabat Rutina"), num(settings.weekStart) || 1, num(settings.targetCompletion) || 80],
  });
  const groups = rows("habitGroups");
  for (let i = 0; i < groups.length; i++) {
    await client.execute({
      sql: `INSERT INTO "HabitGroup"("id","name","color","sortOrder") VALUES (?,?,?,?)`,
      args: [str(groups[i].id), str(groups[i].name), str(groups[i].color, "#10B981"), i],
    });
  }
  const cats = rows("habitCategories");
  for (let i = 0; i < cats.length; i++) {
    await client.execute({
      sql: `INSERT INTO "HabitOption"("type","label","color","sortOrder") VALUES ('category',?,?,?)`,
      args: [str(cats[i].name), str(cats[i].color, "#64748B"), i],
    });
  }
  const habits = rows("habits");
  for (const h of habits) {
    await client.execute({
      sql: `INSERT INTO "Habit"("id","name","emoji","category","priority","difficulty","habitType","target","unit","reminder","groupId","isActive","isArchived") VALUES (?,?,?,?,?,?,?,?,?,?,?,1,0)`,
      args: [
        str(h.id), str(h.name), str(h.emoji), str(h.category, "General"),
        str(h.priority, "Medium"), str(h.difficulty, "Medium"), str(h.habitType, "normal"),
        Math.round(num(h.target)) || 1, h.unit ? str(h.unit) : null, h.reminder ? str(h.reminder) : null,
        h.groupId ? str(h.groupId) : null,
      ],
    });
  }
  for (const l of rows("habitLogs")) {
    await client.execute({
      sql: `INSERT OR REPLACE INTO "HabitLog"("habitId","date","completed","value") VALUES (?,?,?,?)`,
      args: [str(l.habitId), dpart(l.date), num(l.completed) === 1 ? 1 : 0, num(l.value) || 1],
    });
  }
  for (const c of rows("financeCategories")) {
    await client.execute({
      sql: `INSERT INTO "FinanceCategory"("id","name","emoji","color","type","sortOrder") VALUES (?,?,?,?,?,?)`,
      args: [catRowId(str(c.name)), str(c.name), str(c.emoji), str(c.color, "#64748B"), str(c.type) === "income" ? "income" : "expense", 0],
    });
  }
  for (const s of rows("fundSources")) {
    await client.execute({
      sql: `INSERT INTO "FundSource"("id","name","type","emoji","initialBalance","sortOrder","isArchived") VALUES (?,?,?,?,?,0,0)`,
      args: [str(s.id), str(s.name), str(s.type, "bank"), str(s.emoji), Math.round(num(s.initialBalance))],
    });
  }
  for (const t of rows("transactions")) {
    await client.execute({
      sql: `INSERT INTO "Transaction"("id","type","amount","category","sourceId","description","date") VALUES (?,?,?,?,?,?,?)`,
      args: [
        str(t.id), str(t.type) === "income" ? "income" : str(t.type) === "transfer" ? "transfer" : "expense",
        Math.round(num(t.amount)), str(t.category, "Lainnya"),
        t.sourceId ? str(t.sourceId) : null, str(t.description), dpart(t.date),
      ],
    });
  }
  for (const b of rows("weeklyBudgets")) {
    await client.execute({
      sql: `INSERT OR REPLACE INTO "WeeklyBudget"("category","month","amount") VALUES (?,?,?)`,
      args: [str(b.category), str(b.month), Math.round(num(b.amount))],
    });
  }
  for (const d of rows("dailyLogs")) {
    await client.execute({
      sql: `INSERT OR REPLACE INTO "DailyLog"("date","mood","energy","sleep") VALUES (?,?,?,?)`,
      args: [dpart(d.date), Math.round(num(d.mood)), Math.round(num(d.energy)), num(d.sleep)],
    });
  }
  /* v2.58 · tab Bugar — seed sesi latihan + set, asupan, dan catatan tubuh
     dari snapshot (pratinjau baru mulai dari taman bugar yang sama). */
  for (const w of rows("workouts")) {
    await client.execute({
      sql: `INSERT OR REPLACE INTO "Workout"("id","date","kind","duration","distance","note") VALUES (?,?,?,?,?,?)`,
      args: [str(w.id), dpart(w.date), str(w.kind, "beban"), Math.round(num(w.duration)), w.distance == null ? null : num(w.distance), str(w.note)],
    });
    const sets = Array.isArray(w.sets) ? (w.sets as Record<string, unknown>[]) : [];
    for (const s of sets) {
      await client.execute({
        sql: `INSERT OR REPLACE INTO "WorkoutSet"("id","workoutId","exercise","reps","weight") VALUES (?,?,?,?,?)`,
        args: [str(s.id), str(w.id), str(s.exercise), Math.round(num(s.reps)), num(s.weight)],
      });
    }
  }
  for (const f of rows("foodLogs")) {
    await client.execute({
      sql: `INSERT OR REPLACE INTO "FoodLog"("id","date","meal","name","kcal","protein","carb","fat") VALUES (?,?,?,?,?,?,?,?)`,
      args: [str(f.id), dpart(f.date), str(f.meal, "camilan"), str(f.name), Math.round(num(f.kcal)), num(f.protein), num(f.carb), num(f.fat)],
    });
  }
  for (const b of rows("bodyLogs")) {
    await client.execute({
      sql: `INSERT OR REPLACE INTO "BodyLog"("date","water","weight","recover") VALUES (?,?,?,?)`,
      args: [dpart(b.date), Math.round(num(b.water)), b.weight == null ? null : num(b.weight), Math.round(num(b.recover))],
    });
  }
}

/* -------------------------------------------- introspeksi kolom (aman) */

const FALLBACK_COLS: Record<string, string[]> = {
  Habit: ["id", "name", "emoji", "category", "priority", "difficulty", "habitType", "target", "unit", "reminder", "groupId", "isActive", "isArchived", "mini", "afterId"],
  HabitLog: ["habitId", "date", "completed", "value"],
  Transaction: ["id", "type", "amount", "category", "sourceId", "description", "date", "recurrence"],
  WeeklyBudget: ["category", "month", "amount"],
  FundSource: ["id", "name", "type", "emoji", "initialBalance"],
  FinanceCategory: ["id", "name", "emoji", "color", "type", "sortOrder"],
};
const colCache = new Map<string, Set<string>>();

async function columnsOf(client: Client, table: string): Promise<Set<string>> {
  const hit = colCache.get(table);
  if (hit) return hit;
  let cols: Set<string>;
  try {
    const res = await client.execute(`PRAGMA table_info("${table}")`);
    cols = new Set(res.rows.map((r) => str((r as { name?: unknown }).name)));
    if (cols.size === 0) cols = new Set(FALLBACK_COLS[table] ?? []);
  } catch {
    cols = new Set(FALLBACK_COLS[table] ?? []);
  }
  colCache.set(table, cols);
  return cols;
}

/* INSERT yang hanya memakai kolom yang benar-benar ada di tabel target —
   mencocokkan diri dengan skema asli apa pun bentuknya (mis. kolom waktu
   opsional createdAt/updatedAt di Turso legacy ikut terisi bila tersedia). */
async function insertRow(client: Client, table: string, row: Record<string, unknown>): Promise<void> {
  const cols = await columnsOf(client, table);
  const names = Object.keys(row).filter((c) => cols.has(c));
  if (cols.has("createdAt") && !names.includes("createdAt")) names.push("createdAt");
  if (cols.has("updatedAt") && !names.includes("updatedAt")) names.push("updatedAt");
  if (!names.length) return;
  const now = new Date().toISOString();
  const args: InValue[] = names.map((n) => inVal(n in row ? (row[n] ?? null) : now));
  const sql = `INSERT INTO "${table}" (${names.map((n) => `"${n}"`).join(", ")}) VALUES (${names.map(() => "?").join(", ")})`;
  await client.execute({ sql, args });
}

/* -------------------------------------------------------------- pembacaan */

export async function GET() {
  let target: DbTarget;
  try {
    target = await getTarget();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Sumber data belum siap. Muat ulang sebentar lagi." },
      { status: 503, headers: NO_STORE },
    );
  }

  try {
    const [habits, groups, logs, options, finCats, txs, budgets, sources, daily, settings, workouts, wsets, foods, body] =
      await Promise.all([
        target.client.execute(
          `SELECT "id","name","emoji","category","priority","difficulty","habitType","target","unit","reminder","groupId","mini","afterId","restDays" FROM "Habit" WHERE "isActive"=1 AND "isArchived"=0`,
        ),
        target.client.execute(`SELECT "id","name","color" FROM "HabitGroup" ORDER BY "sortOrder"`),
        target.client.execute(`SELECT "habitId","date","completed","value" FROM "HabitLog"`),
        target.client.execute(
          `SELECT "type","label","color" FROM "HabitOption" WHERE "type"='category' ORDER BY "sortOrder"`,
        ),
        target.client.execute(`SELECT "name","emoji","color","type" FROM "FinanceCategory"`),
        target.client.execute(
          `SELECT "id","type","amount","category","sourceId","description","date","recurrence" FROM "Transaction" ORDER BY "date" DESC`,
        ),
        target.client.execute(`SELECT "category","month","amount" FROM "WeeklyBudget"`),
        target.client.execute(
          `SELECT "id","name","type","emoji","initialBalance" FROM "FundSource" WHERE "isArchived"=0 ORDER BY "sortOrder"`,
        ),
        target.client.execute(`SELECT "date","mood","energy","sleep" FROM "DailyLog"`),
        target.client.execute(`SELECT "userName","weekStart","targetCompletion","identityText","fitness" FROM "AppSettings" LIMIT 1`),
        /* v2.58 · tab Bugar — sesi latihan (dengan set barbel), asupan, tubuh.
           v2.59 · set diurut rowid — urutan set 1,2,3… deterministik lintas
           SQLite/Turso (tanpa ORDER BY, urutan baris tak dijamin). */
        target.client.execute(`SELECT "id","date","kind","duration","distance","note" FROM "Workout" ORDER BY "date" DESC`),
        target.client.execute(`SELECT "id","workoutId","exercise","reps","weight" FROM "WorkoutSet" ORDER BY "rowid"`),
        target.client.execute(`SELECT "id","date","meal","name","kcal","protein","carb","fat" FROM "FoodLog" ORDER BY "date" DESC`),
        target.client.execute(`SELECT "date","water","weight","recover" FROM "BodyLog"`),
      ]);

    const data = {
      settings: {
        userName: String(settings.rows[0]?.userName ?? "Sahabat Rutina"),
        weekStart: Number(settings.rows[0]?.weekStart ?? 1),
        targetCompletion: Number(settings.rows[0]?.targetCompletion ?? 80),
        identityText: settings.rows[0]?.identityText ? String(settings.rows[0].identityText) : null,
        fitness: settings.rows[0]?.fitness ? String(settings.rows[0].fitness) : null, /* v2.58 · sasaran Bugar (JSON teks) */
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
        mini: r.mini ? String(r.mini) : null,
        afterId: r.afterId ? String(r.afterId) : null,
        restDays: r.restDays ? String(r.restDays) : null, /* v2.54 · jeda runtun */
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
        recurrence: r.recurrence === "weekly" || r.recurrence === "monthly" ? String(r.recurrence) : null, /* v2.37 */
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
      /* v2.58 · tab Bugar — sesi latihan dengan set barbel tertanam,
         asupan kalori/makro, dan catatan tubuh per tanggal */
      workouts: workouts.rows.map((r) => ({
        id: String(r.id),
        date: dpart(r.date),
        kind: String(r.kind ?? "beban"),
        duration: Math.round(num(r.duration)),
        distance: r.distance == null ? null : num(r.distance),
        note: String(r.note ?? ""),
        sets: wsets.rows
          .filter((s) => String(s.workoutId) === String(r.id))
          .map((s) => ({
            id: String(s.id),
            exercise: String(s.exercise ?? ""),
            reps: Math.round(num(s.reps)),
            weight: num(s.weight),
          })),
      })),
      foodLogs: foods.rows.map((r) => ({
        id: String(r.id),
        date: dpart(r.date),
        meal: String(r.meal ?? "snack"),
        name: String(r.name ?? ""),
        kcal: Math.round(num(r.kcal)),
        protein: num(r.protein),
        carb: num(r.carb),
        fat: num(r.fat),
      })),
      bodyLogs: body.rows.map((r) => ({
        date: dpart(r.date),
        water: Math.round(num(r.water)),
        weight: r.weight == null ? null : num(r.weight),
        recover: Math.round(num(r.recover)),
      })),
    };

    return NextResponse.json(
      { ok: true, source: target.source, fetchedAt: new Date().toISOString(), data },
      { headers: NO_STORE },
    );
  } catch (error) {
    console.error("[/api/rutina] gagal membaca database:", error);
    return NextResponse.json(
      { ok: false, error: "Gagal membaca database." },
      { status: 502, headers: NO_STORE },
    );
  }
}

/* ------------------------------------------------------------- penulisan */

interface TxRow { id: string; type: string; amount: number; category: string; sourceId: string | null; description: string; date: string; recurrence?: "weekly" | "monthly" | null }
interface BudRow { category: string; month: string; amount: number }
interface HabitRow { id: string; name: string; emoji: string; category: string; priority: string; difficulty: string; habitType: string; target: number; unit: string | null; reminder: string | null; groupId: string | null; mini: string | null; afterId: string | null; restDays: string | null }
/* v2.37 · meta sunting kebiasaan — PARTIAL: hanya kunci yang hadir di
   jurnal yang di-UPDATE (jurnal v2.35 lama hanya membawa mini/afterId). */
interface HabitMetaRow {
  name?: string | null; emoji?: string | null; category?: string | null;
  reminder?: string | null; groupId?: string | null;
  mini?: string | null; afterId?: string | null;
  restDays?: string | null; /* v2.54 · jeda runtun: CSV tanggal (maks 260) */
}
interface SrcRow { id: string; name: string; type: string; emoji: string; initialBalance: number }
interface DailyLogRow { date: string; mood: number; energy: number; sleep: number }
/* v2.58 · tab Bugar — baris jurnal latihan/asupan/tubuh */
interface SetRow { id: string; exercise: string; reps: number; weight: number }
interface WorkoutRow { id: string; date: string; kind: string; duration: number; distance: number | null; note: string; sets: SetRow[] }
interface FoodRow { id: string; date: string; meal: string; name: string; kcal: number; protein: number; carb: number; fat: number }
interface BodyRow { date: string; water: number; weight: number | null; recover: number }
interface Overlay {
  txAdd: TxRow[]; txEdit: Record<string, TxRow>; txDel: string[];
  budAdd: BudRow[]; budEdit: Record<string, BudRow>; budDel: string[];
  habitAdd: HabitRow[]; habitDel: string[];
  habitMeta: Record<string, HabitMetaRow>; identityText: string | null;
  logAdd: Record<string, number | true>; logDel: Record<string, true>;
  srcAdd: SrcRow[]; srcEdit: Record<string, SrcRow>; srcDel: string[];
  catRename: Record<string, string>; catDel: string[];
  dailyLog: Record<string, DailyLogRow>; /* v2.39 · kunci = tanggal */
  fitWAdd: WorkoutRow[]; fitWDel: string[]; /* v2.58 · latihan + set */
  fitFAdd: FoodRow[]; fitFDel: string[]; /* v2.58 · asupan */
  bodyLog: Record<string, BodyRow>; /* v2.58 · tubuh per tanggal */
  fitness: string | null; /* v2.58 · sasaran Bugar (JSON teks, null = belum tersentuh) */
}

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}
function sanitizeTx(v: unknown): TxRow {
  const o = asRecord(v);
  const type = str(o.type) === "income" ? "income" : str(o.type) === "transfer" ? "transfer" : "expense";
  const t: TxRow = {
    id: str(o.id),
    type,
    amount: Math.round(num(o.amount)),
    category: str(o.category, "Lainnya"),
    sourceId: o.sourceId ? str(o.sourceId) : null,
    description: str(o.description),
    date: str(o.date).slice(0, 10),
  };
  if ("recurrence" in o) t.recurrence = o.recurrence === "weekly" || o.recurrence === "monthly" ? o.recurrence : null; /* v2.37 */
  return t;
}
function sanitizeBud(v: unknown): BudRow {
  const o = asRecord(v);
  return { category: str(o.category), month: str(o.month).slice(0, 7), amount: Math.round(num(o.amount)) };
}
function sanitizeHabit(v: unknown): HabitRow {
  const o = asRecord(v);
  return {
    id: str(o.id),
    name: str(o.name).slice(0, 80),
    emoji: str(o.emoji).slice(0, 16),
    category: str(o.category, "General").slice(0, 40),
    priority: str(o.priority, "Medium").slice(0, 16),
    difficulty: str(o.difficulty, "Medium").slice(0, 16),
    habitType: str(o.habitType, "normal").slice(0, 16),
    target: Math.round(num(o.target)) || 1,
    unit: o.unit ? str(o.unit).slice(0, 16) : null,
    reminder: o.reminder ? str(o.reminder).slice(0, 16) : null,
    groupId: o.groupId ? str(o.groupId) : null,
    mini: o.mini ? str(o.mini).slice(0, 80) : null,
    afterId: o.afterId ? str(o.afterId).slice(0, 64) : null,
    restDays: typeof o.restDays === "string" && o.restDays ? o.restDays.slice(0, 3200) : null, /* v2.54 */
  };
}
function sanitizeSrc(v: unknown): SrcRow {
  const o = asRecord(v);
  return {
    id: str(o.id),
    name: str(o.name).slice(0, 60),
    type: str(o.type, "bank").slice(0, 16),
    emoji: str(o.emoji).slice(0, 16),
    initialBalance: Math.round(num(o.initialBalance)),
  };
}
/* v2.58 · tab Bugar — sanitizer latihan/asupan/tubuh: semua nilai dijepit
   ke rentang sehat, kind/meal dibatasi ke daftar yang dikenal UI. */
const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
const KINDS = ["beban", "jalan", "lari", "kombinasi"] as const;
const MEALS = ["pagi", "siang", "malam", "camilan"] as const;
function sanitizeSet(v: unknown): SetRow {
  const o = asRecord(v);
  return {
    id: str(o.id),
    exercise: str(o.exercise).slice(0, 60),
    reps: Math.round(clamp(num(o.reps), 0, 500)),
    weight: clamp(num(o.weight), 0, 1000),
  };
}
function sanitizeWorkout(v: unknown): WorkoutRow {
  const o = asRecord(v);
  const kindRaw = str(o.kind);
  const kind = (KINDS as readonly string[]).includes(kindRaw) ? kindRaw : "beban";
  const hasDist = kind !== "beban" && o.distance != null && num(o.distance) > 0;
  return {
    id: str(o.id),
    date: str(o.date).slice(0, 10),
    kind,
    duration: Math.round(clamp(num(o.duration), 0, 1440)),
    distance: hasDist ? clamp(num(o.distance), 0.1, 500) : null,
    note: str(o.note).slice(0, 200),
    sets: Array.isArray(o.sets)
      ? (o.sets as unknown[]).map(sanitizeSet).filter((s) => s.id && s.exercise && s.reps > 0 && s.weight > 0)
      : [],
  };
}
function sanitizeFood(v: unknown): FoodRow {
  const o = asRecord(v);
  const mealRaw = str(o.meal);
  const meal = (MEALS as readonly string[]).includes(mealRaw) ? mealRaw : "camilan";
  return {
    id: str(o.id),
    date: str(o.date).slice(0, 10),
    meal,
    name: str(o.name).slice(0, 80),
    kcal: Math.round(clamp(num(o.kcal), 0, 20000)),
    protein: clamp(num(o.protein), 0, 2000),
    carb: clamp(num(o.carb), 0, 2000),
    fat: clamp(num(o.fat), 0, 2000),
  };
}
function sanitizeBody(v: unknown): BodyRow {
  const o = asRecord(v);
  return {
    date: str(o.date).slice(0, 10),
    water: Math.round(clamp(num(o.water), 0, 40)),
    weight: o.weight != null && num(o.weight) > 0 ? clamp(num(o.weight), 20, 400) : null,
    recover: Math.round(clamp(num(o.recover), 0, 5)),
  };
}
function strList(v: unknown): string[] {
  return Array.isArray(v) ? v.map((x) => str(x)).filter(Boolean) : [];
}

function sanitizeOverlay(input: unknown): Overlay | null {
  const o = asRecord(input);
  if (typeof o.v !== "number") return null;
  const txList = (v: unknown): TxRow[] => (Array.isArray(v) ? v.map(sanitizeTx).filter((t) => t.id && t.date) : []);
  const budList = (v: unknown): BudRow[] => (Array.isArray(v) ? v.map(sanitizeBud).filter((b) => b.category && b.month) : []);
  const habitList = (v: unknown): HabitRow[] => (Array.isArray(v) ? v.map(sanitizeHabit).filter((h) => h.id && h.name) : []);
  const srcList = (v: unknown): SrcRow[] => (Array.isArray(v) ? v.map(sanitizeSrc).filter((s) => s.id && s.name) : []);
  const txMap: Record<string, TxRow> = {};
  for (const [k, v] of Object.entries(asRecord(o.txEdit))) {
    const t = sanitizeTx(v);
    if (k && t.date) txMap[k] = t;
  }
  const budMap: Record<string, BudRow> = {};
  for (const [k, v] of Object.entries(asRecord(o.budEdit))) {
    const b = sanitizeBud(v);
    if (k && b.category && b.month) budMap[k] = b;
  }
  const habitMap = asRecord(o.logAdd);
  const logAdd: Record<string, number | true> = {};
  for (const k of Object.keys(habitMap)) {
    const v = habitMap[k];
    logAdd[k] = typeof v === "number" ? num(v) : true;
  }
  const logDel: Record<string, true> = {};
  for (const k of Object.keys(asRecord(o.logDel))) logDel[k] = true;
  const catRename: Record<string, string> = {};
  for (const [k, v] of Object.entries(asRecord(o.catRename))) {
    if (k && str(v) && str(v) !== k) catRename[k] = str(v).slice(0, 40);
  }
  /* v2.35 · meta kebiasaan + identitas pengguna; v2.37 · meta diperluas
     (nama/emoji/kategori/jam/grup) — hanya kunci yang HADIR yang disimpan,
     null berarti "kosongkan" (lepas grup / hapus mini/jangkar). Kolom
     nullable diuji dengan "in" (bukan typeof) supaya null eksplisit dari
     klien tetap sampai sebagai perintah kosongkan. */
  const habitMeta: Record<string, HabitMetaRow> = {};
  for (const [k, v] of Object.entries(asRecord(o.habitMeta))) {
    if (!k) continue;
    const m = asRecord(v);
    const e: HabitMetaRow = {};
    if (typeof m.name === "string" && str(m.name)) e.name = str(m.name).slice(0, 80);
    if ("emoji" in m) e.emoji = m.emoji ? str(m.emoji).slice(0, 40) : null;
    if (typeof m.category === "string" && str(m.category)) e.category = str(m.category).slice(0, 40);
    if ("reminder" in m) e.reminder = m.reminder ? str(m.reminder).slice(0, 16) : null;
    if ("groupId" in m) e.groupId = m.groupId ? str(m.groupId).slice(0, 64) : null;
    if ("mini" in m) e.mini = m.mini ? str(m.mini).slice(0, 80) : null;
    if ("afterId" in m) e.afterId = m.afterId ? str(m.afterId).slice(0, 64) : null;
    /* v2.54 · jeda runtun aman — CSV tanggal YYYY-MM-DD; token tak valid
       dibuang, duplikat dirapatkan, urut, dibatasi 260 entri (5 tahun
       jeda mingguan). "" / null = kosongkan kolom. */
    if ("restDays" in m) {
      const rawRest = m.restDays;
      if (rawRest === null || rawRest === undefined || rawRest === "") e.restDays = null;
      else {
        const tokens = (Array.isArray(rawRest) ? rawRest.map((x) => str(x)) : String(rawRest).split(","))
          .map((t) => t.trim()).filter((t) => /^\d{4}-\d{2}-\d{2}$/.test(t));
        const uniq = [...new Set(tokens)].sort().slice(0, 260);
        e.restDays = uniq.length ? uniq.join(",") : null;
      }
    }
    if (Object.keys(e).length) habitMeta[k] = e;
  }
  const identityText = typeof o.identityText === "string" ? o.identityText.slice(0, 120) : null;
  /* v2.39 · check-in harian: peta tanggal → {mood,energy,sleep}; nilai
     diklem ke rentang wajar (mood/energi 1–5, tidur 0–16 jam), tanggal
     dipotong ke bentuk YYYY-MM-DD; tanggal tak valid dibuang. */
  const dailyLog: Record<string, DailyLogRow> = {};
  for (const [k, v] of Object.entries(asRecord(o.dailyLog))) {
    const date = k.slice(0, 10);
    const m = asRecord(v);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !m) continue;
    dailyLog[date] = {
      date,
      mood: Math.min(5, Math.max(0, Math.round(num(m.mood)))),
      energy: Math.min(5, Math.max(0, Math.round(num(m.energy)))),
      sleep: Math.min(16, Math.max(0, num(m.sleep))),
    };
  }
  return {
    txAdd: txList(o.txAdd), txEdit: txMap, txDel: strList(o.txDel),
    budAdd: budList(o.budAdd), budEdit: budMap, budDel: strList(o.budDel),
    habitAdd: habitList(o.habitAdd), habitDel: strList(o.habitDel),
    habitMeta, identityText,
    logAdd, logDel,
    srcAdd: srcList(o.srcAdd), srcEdit: (() => {
      const m: Record<string, SrcRow> = {};
      for (const [k, v] of Object.entries(asRecord(o.srcEdit))) {
        const s = sanitizeSrc(v);
        if (k && s.name) m[k] = s;
      }
      return m;
    })(), srcDel: strList(o.srcDel),
    catRename, catDel: strList(o.catDel),
    dailyLog,
    /* v2.58 · tab Bugar — jurnal latihan (set tertanam), asupan, tubuh,
       dan sasaran (JSON teks dibatasi 2000 karakter). */
    fitWAdd: (Array.isArray(o.fitWAdd) ? (o.fitWAdd as unknown[]).map(sanitizeWorkout).filter((w) => w.id && w.date) : []),
    fitWDel: strList(o.fitWDel),
    fitFAdd: (Array.isArray(o.fitFAdd) ? (o.fitFAdd as unknown[]).map(sanitizeFood).filter((f) => f.id && f.date) : []),
    fitFDel: strList(o.fitFDel),
    bodyLog: (() => {
      const m: Record<string, BodyRow> = {};
      for (const [k, v] of Object.entries(asRecord(o.bodyLog))) {
        const date = k.slice(0, 10);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
        const b = sanitizeBody({ ...(asRecord(v) as Record<string, unknown>), date });
        m[date] = b;
      }
      return m;
    })(),
    fitness: typeof o.fitness === "string" && o.fitness.trim().startsWith("{") ? o.fitness.slice(0, 2000) : null,
  };
}

/* kunci jurnal "habitId|date" dan "kategori|bulan" dipecah pada '|' pertama */
function splitKey(key: string): [string, string] {
  const i = key.indexOf("|");
  return i < 0 ? [key, ""] : [key.slice(0, i), key.slice(i + 1)];
}

export async function POST(request: Request) {
  const size = Number(request.headers.get("content-length") ?? 0);
  if (size > MAX_BODY_BYTES) {
    return NextResponse.json({ ok: false, error: "Lapisan catatan terlalu besar." }, { status: 413, headers: NO_STORE });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Body bukan JSON yang valid." }, { status: 400, headers: NO_STORE });
  }
  const b = asRecord(body);
  const overlay = sanitizeOverlay(b.overlay);
  if (!overlay) {
    return NextResponse.json({ ok: false, error: "Struktur lapisan catatan tidak dikenal." }, { status: 400, headers: NO_STORE });
  }

  let target: DbTarget;
  try {
    target = await getTarget();
  } catch {
    return NextResponse.json({ ok: false, error: "Sumber data belum siap." }, { status: 503, headers: NO_STORE });
  }

  try {
    const result = await applyOverlay(
      target.client,
      overlay,
      Array.isArray(b.budgets) ? (b.budgets as unknown[]) : null,
      Array.isArray(b.finCats) ? (b.finCats as unknown[]) : null,
    );
    return NextResponse.json({ ok: true, source: target.source, ...result }, { headers: NO_STORE });
  } catch (error) {
    console.error("[/api/rutina] gagal menerapkan catatan:", error);
    return NextResponse.json({ ok: false, error: "Gagal menyimpan ke database." }, { status: 502, headers: NO_STORE });
  }
}

async function applyOverlay(
  client: Client,
  ov: Overlay,
  budgets: unknown[] | null,
  finCats: unknown[] | null,
): Promise<{ applied: Record<string, number>; failed: { op: string; error: string }[] }> {
  const applied: Record<string, number> = {};
  const failed: { op: string; error: string }[] = [];
  const run = async (op: string, fn: () => Promise<unknown>) => {
    try {
      await fn();
      applied[op] = (applied[op] ?? 0) + 1;
    } catch (error) {
      failed.push({ op, error: String((error as Error)?.message ?? error).slice(0, 160) });
    }
  };
  const mapCat = (c: string): string => ov.catRename[c] || c;

  /* 1 · ganti nama kategori pada transaksi. (Daftar kategori & anggaran
        diganti penuh dari daftar final klien di bawah — tak perlu di-update.) */
  for (const [oldName, newName] of Object.entries(ov.catRename)) {
    await run("catRename", () => client.execute({
      sql: `UPDATE "Transaction" SET "category"=? WHERE "category"=?`,
      args: [newName, oldName],
    }));
  }

  /* 2 · transaksi: hapus → tambal → tambah */
  for (const id of ov.txDel) {
    await run("txDel", () => client.execute({ sql: `DELETE FROM "Transaction" WHERE "id"=?`, args: [id] }));
  }
  for (const [id, t] of Object.entries(ov.txEdit)) {
    if (!id || !t.date) continue;
    /* v2.37 · recurrence hanya ikut bila kuncinya hadir (jurnal lama tanpa
       kolom ini tak akan menimpa nilai berulang yang tersimpan) */
    const hasRec = t.recurrence !== undefined;
    await run("txEdit", () => client.execute({
      sql: hasRec
        ? `UPDATE "Transaction" SET "type"=?,"amount"=?,"category"=?,"sourceId"=?,"description"=?,"date"=?,"recurrence"=? WHERE "id"=?`
        : `UPDATE "Transaction" SET "type"=?,"amount"=?,"category"=?,"sourceId"=?,"description"=?,"date"=? WHERE "id"=?`,
      args: hasRec
        ? [t.type, t.amount, mapCat(t.category), t.sourceId, t.description, t.date, t.recurrence ?? null, id]
        : [t.type, t.amount, mapCat(t.category), t.sourceId, t.description, t.date, id],
    }));
  }
  for (const t of ov.txAdd) {
    await run("txAdd", async () => {
      await client.execute({ sql: `DELETE FROM "Transaction" WHERE "id"=?`, args: [t.id] });
      await insertRow(client, "Transaction", {
        id: t.id, type: t.type, amount: t.amount, category: mapCat(t.category),
        sourceId: t.sourceId, description: t.description, date: t.date,
        recurrence: t.recurrence ?? null, /* v2.37 · insertRow menyaring via columnsOf */
      });
    });
  }

  /* 3 · anggaran — daftar final dari klien menggantikan seluruh baris;
        menetralkan jerat kunci ganti-nama kategori (bulan tetap dipertahankan
        klien yang mengelola) */
  if (budgets) {
    await run("budgets", async () => {
      await client.execute(`DELETE FROM "WeeklyBudget"`);
      for (const raw of budgets) {
        const bb = sanitizeBud(raw);
        if (!bb.category || !bb.month) continue;
        await insertRow(client, "WeeklyBudget", { category: mapCat(bb.category), month: bb.month, amount: bb.amount });
      }
    });
  }

  /* 4 · kategori keuangan — daftar final, id deterministik dari nama */
  if (finCats) {
    await run("finCats", async () => {
      await client.execute(`DELETE FROM "FinanceCategory"`);
      let i = 0;
      for (const raw of finCats) {
        const o = asRecord(raw);
        const name = str(o.name).slice(0, 40);
        if (!name) continue;
        await insertRow(client, "FinanceCategory", {
          id: catRowId(name), name,
          emoji: str(o.emoji).slice(0, 16), color: str(o.color, "#64748B").slice(0, 16),
          type: str(o.type) === "income" ? "income" : "expense", sortOrder: i++,
        });
      }
    });
  }

  /* 5 · kebiasaan: hapus (arsipkan + bersihkan log) → tambah */
  for (const id of ov.habitDel) {
    await run("habitDel", async () => {
      await client.execute({ sql: `UPDATE "Habit" SET "isArchived"=1 WHERE "id"=?`, args: [id] });
      await client.execute({ sql: `DELETE FROM "HabitLog" WHERE "habitId"=?`, args: [id] });
    });
  }
  for (const h of ov.habitAdd) {
    await run("habitAdd", async () => {
      await client.execute({ sql: `DELETE FROM "Habit" WHERE "id"=?`, args: [h.id] });
      await insertRow(client, "Habit", {
        id: h.id, name: h.name, emoji: h.emoji, category: h.category, priority: h.priority,
        difficulty: h.difficulty, habitType: h.habitType, target: h.target, unit: h.unit,
        reminder: h.reminder, groupId: h.groupId, mini: h.mini, afterId: h.afterId,
        restDays: h.restDays ?? null,
        isActive: 1, isArchived: 0,
      });
    });
  }

  /* 6 · centang kebiasaan (kunci habitId|date) */
  for (const key of Object.keys(ov.logDel)) {
    const [habitId, date] = splitKey(key);
    if (!habitId || !date) continue;
    await run("logDel", () => client.execute({
      sql: `DELETE FROM "HabitLog" WHERE "habitId"=? AND "date"=?`,
      args: [habitId, date],
    }));
  }
  for (const [key, v] of Object.entries(ov.logAdd)) {
    const [habitId, date] = splitKey(key);
    if (!habitId || !date) continue;
    await run("logAdd", async () => {
      await client.execute({ sql: `DELETE FROM "HabitLog" WHERE "habitId"=? AND "date"=?`, args: [habitId, date] });
      await insertRow(client, "HabitLog", { habitId, date, completed: 1, value: typeof v === "number" ? v : 1 });
    });
  }

  /* 7 · dompet: arsipkan → tambal → tambah */
  for (const id of ov.srcDel) {
    await run("srcDel", () => client.execute({ sql: `UPDATE "FundSource" SET "isArchived"=1 WHERE "id"=?`, args: [id] }));
  }
  for (const [id, s] of Object.entries(ov.srcEdit)) {
    if (!id || !s.name) continue;
    await run("srcEdit", () => client.execute({
      sql: `UPDATE "FundSource" SET "name"=?,"type"=?,"emoji"=?,"initialBalance"=? WHERE "id"=?`,
      args: [s.name, s.type, s.emoji, s.initialBalance, id],
    }));
  }
  for (const s of ov.srcAdd) {
    await run("srcAdd", async () => {
      await client.execute({ sql: `DELETE FROM "FundSource" WHERE "id"=?`, args: [s.id] });
      await insertRow(client, "FundSource", {
        id: s.id, name: s.name, type: s.type, emoji: s.emoji,
        initialBalance: s.initialBalance, isArchived: 0,
      });
    });
  }

  /* 8 · v2.35 · Atomic Habits — meta kebiasaan lalu identitas pengguna
        (AppSettings satu baris; insert bila belum ada).
        v2.37 · SET dibangun dinamis dari kunci yang hadir: sunting lengkap
        (nama/emoji/kategori/jam/grup) maupun jurnal lama (mini/afterId saja)
        sama-sama aman — kolom tak disebut tak tersentuh. */
  for (const [id, meta] of Object.entries(ov.habitMeta)) {
    if (!id) continue;
    const cols: string[] = [];
    const args: InValue[] = [];
    if (meta.name) { cols.push('"name"=?'); args.push(meta.name); }
    if ("emoji" in meta) { cols.push('"emoji"=?'); args.push(meta.emoji ?? null); }
    if (meta.category) { cols.push('"category"=?'); args.push(meta.category); }
    if ("reminder" in meta) { cols.push('"reminder"=?'); args.push(meta.reminder ?? null); }
    if ("groupId" in meta) { cols.push('"groupId"=?'); args.push(meta.groupId ?? null); }
    if ("mini" in meta) { cols.push('"mini"=?'); args.push(meta.mini ?? null); }
    if ("afterId" in meta) { cols.push('"afterId"=?'); args.push(meta.afterId ?? null); }
    if ("restDays" in meta) { cols.push('"restDays"=?'); args.push(meta.restDays ?? null); } /* v2.54 */
    if (!cols.length) continue;
    await run("habitMeta", () => client.execute({
      sql: `UPDATE "Habit" SET ${cols.join(", ")} WHERE "id"=?`,
      args: [...args, id],
    }));
  }
  if (ov.identityText !== null) {
    await run("identitySet", async () => {
      const res = await client.execute({ sql: `UPDATE "AppSettings" SET "identityText"=?`, args: [ov.identityText] });
      if (!Number(res.rowsAffected ?? 0)) {
        await client.execute({ sql: `INSERT INTO "AppSettings"("identityText") VALUES (?)`, args: [ov.identityText] });
      }
    });
  }

  /* 9 · v2.39 · check-in harian (mood/energi/tidur) — kunci = tanggal,
        PRIMARY KEY pada tabel membuat INSERT OR REPLACE menjadi upsert
        idempoten: nilai terakhir menang, baris hari tetap satu. */
  for (const d of Object.values(ov.dailyLog)) {
    await run("dailyLog", () => client.execute({
      sql: `INSERT OR REPLACE INTO "DailyLog"("date","mood","energy","sleep") VALUES (?,?,?,?)`,
      args: [d.date, d.mood, d.energy, d.sleep],
    }));
  }

  /* 10 · v2.58 · BUGAR — latihan: hapus sesi (beserta setnya) → tambah.
         Id deterministik dari klien membuat putar ulang jurnal aman:
         DELETE dulu lalu INSERT = hasil akhir selalu baris terakhir. */
  for (const id of ov.fitWDel) {
    await run("fitWDel", async () => {
      await client.execute({ sql: `DELETE FROM "WorkoutSet" WHERE "workoutId"=?`, args: [id] });
      await client.execute({ sql: `DELETE FROM "Workout" WHERE "id"=?`, args: [id] });
    });
  }
  for (const w of ov.fitWAdd) {
    await run("fitWAdd", async () => {
      await client.execute({ sql: `DELETE FROM "WorkoutSet" WHERE "workoutId"=?`, args: [w.id] });
      await client.execute({ sql: `DELETE FROM "Workout" WHERE "id"=?`, args: [w.id] });
      await insertRow(client, "Workout", {
        id: w.id, date: w.date, kind: w.kind,
        duration: w.duration, distance: w.distance, note: w.note,
      });
      for (const s of w.sets) {
        await insertRow(client, "WorkoutSet", {
          id: s.id, workoutId: w.id, exercise: s.exercise, reps: s.reps, weight: s.weight,
        });
      }
    });
  }

  /* 11 · v2.58 · BUGAR — asupan kalori/makro: hapus → tambah */
  for (const id of ov.fitFDel) {
    await run("fitFDel", () => client.execute({ sql: `DELETE FROM "FoodLog" WHERE "id"=?`, args: [id] }));
  }
  for (const f of ov.fitFAdd) {
    await run("fitFAdd", async () => {
      await client.execute({ sql: `DELETE FROM "FoodLog" WHERE "id"=?`, args: [f.id] });
      await insertRow(client, "FoodLog", {
        id: f.id, date: f.date, meal: f.meal, name: f.name,
        kcal: f.kcal, protein: f.protein, carb: f.carb, fat: f.fat,
      });
    });
  }

  /* 12 · v2.58 · BUGAR — tubuh per tanggal (hidrasi/berat/pemulihan):
        PRIMARY KEY tanggal = upsert idempoten ala dailyLog. Baris hari
        menimpa penuh (klien selalu mengirim tiga nilai tergabung). */
  for (const b of Object.values(ov.bodyLog)) {
    await run("bodyLog", () => client.execute({
      sql: `INSERT OR REPLACE INTO "BodyLog"("date","water","weight","recover") VALUES (?,?,?,?)`,
      args: [b.date, b.water, b.weight, b.recover],
    }));
  }

  /* 13 · v2.58 · BUGAR — sasaran (JSON teks) di AppSettings satu baris;
        insert bila belum ada (pola identityText). */
  if (ov.fitness !== null) {
    await run("fitnessSet", async () => {
      const res = await client.execute({ sql: `UPDATE "AppSettings" SET "fitness"=?`, args: [ov.fitness] });
      if (!Number(res.rowsAffected ?? 0)) {
        await client.execute({ sql: `INSERT INTO "AppSettings"("fitness") VALUES (?)`, args: [ov.fitness] });
      }
    });
  }

  return { applied, failed };
}
