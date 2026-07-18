import React, { useState, useEffect, useRef, useMemo, useCallback, useId } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  CheckCircle2,
  Circle,
  Play,
  Dumbbell,
  Calendar as CalendarIcon,
  Flame,
  ChevronRight,
} from "lucide-react";

/* ============================================================
   GYM WORKOUT TRACKER — premium single-file build
   React + TypeScript + Tailwind + Framer Motion. No backend.
   Progress persists to localStorage under "gym-progress".
   Exercises are loaded at runtime from /public/json/M&T.json,
   /public/json/T&F.json and /public/json/W&S.json via
   DAY_FILE_MAP — no exercise data is hardcoded in this file.

   Design notes:
   - Signature element: a triple-tone "activity ring" (à la
     Apple Fitness) that drives the hero and workout header,
     using a coral → violet → cyan sweep as the single
     recurring accent gradient across the whole app.
   - Background carries two soft blurred color blobs plus a
     faint grain overlay instead of a flat dark rectangle.
   - For the full effect, load a geometric display font (e.g.
     "Space Grotesk" or "Manrope") in your project's index.html
     or _document and set it as --font-display below; the app
     falls back gracefully to the system stack if you don't.
   ============================================================ */

/* ---------------------------------------------------------
   1. TYPES
   --------------------------------------------------------- */

interface Exercise {
  id: string;
  name: string;
  muscle: string;
  sets: number | string;
  reps: number | string;
  rest: number;
  gif: string; // path only — never hardcoded in JSX
  notes?: string;
}

interface MuscleGroup {
  name: string;
  exercises: Exercise[];
}

interface ExerciseProgress {
  completed: boolean;
  completedAt: string;
}

// gym-progress: { "2026-07-18": { "flat-bench": { completed: true, completedAt: "18:21" } } }
type ProgressStore = Record<string, Record<string, ExerciseProgress>>;

/* ---------------------------------------------------------
   2. WORKOUT DATA — loaded dynamically from /public/json/
   --------------------------------------------------------- */

// Maps each weekday to the JSON file that holds its exercises.
// Files live in /public/json/ and are served from the site root.
const DAY_FILE_MAP: Record<string, string | null> = {
  Sunday: null, // Rest Day
  Monday: "M&T.json",
  Tuesday: "T&F.json",
  Wednesday: "W&S.json",
  Thursday: "M&T.json",
  Friday: "T&F.json",
  Saturday: "W&S.json",
};

const JSON_BASE = "/json/";

// Groups a flat exercise array by its "muscle" field, preserving
// the order muscles first appear in the JSON.
function groupByMuscle(exercises: Exercise[]): MuscleGroup[] {
  const order: string[] = [];
  const map = new Map<string, Exercise[]>();
  for (const ex of exercises) {
    const key = ex.muscle || "Other";
    if (!map.has(key)) {
      map.set(key, []);
      order.push(key);
    }
    map.get(key)!.push(ex);
  }
  return order.map((name) => ({ name, exercises: map.get(name)! }));
}

const STORAGE_KEY = "gym-progress";

/* Recurring accent gradient stops — the app's single signature sweep */
const ACCENT = { from: "#FB7185", mid: "#A78BFA", to: "#38BDF8" };
const GROUP_PALETTE = ["#FB7185", "#A78BFA", "#38BDF8", "#FBBF24", "#34D399"];

/* ---------------------------------------------------------
   3. DATE HELPERS
   --------------------------------------------------------- */

const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getWeekdayName(date: Date): string {
  return WEEKDAY_NAMES[date.getDay()];
}

function isSameDay(a: Date, b: Date): boolean {
  return toDateKey(a) === toDateKey(b);
}

function stripTime(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

/* ---------------------------------------------------------
   4. LOCAL STORAGE HELPERS
   --------------------------------------------------------- */

function loadProgress(): ProgressStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ProgressStore) : {};
  } catch {
    return {};
  }
}

function persistProgress(store: ProgressStore) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // localStorage unavailable — fail silently, app still works in-session
  }
}

