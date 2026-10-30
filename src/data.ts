export type Task = { id: string; text: string; done: boolean };
export type Day = { tasks: Task[]; expenseCents: number };
export type Period = { name: string; color: string };
export type AppData = {
  version: 1;
  anchor: string;
  periods: Record<string, Period>;
  days: Record<string, Day>;
};
export const COLORS = ["#496b9b", "#4f7965", "#a66b3d", "#826693", "#9c6173"];
export const COLOR_NAMES = ["雾蓝", "松绿", "暖橙", "灰紫", "豆沙"];
const DAY_MS = 86_400_000;
export const emptyDay = (): Day => ({ tasks: [], expenseCents: 0 });
export function todayKey() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function validDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false;
  const time = Date.parse(`${value}T00:00:00Z`);
  return (
    Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value
  );
}
export function addDays(date: string, offset: number) {
  if (!validDate(date) || !Number.isSafeInteger(offset))
    throw new Error("请输入有效日期和整数天数。");
  const value = new Date(Date.parse(`${date}T00:00:00Z`) + offset * DAY_MS);
  if (!Number.isFinite(value.getTime()))
    throw new Error("日期超出了支持范围。");
  const result = value.toISOString().slice(0, 10);
  if (!validDate(result)) throw new Error("日期超出了支持范围。");
  return result;
}
export function daysBetween(a: string, b: string) {
  return Math.round(
    (Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY_MS,
  );
}
export const periodIndex = (anchor: string, date: string) =>
  Math.floor(daysBetween(anchor, date) / 7);
export function periodDates(anchor: string, index: number) {
  return Array.from({ length: 7 }, (_, i) => addDays(anchor, index * 7 + i));
}
export function defaultPeriod(index: number): Period {
  return {
    name: index >= 0 ? `第 ${index + 1} 阶段` : `起点前第 ${-index} 阶段`,
    color: COLORS[((index % COLORS.length) + COLORS.length) % COLORS.length],
  };
}
export const getPeriod = (data: AppData, index: number) =>
  data.periods[index] ?? defaultPeriod(index);
export function createData(
  anchor: string,
  name: string,
  color: string,
): AppData {
  if (!validDate(anchor)) throw new Error("请选择有效的起始日期。");
  return {
    version: 1,
    anchor,
    periods: { 0: { name: name.trim() || "第 1 阶段", color } },
    days: {},
  };
}
export function progress(tasks: Task[]) {
  const done = tasks.filter((task) => task.done).length;
  return {
    done,
    total: tasks.length,
    percent: tasks.length ? Math.round((done / tasks.length) * 100) : 0,
  };
}
export function spending(data: AppData, dates: string[]) {
  const total = dates.reduce(
    (sum, date) => sum + (data.days[date]?.expenseCents ?? 0),
    0,
  );
  return { total, average: Math.round(total / dates.length) };
}
export const money = (cents: number) =>
  (cents / 100).toLocaleString("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
export function parseMoney(value: string) {
  if (!/^\d+(\.\d{1,2})?$/.test(value.trim()))
    throw new Error("请输入非负金额，最多保留两位小数。");
  const [whole, decimal = ""] = value.trim().split(".");
  const cents = Number(whole) * 100 + Number(decimal.padEnd(2, "0"));
  if (!Number.isSafeInteger(cents) || cents > 999999999999)
    throw new Error("金额过大，请检查输入。");
  return cents;
}
// randomUUID requires HTTPS; getRandomValues also works for a phone's local-network preview.
export const newTask = (text: string): Task => ({
  id:
    crypto.randomUUID?.() ??
    Array.from(crypto.getRandomValues(new Uint8Array(16)), (value) =>
      value.toString(16).padStart(2, "0"),
    ).join(""),
  text: text.trim(),
  done: false,
});
export function updateDay(
  data: AppData,
  date: string,
  fn: (day: Day) => Day,
): AppData {
  const index = periodIndex(data.anchor, date);
  return {
    ...data,
    periods: { ...data.periods, [index]: getPeriod(data, index) },
    days: { ...data.days, [date]: fn(data.days[date] ?? emptyDay()) },
  };
}
export function dateRange(start: string, end: string) {
  if (!validDate(start) || !validDate(end))
    throw new Error("请选择完整、有效的日期范围。");
  const length = daysBetween(start, end) + 1;
  if (length < 1) throw new Error("结束日期不能早于开始日期。");
  if (length > 36600) throw new Error("日期范围过大，请分批操作。");
  return Array.from({ length }, (_, index) => addDays(start, index));
}
export function futureDates(base: string, count: number) {
  if (!Number.isSafeInteger(count) || count < 1)
    throw new Error("请输入大于 0 的整数天数。");
  return dateRange(addDays(base, 1), addDays(base, count));
}
export function parseTasks(text: string) {
  return text
    .split(/\r?\n/)
    .map((line) =>
      line
        .trim()
        .replace(/^(?:[-*•]\s*(?:\[[ xX]\]\s*)?|\d+[.、)）]\s*)/, "")
        .trim(),
    )
    .filter(Boolean);
}
export function applyTasks(
  data: AppData,
  dates: string[],
  texts: string[],
  mode: "append" | "replace",
): AppData {
  if (!texts.length) throw new Error("请先添加至少一条任务。");
  const result = {
    ...data,
    days: { ...data.days },
    periods: { ...data.periods },
  };
  for (const date of dates) {
    const old = result.days[date] ?? emptyDay();
    const tasks = texts.map(newTask);
    result.days[date] = {
      ...old,
      tasks: mode === "replace" ? tasks : [...old.tasks, ...tasks],
    };
    const index = periodIndex(data.anchor, date);
    result.periods[index] = getPeriod(data, index);
  }
  return result;
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
export function validateBackup(value: unknown): AppData {
  const fail = () => {
    throw new Error("备份格式不正确或版本不兼容，原有数据未修改。");
  };
  if (
    !isRecord(value) ||
    value.version !== 1 ||
    !validDate(value.anchor) ||
    !isRecord(value.periods) ||
    !isRecord(value.days)
  )
    return fail();
  const periods: Record<string, Period> = {};
  const days: Record<string, Day> = {};
  for (const [index, period] of Object.entries(value.periods)) {
    if (
      !/^-?\d+$/.test(index) ||
      !Number.isSafeInteger(Number(index)) ||
      !isRecord(period) ||
      typeof period.name !== "string" ||
      !period.name.trim() ||
      period.name.length > 80 ||
      typeof period.color !== "string" ||
      !/^#[\da-f]{6}$/i.test(period.color)
    )
      return fail();
    try {
      periodDates(value.anchor, Number(index));
    } catch {
      return fail();
    }
    periods[index] = { name: period.name, color: period.color };
  }
  for (const [date, day] of Object.entries(value.days)) {
    if (
      !validDate(date) ||
      !isRecord(day) ||
      !Array.isArray(day.tasks) ||
      !Number.isSafeInteger(day.expenseCents) ||
      Number(day.expenseCents) < 0 ||
      Number(day.expenseCents) > 999999999999
    )
      return fail();
    const ids = new Set<string>();
    const tasks = day.tasks.map((task: unknown) => {
      if (
        !isRecord(task) ||
        typeof task.id !== "string" ||
        !task.id ||
        ids.has(task.id) ||
        typeof task.text !== "string" ||
        !task.text.trim() ||
        typeof task.done !== "boolean"
      )
        return fail();
      ids.add(task.id);
      return { id: task.id, text: task.text, done: task.done };
    });
    days[date] = { tasks, expenseCents: day.expenseCents as number };
  }
  return { version: 1, anchor: value.anchor, periods, days };
}
export function exportBackup(data: AppData) {
  return JSON.stringify(
    { ...data, exportedAt: new Date().toISOString() },
    null,
    2,
  );
}
