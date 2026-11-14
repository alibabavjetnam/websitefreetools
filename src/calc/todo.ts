/** Việc cần làm và đồng hồ Pomodoro. Phần thuần, không DOM. */

export type Priority = 0 | 1 | 2; // 0 thường, 1 quan trọng, 2 gấp
export interface Task { id: string; text: string; done: boolean; priority: Priority; due: string; created: number; pomos: number }
export type Filter = 'all' | 'active' | 'done' | 'today';

export const newTaskId = (): string => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3);
export const makeTask = (text: string, priority: Priority = 0, due = ''): Task => ({ id: newTaskId(), text: text.trim(), done: false, priority, due, created: Date.now(), pomos: 0 });

/** yyyy-mm-dd theo giờ máy */
export const dayKey = (d: Date = new Date()): string => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function filterTasks(tasks: Task[], f: Filter, today: string): Task[] {
  const list = tasks.filter((t) => (f === 'all' ? true : f === 'active' ? !t.done : f === 'done' ? t.done : !t.done && !!t.due && t.due <= today));
  // chưa xong lên trước; rồi theo mức ưu tiên, hạn, thời điểm tạo
  return list.sort((a, b) => Number(a.done) - Number(b.done) || b.priority - a.priority || (a.due || '9999').localeCompare(b.due || '9999') || a.created - b.created);
}

export const isOverdue = (t: Task, today: string): boolean => !t.done && !!t.due && t.due < today;

export type Phase = 'work' | 'short' | 'long';
export interface PomoConfig { work: number; short: number; long: number; every: number }
export const DEFAULT_POMO: PomoConfig = { work: 25, short: 5, long: 15, every: 4 };

export const clampCfg = (c: PomoConfig): PomoConfig => {
  const n = (v: number, lo: number, hi: number, d: number) => (Number.isFinite(v) ? Math.min(hi, Math.max(lo, Math.round(v))) : d);
  return { work: n(c.work, 1, 180, 25), short: n(c.short, 1, 60, 5), long: n(c.long, 1, 120, 15), every: n(c.every, 2, 12, 4) };
};

export const phaseSeconds = (p: Phase, c: PomoConfig): number => (p === 'work' ? c.work : p === 'short' ? c.short : c.long) * 60;

/** Sau khi xong một giai đoạn: `completedWork` là số phiên làm việc đã xong (đã gồm phiên vừa xong nếu là work) */
export function nextPhase(p: Phase, completedWork: number, c: PomoConfig): Phase {
  if (p !== 'work') return 'work';
  return completedWork > 0 && completedWork % c.every === 0 ? 'long' : 'short';
}

export const mmss = (sec: number): string => {
  const s = Math.max(0, Math.ceil(sec));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};