function dayCompletion(date: Date, progress: ProgressStore, fileCache: Record<string, Exercise[]>): { total: number; done: number } {
  const file = DAY_FILE_MAP[getWeekdayName(date)];
  if (!file) return { total: 0, done: 0 };
  const exercises = fileCache[file] ?? [];
  const dayProgress = progress[toDateKey(date)] ?? {};
  const done = exercises.filter((ex) => dayProgress[ex.id]?.completed).length;
  return { total: exercises.length, done };
}

function computeStreak(progress: ProgressStore, today: Date, fileCache: Record<string, Exercise[]>): number {
  let streak = 0;
  let cursor = stripTime(today);
  for (let i = 0; i < 400; i++) {
    const file = DAY_FILE_MAP[getWeekdayName(cursor)];
    if (file) {
      const { total, done } = dayCompletion(cursor, progress, fileCache);
      const complete = total > 0 && done === total;
      if (complete) {
        streak++;
      } else if (!isSameDay(cursor, today)) {
        break;
      }
    }
    cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() - 1);
  }
  return streak;
}

/* ---------------------------------------------------------
   5. SIGNATURE ELEMENT — activity ring
   --------------------------------------------------------- */

function ActivityRing({
  percent,
  size = 128,
  strokeWidth = 12,
  children,
}: {
  percent: number;
  size?: number;
  strokeWidth?: number;
  children?: React.ReactNode;
}) {
  const gradientId = useId();
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.min(100, Math.max(0, percent)) / 100);

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={ACCENT.from} />
            <stop offset="55%" stopColor={ACCENT.mid} />
            <stop offset="100%" stopColor={ACCENT.to} />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={radius} stroke="rgba(255,255,255,0.07)" strokeWidth={strokeWidth} fill="none" />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={`url(#${gradientId})`}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  );
}

/* ---------------------------------------------------------
   6. SMALL UI PIECES
   --------------------------------------------------------- */

type DayStatus = "today-done" | "today-pending" | "completed" | "missed" | "future" | "rest";

function CalendarDay({
  date,
  status,
  isSelected,
  onSelect,
}: {
  date: Date;
  status: DayStatus;
  isSelected: boolean;
  onSelect: (d: Date) => void;
}) {
  const base = "relative flex h-9 w-9 items-center justify-center rounded-full text-[13px] font-semibold transition-all duration-200";

  const styleMap: Record<DayStatus, string> = {
    "today-done": "text-white shadow-[0_0_0_2px_rgba(255,255,255,0.85)]",
    "today-pending": "text-white shadow-[0_0_0_2px_rgba(255,255,255,0.55)]",
    completed: "text-white",
    missed: "text-rose-200",
    future: "text-slate-500",
    rest: "text-slate-600",
  };

  const bgStyle: React.CSSProperties =
    status === "completed" || status === "today-done"
      ? { background: `linear-gradient(135deg, ${ACCENT.from}, ${ACCENT.mid} 60%, ${ACCENT.to})`, boxShadow: "0 4px 14px -2px rgba(167,139,250,0.45)" }
      : status === "missed"
      ? { background: "rgba(244,63,94,0.14)", border: "1px solid rgba(244,63,94,0.4)" }
      : status === "today-pending"
      ? { background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.25)" }
      : {};

  return (
    <motion.button
      whileTap={{ scale: 0.85 }}
      onClick={() => onSelect(date)}
      className={`${base} ${styleMap[status]} ${isSelected ? "ring-2 ring-white/60 ring-offset-2 ring-offset-[#0B0F1C]" : ""}`}
      style={bgStyle}
    >
      {date.getDate()}
    </motion.button>
  );
}

function ConfettiBurst() {
  const colors = [ACCENT.from, ACCENT.mid, ACCENT.to, "#FBBF24", "#34D399"];
  const particles = Array.from({ length: 16 });
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {particles.map((_, i) => {
        const color = colors[i % colors.length];
        const left = 6 + ((i * 61) % 88);
        const delay = (i % 6) * 0.04;
        const drift = ((i % 5) - 2) * 14;
        return (
          <motion.span
            key={i}
            className="absolute top-1/2 h-1.5 w-1.5 rounded-sm"
            style={{ left: `${left}%`, backgroundColor: color }}
            initial={{ y: 0, x: 0, opacity: 1, rotate: 0, scale: 1 }}
            animate={{ y: -54 - (i % 4) * 10, x: drift, opacity: 0, rotate: (i % 2 === 0 ? 1 : -1) * 240, scale: 0.6 }}
            transition={{ duration: 1.1, delay, ease: "easeOut" }}
          />
        );
      })}
    </div>
  );
}

