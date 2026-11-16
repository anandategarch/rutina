// Shared DTO types — kontrak antara API routes dan frontend Rutina.

export type ExerciseType = "STRENGTH" | "CARDIO";
export type SessionType = "STRENGTH" | "CARDIO" | "RECOVERY";
export type ReadinessLevel = "PRIME" | "GOOD" | "MODERATE" | "LOW";
export type CoachMessageType =
  | "CELEBRATION"
  | "WARNING"
  | "SUGGESTION"
  | "INFO"
  | "DELOAD";

export interface ExerciseDTO {
  id: string;
  name: string;
  type: ExerciseType;
  muscleGroup: string;
  equipment: string | null;
  tempo: string | null;
  incrementKg: number;
  cue: string | null;
}

export interface PerformedSetDTO {
  setNumber: number;
  weightKg: number;
  reps: number;
  rpe: number | null;
  isWarmup: boolean;
  distanceKm: number | null;
  durationSec: number | null;
}

export interface LastPerformanceDTO {
  dateKey: string;
  dateLabel: string;
  summary: string; // mis. "3×10 @ 37.5 kg" atau "5.0 km · 29:41 (5:56/km)"
  sets: PerformedSetDTO[];
}

export interface PlanItemDTO {
  id: string;
  order: number;
  exercise: ExerciseDTO;
  targetSets: number;
  targetMinReps: number;
  targetMaxReps: number;
  targetWeightKg: number; // sudah termasuk penyesuaian readiness/deload
  baseWeightKg: number; // target murni dari plan
  restSeconds: number;
  targetDistanceKm: number | null;
  targetPaceSecPerKm: number | null;
  adjusted: boolean; // apakah target disesuaikan hari ini
  adjustmentNote: string | null;
  progressionNote: string | null; // penjelasan coach kenapa target naik/tetap
  lastPerformance: LastPerformanceDTO | null;
}

export interface ReadinessDTO {
  dateKey: string;
  done: boolean;
  sleepHours: number;
  soreness: number;
  stress: number;
  energy: number;
  score: number; // 0-100
  level: ReadinessLevel;
  levelLabel: string;
  recommendation: string;
}

export interface CoachMessageDTO {
  id: string;
  type: CoachMessageType;
  title: string;
  body: string;
  severity: "info" | "warning" | "success";
  dateKey: string;
  dateLabel: string;
  read: boolean;
}

export interface PlanResponse {
  dateKey: string;
  dayOfWeek: number; // 1-7
  dayName: string;
  dateLabel: string;
  sessionTitle: string;
  sessionType: SessionType;
  isRestDay: boolean;
  readiness: ReadinessDTO; // done=false jika belum check-in
  deload: {
    active: boolean;
    daysLeft: number;
    endDateKey: string | null;
  };
  items: PlanItemDTO[];
  messages: CoachMessageDTO[]; // unread + 7 hari terakhir
  unreadCount: number;
  streak: {
    weeks: number;
    thisWeekSessions: number;
    weeklyGoal: number;
  };
  todaySessions: SessionSummaryDTO[]; // sesi yang sudah ada hari ini
}

export interface SetLogDTO extends PerformedSetDTO {
  id: string;
  exerciseId: string;
  exerciseName: string;
  exerciseType: ExerciseType;
  createdAt: string;
}

export interface SessionDTO {
  id: string;
  dateKey: string;
  dateLabel: string;
  type: SessionType;
  title: string;
  status: string;
  notes: string | null;
  readinessScore: number | null;
  totalVolumeKg: number;
  durationMin: number | null;
  sets: SetLogDTO[];
}

export interface SessionSummaryDTO {
  id: string;
  dateKey: string;
  dateLabel: string;
  type: SessionType;
  title: string;
  status: string;
  totalVolumeKg: number;
  durationMin: number | null;
  setCount: number;
}

export interface CompleteSessionResult {
  session: SessionDTO;
  prs: { exerciseName: string; weightKg: number; reps: number; estimated1RM: number; isNew: boolean }[];
  progressions: { exerciseName: string; note: string; type: CoachMessageType }[];
  volumeKg: number;
}

export interface ProgressResponse {
  weeklyVolume: {
    weekKey: string;
    weekLabel: string; // mis. "12 Mei"
    volume: number;
    sessions: number;
    cardioKm: number;
  }[];
  exercises: {
    id: string;
    name: string;
    muscleGroup: string;
    type: ExerciseType;
    history: { dateKey: string; dateLabel: string; e1RM: number; volume: number }[];
    currentE1RM: number | null;
    plateau: boolean;
  }[];
  prs: {
    id: string;
    exerciseName: string;
    muscleGroup: string;
    weightKg: number;
    reps: number;
    estimated1RM: number;
    dateKey: string;
    dateLabel: string;
  }[];
  plateaus: { exerciseId: string; exerciseName: string; detail: string }[];
  stats: {
    totalSessions: number;
    totalVolumeKg: number;
    streakWeeks: number;
    avgReadiness7d: number | null;
    weeklyGoal: number;
    thisWeekSessions: number;
  };
  deload: { active: boolean; daysLeft: number; endDateKey: string | null };
}

export interface ChatMessageDTO {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  timeLabel: string;
}
