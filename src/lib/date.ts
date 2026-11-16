// Date helpers — semua logika "hari" memakai timezone Asia/Jakarta (WIB),
// terlepas dari timezone server.
//
// Konvensi penting:
// - `dateKey` = string "YYYY-MM-DD" (tanggal kalender di Jakarta).
// - dateKeyToDate(dateKey) = anchor 00:00 UTC — KHUSUS matematika kalender
//   (weekday, format label, minggu ISO, selisih hari).
// - dayStart(dateKey) = anchor 00:00 WIB (+07:00) — KHUSUS penyimpanan &
//   query rentang hari di database.

export const TZ = "Asia/Jakarta";
const OFFSET = "+07:00";

/** "YYYY-MM-DD" untuk suatu Date dalam WIB */
export function dateKeyInTZ(d: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/** Anchor 00:00 UTC dari dateKey — untuk matematika kalender murni */
export function dateKeyToDate(dateKey: string): Date {
  return new Date(`${dateKey}T00:00:00Z`);
}

function utcKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Anchor jam 00:00 WIB pada dateKey — untuk storage/query database */
export function dayStart(dateKey: string): Date {
  return new Date(`${dateKey}T00:00:00${OFFSET}`);
}

/** Awal hari ini (00:00 WIB) */
export function startOfToday(): Date {
  return dayStart(dateKeyInTZ());
}

/** 1 = Senin ... 7 = Minggu */
export function dayOfWeek(dateKey: string): number {
  const d = dateKeyToDate(dateKey);
  return ((d.getUTCDay() + 6) % 7) + 1;
}

export function addDays(dateKey: string, days: number): string {
  const d = dateKeyToDate(dateKey);
  d.setUTCDate(d.getUTCDate() + days);
  return utcKey(d);
}

export function daysBetween(aKey: string, bKey: string): number {
  const a = dateKeyToDate(aKey).getTime();
  const b = dateKeyToDate(bKey).getTime();
  return Math.round((b - a) / 86400000);
}

/** Label hari Indonesia */
export const DAY_NAMES = [
  "",
  "Senin",
  "Selasa",
  "Rabu",
  "Kamis",
  "Jumat",
  "Sabtu",
  "Minggu",
];

/** Label tanggal Indonesia singkat, mis. "Sen, 12 Mei" */
export function formatDateLabel(dateKey: string): string {
  return new Intl.DateTimeFormat("id-ID", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(dateKeyToDate(dateKey));
}

/** Label tanggal panjang, mis. "Senin, 12 Mei 2025" */
export function formatLongDateLabel(dateKey: string): string {
  return new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(dateKeyToDate(dateKey));
}

/** Nomor minggu ISO (YYYY-Www) untuk pengelompokan mingguan */
export function isoWeekKey(dateKey: string): string {
  const d = dateKeyToDate(dateKey);
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day); // Kamis minggu tsb
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

/** dateKey Senin dari minggu ISO */
export function weekKeyStartDate(weekKey: string): string {
  const [yearStr, weekStr] = weekKey.split("-W");
  const year = parseInt(yearStr, 10);
  const week = parseInt(weekStr, 10);
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Day = jan4.getUTCDay() || 7;
  const monday1 = new Date(jan4);
  monday1.setUTCDate(jan4.getUTCDate() + 1 - jan4Day); // Senin minggu-1
  const monday = new Date(monday1);
  monday.setUTCDate(monday1.getUTCDate() + (week - 1) * 7);
  return utcKey(monday);
}

/** Format pace detik/km -> "M:SS" */
export function formatPace(secPerKm: number): string {
  const m = Math.floor(secPerKm / 60);
  const s = Math.round(secPerKm % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Format durasi detik -> "MM:SS" atau "H:MM:SS" */
export function formatDuration(totalSec: number): string {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = Math.floor(totalSec % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** Pembulatan beban ke kelipatan 0.25 kg */
export function roundWeight(w: number): number {
  return Math.round(w * 4) / 4;
}