/* ---------------------------------------------------------
   7. MAIN APP
   --------------------------------------------------------- */

export default function App() {
  const today = useMemo(() => stripTime(new Date()), []);
  const [view, setView] = useState<"home" | "workout">("home");
  const [selectedDate, setSelectedDate] = useState<Date>(today);
  const [visibleMonth, setVisibleMonth] = useState<Date>(new Date(today.getFullYear(), today.getMonth(), 1));
  const [progress, setProgress] = useState<ProgressStore>({});
  const [openGifId, setOpenGifId] = useState<string | null>(null);
  const [fileCache, setFileCache] = useState<Record<string, Exercise[]>>({});
  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    setProgress(loadProgress());
  }, []);

  // Detects today's workout file on load, and fetches every distinct
  // JSON file referenced by DAY_FILE_MAP so switching calendar days
  // (and computing calendar status for other days) never needs a
  // page refresh.
  useEffect(() => {
    let cancelled = false;
    async function loadWorkoutFiles() {
      const files = Array.from(new Set(Object.values(DAY_FILE_MAP).filter(Boolean))) as string[];
      const entries = await Promise.all(
        files.map(async (file) => {
          try {
            const res = await fetch(`${JSON_BASE}${file}`);
            const data = await res.json();

            const exercises: Exercise[] = data.workout || [];
          return [file, exercises] as const;
          } catch {
            return [file, []] as const;
          }
        })
      );
      if (!cancelled) setFileCache(Object.fromEntries(entries));
    }
    loadWorkoutFiles();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    function handleOutsideClick(e: MouseEvent) {
      if (!openGifId) return;
      const node = rowRefs.current[openGifId];
      if (node && !node.contains(e.target as Node)) {
        setOpenGifId(null);
      }
    }
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [openGifId]);

  const selectedWeekday = getWeekdayName(selectedDate);
  const selectedFile = DAY_FILE_MAP[selectedWeekday];
  const selectedDateKey = toDateKey(selectedDate);

  const allExercises = useMemo(() => {
    if (!selectedFile) return [];
    return fileCache[selectedFile] ?? [];
  }, [selectedFile, fileCache]);

  const groupedMuscles = useMemo(() => groupByMuscle(allExercises), [allExercises]);
  const isRestDay = !selectedFile;
  const workoutTitle = groupedMuscles.map((g) => g.name).join(" + ");

  const completedForSelected = progress[selectedDateKey] ?? {};
  const completedCount = allExercises.filter((ex) => completedForSelected[ex.id]?.completed).length;
  const totalCount = allExercises.length;
  const percent = totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100);
  const allDone = totalCount > 0 && completedCount === totalCount;
  const streak = useMemo(() => computeStreak(progress, today, fileCache), [progress, today, fileCache]);
  const isEditable = isSameDay(selectedDate, today); // only today's checkboxes can be toggled

  const toggleExercise = useCallback(
    (exerciseId: string) => {
      if (!isEditable) return; // past and future days are view-only
      setProgress((prev) => {
        const dayEntry = { ...(prev[selectedDateKey] ?? {}) };
        const wasCompleted = dayEntry[exerciseId]?.completed ?? false;
        const now = new Date();
        const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

        if (wasCompleted) {
          delete dayEntry[exerciseId];
        } else {
          dayEntry[exerciseId] = { completed: true, completedAt: timeStr };
        }

        const next: ProgressStore = { ...prev, [selectedDateKey]: dayEntry };
        persistProgress(next);
        return next;
      });
    },
    [selectedDateKey, isEditable]
  );

  function dayStatus(date: Date): DayStatus {
    const file = DAY_FILE_MAP[getWeekdayName(date)];
    if (!file) return "rest";
    const { total, done } = dayCompletion(date, progress, fileCache);
    const isComplete = total > 0 && done === total;

    if (isSameDay(date, today)) return isComplete ? "today-done" : "today-pending";
    if (date > today) return "future";
    return isComplete ? "completed" : "missed";
  }

  const calendarCells = useMemo(() => {
    const year = visibleMonth.getFullYear();
    const month = visibleMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const leadingBlanks = firstDay.getDay();

    const cells: (Date | null)[] = [];
    for (let i = 0; i < leadingBlanks; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
    return cells;
  }, [visibleMonth]);

  const monthLabel = visibleMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  function openDay(date: Date) {
    setSelectedDate(stripTime(date));
    setView("workout");
    setOpenGifId(null);
  }

  return (
    <div
      className="min-h-screen w-full text-slate-100"
      style={{ background: "#090C14", fontFamily: "var(--font-display, 'Manrope', 'Inter', system-ui, sans-serif)" }}
    >
      {/* Ambient background blobs + grain */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div
          className="absolute -top-24 -left-16 h-72 w-72 rounded-full opacity-30 blur-[90px]"
          style={{ background: ACCENT.mid }}
        />
        <div
          className="absolute top-40 -right-20 h-64 w-64 rounded-full opacity-20 blur-[100px]"
          style={{ background: ACCENT.from }}
        />
        <div
          className="absolute bottom-0 left-10 h-56 w-56 rounded-full opacity-20 blur-[100px]"
          style={{ background: ACCENT.to }}
        />
        <svg className="absolute inset-0 h-full w-full opacity-[0.035] mix-blend-overlay">
          <filter id="grain">
            <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch" />
          </filter>
          <rect width="100%" height="100%" filter="url(#grain)" />
        </svg>
      </div>

      <div className="relative mx-auto w-full max-w-[480px] px-4 pb-10">
        <AnimatePresence mode="wait">
          {view === "home" ? (
            <motion.div
              key="home"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            >
              {/* HEADER */}
              <div className="pb-2 pt-8">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[13px] font-medium text-slate-400">{greeting()}</p>
                    <h1 className="mt-0.5 text-[26px] font-extrabold tracking-tight text-white">Let's train</h1>
                  </div>
                  <div className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 backdrop-blur">
                    <Flame size={15} className="text-amber-400" fill="currentColor" fillOpacity={0.25} />
                    <span className="text-sm font-bold tabular-nums text-amber-300">{streak}</span>
                  </div>
                </div>
              </div>

              {/* HERO RING CARD */}
              <motion.div
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: 0.05 }}
                className="relative mt-5 overflow-hidden rounded-[28px] border border-white/[0.06] bg-white/[0.035] p-6 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.6)] backdrop-blur-xl"
              >
                <div className="flex items-center gap-5">
                  <ActivityRing percent={percent} size={104} strokeWidth={10}>
                    <span className="text-xl font-extrabold tabular-nums text-white">{percent}%</span>
                    <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400">done</span>
                  </ActivityRing>

                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">
                      {isSameDay(today, selectedDate) ? "Today · " + selectedWeekday : selectedDate.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
                    </p>
                    <h2 className="mt-1 truncate text-lg font-bold text-white">{isRestDay ? "Rest Day" : workoutTitle}</h2>
                    {!isRestDay ? (
                      <p className="mt-0.5 text-[13px] text-slate-400">
                        {completedCount} / {totalCount} exercises
                      </p>
                    ) : (
                      <p className="mt-0.5 text-[13px] text-slate-400">Recover and refuel</p>
                    )}
                  </div>
                </div>

                {!isRestDay && (
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={() => setView("workout")}
                    className="relative mt-6 flex w-full items-center justify-center gap-2 overflow-hidden rounded-2xl py-4 text-[15px] font-bold text-white shadow-[0_10px_30px_-8px_rgba(167,139,250,0.55)] active:brightness-95"
                    style={{ background: `linear-gradient(120deg, ${ACCENT.from}, ${ACCENT.mid} 55%, ${ACCENT.to})` }}
                  >
                    <motion.span
                      className="absolute inset-0 -translate-x-full bg-white/25"
                      animate={{ x: ["-120%", "220%"] }}
                      transition={{ duration: 2.4, repeat: Infinity, repeatDelay: 1.6, ease: "easeInOut" }}
                      style={{ width: "40%", skewX: -20 }}
                    />
                    <Play size={17} fill="white" className="relative" />
                    <span className="relative">{completedCount > 0 ? "Continue Workout" : "Start Workout"}</span>
                  </motion.button>
                )}
              </motion.div>

              {/* CALENDAR */}
              <motion.div
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: 0.1 }}
                className="mt-4 rounded-[28px] border border-white/[0.06] bg-white/[0.035] p-5 backdrop-blur-xl"
              >
                <div className="mb-4 flex items-center justify-between">
                  <button
                    onClick={() => setVisibleMonth(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1))}
                    className="rounded-full p-1.5 text-slate-400 transition hover:bg-white/5 hover:text-white"
                  >
                    <ArrowLeft size={16} />
                  </button>
                  <div className="flex items-center gap-2 text-[13px] font-bold tracking-wide text-white">
                    <CalendarIcon size={14} className="text-violet-300" />
                    {monthLabel}
                  </div>
                  <button
                    onClick={() => setVisibleMonth(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1))}
                    className="rounded-full p-1.5 text-slate-400 transition hover:bg-white/5 hover:text-white"
                  >
                    <ArrowLeft size={16} className="rotate-180" />
                  </button>
                </div>

                <div className="mb-2 grid grid-cols-7 gap-y-2 text-center text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
                    <div key={i}>{d}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7 place-items-center gap-y-2.5">
                  {calendarCells.map((date, idx) =>
                    date ? (
                      <CalendarDay key={idx} date={date} status={dayStatus(date)} isSelected={isSameDay(date, selectedDate)} onSelect={openDay} />
                    ) : (
                      <div key={idx} />
                    )
                  )}
                </div>

                <div className="mt-5 flex items-center justify-center gap-4 text-[11px] text-slate-400">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full" style={{ background: `linear-gradient(135deg, ${ACCENT.from}, ${ACCENT.to})` }} />
                    Completed
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full border border-rose-400/60 bg-rose-500/20" />
                    Missed
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-slate-600" />
                    Upcoming
                  </span>
                </div>
              </motion.div>
            </motion.div>
          ) : (
            <motion.div
              key="workout"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            >
              {/* WORKOUT HEADER */}
              <div className="pb-2 pt-8">
                <button
                  onClick={() => setView("home")}
                  className="mb-5 flex items-center gap-1.5 text-[13px] font-semibold text-slate-300 transition hover:text-white"
                >
                  <ArrowLeft size={16} />
                  Back
                </button>

                <div className="flex items-center gap-5 rounded-[28px] border border-white/[0.06] bg-white/[0.035] p-5 backdrop-blur-xl">
                  <ActivityRing percent={percent} size={84} strokeWidth={8}>
                    <span className="text-sm font-extrabold tabular-nums text-white">{completedCount}/{totalCount}</span>
                  </ActivityRing>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-violet-300">{selectedWeekday}</p>
                    <h1 className="mt-0.5 truncate text-xl font-extrabold text-white">{isRestDay ? "Rest Day" : workoutTitle}</h1>
                    {!isRestDay && <p className="mt-0.5 text-[13px] text-slate-400">{percent}% complete</p>}
                  </div>
                </div>
              </div>

              {/* COMPLETED BANNER */}
              <AnimatePresence>
                {allDone && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.85, y: -8 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.85 }}
                    transition={{ type: "spring", stiffness: 320, damping: 18 }}
                    className="relative mb-5 overflow-hidden rounded-[24px] px-5 py-4 text-center shadow-[0_10px_30px_-10px_rgba(52,211,153,0.5)]"
                    style={{ background: "linear-gradient(120deg, #34D399, #22D3EE)" }}
                  >
                    <ConfettiBurst />
                    <p className="text-[15px] font-extrabold text-white">🎉 Workout Completed</p>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* EXERCISES */}
              {!isRestDay ? (
                groupedMuscles.map((muscle, groupIdx) => {
                  const groupColor = GROUP_PALETTE[groupIdx % GROUP_PALETTE.length];
                  return (
                    <div key={muscle.name} className="mb-6">
                      <div className="mb-3 flex items-center gap-2 px-1">
                        <span className="h-1.5 w-1.5 rounded-full" style={{ background: groupColor }} />
                        <h3 className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">{muscle.name}</h3>
                      </div>
                      <div className="space-y-2.5">
                        {muscle.exercises.map((exercise) => {
                          const isDone = completedForSelected[exercise.id]?.completed ?? false;
                          const isOpen = openGifId === exercise.id;

                          return (
                            <div
                              key={exercise.id}
                              ref={(el) => (rowRefs.current[exercise.id] = el)}
                              className="overflow-hidden rounded-[20px] border border-white/[0.06] bg-white/[0.035] backdrop-blur-xl transition-all duration-200 hover:border-white/[0.12] hover:bg-white/[0.055]"
                              style={isDone ? { borderColor: `${groupColor}55` } : undefined}
                            >
                              <div className="flex items-center gap-3 py-3.5 pl-3.5 pr-4">
                                <span className="h-8 w-1 shrink-0 rounded-full" style={{ background: isDone ? groupColor : "rgba(255,255,255,0.08)" }} />

                                <motion.button
                                  whileTap={isEditable ? { scale: 0.8 } : undefined}
                                  onClick={() => toggleExercise(exercise.id)}
                                  disabled={!isEditable}
                                  className={`shrink-0 ${!isEditable ? "cursor-not-allowed opacity-50" : ""}`}
                                  aria-label={isDone ? "Mark incomplete" : "Mark complete"}
                                >
                                  <motion.div animate={{ scale: isDone && isEditable ? [1, 1.35, 1] : 1 }} transition={{ duration: 0.32 }}>
                                    {isDone ? (
                                      <CheckCircle2 size={23} style={{ color: groupColor }} />
                                    ) : (
                                      <Circle size={23} className="text-slate-500" />
                                    )}
                                  </motion.div>
                                </motion.button>

                                <motion.button
                                  whileTap={{ scale: 0.98 }}
                                  onClick={() => setOpenGifId(isOpen ? null : exercise.id)}
                                  className={`flex flex-1 items-center justify-between text-left text-[14px] font-semibold transition-colors ${
                                    isDone ? "text-slate-500 line-through" : "text-slate-100"
                                  }`}
                                >
                                  {exercise.name}
                                  <motion.span animate={{ rotate: isOpen ? 90 : 0 }} transition={{ duration: 0.2 }}>
                                    <ChevronRight size={16} className="text-slate-500" />
                                  </motion.span>
                                </motion.button>
                              </div>

                              <AnimatePresence initial={false}>
                                {isOpen && (
                                  <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: "auto", opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.25, ease: "easeInOut" }}
                                    className="px-4 pb-4"
                                  >
                                    <div className="relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-2xl border border-white/[0.06] bg-black/40">
                                      <img
                                        src={exercise.gif}
                                        alt={exercise.name}
                                        className="h-full w-full object-cover"
                                        onError={(e) => {
                                          const target = e.currentTarget;
                                          target.style.display = "none";
                                          const fallback = target.nextElementSibling as HTMLElement | null;
                                          if (fallback) fallback.style.display = "flex";
                                        }}
                                      />
                                      <div className="hidden h-full w-full flex-col items-center justify-center gap-2 text-slate-500">
                                        <Play size={26} />
                                        <span className="text-[11px]">GIF preview unavailable</span>
                                      </div>
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="flex flex-col items-center gap-2 rounded-[24px] border border-white/[0.06] bg-white/[0.035] p-8 text-center backdrop-blur-xl">
                  <Dumbbell size={22} className="text-slate-500" />
                  <p className="text-[13px] text-slate-400">Nothing scheduled today — enjoy the rest.</p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}