import { progress, type AppData } from "./data.ts";

export function validMonth(month: string) {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(month);
}

export function shiftMonth(month: string, offset: number) {
  if (!validMonth(month) || !Number.isSafeInteger(offset))
    throw new Error("月份无效。");
  const serial =
    Number(month.slice(0, 4)) * 12 + Number(month.slice(5)) - 1 + offset;
  if (serial < 0 || serial >= 10000 * 12) throw new Error("月份超出支持范围。");
  return `${String(Math.floor(serial / 12)).padStart(4, "0")}-${String((serial % 12) + 1).padStart(2, "0")}`;
}

export function monthDates(month: string) {
  if (!validMonth(month)) throw new Error("月份无效。");
  const year = Number(month.slice(0, 4));
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const length = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][
    Number(month.slice(5)) - 1
  ];
  return Array.from(
    { length },
    (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`,
  );
}

// UTC calendar arithmetic avoids daylight-saving and device-timezone shifts.
export function monthCells(month: string): (string | null)[] {
  const dates = monthDates(month);
  const start = new Date(`${dates[0]}T00:00:00Z`).getUTCDay();
  const cells: (string | null)[] = [...Array(start).fill(null), ...dates];
  while (cells.length % 7) cells.push(null);
  return cells;
}

export function monthSummary(data: AppData, month: string) {
  let totalCents = 0;
  let taskDays = 0;
  let ratios = 0;
  for (const date of monthDates(month)) {
    const day = data.days[date];
    if (!day) continue;
    totalCents += day.expenseCents;
    if (day.tasks.length) {
      const { done, total } = progress(day.tasks);
      ratios += done / total;
      taskDays++;
    }
  }
  // Equal weight per recorded task day, rounded only once at the end.
  return {
    totalCents,
    taskDays,
    averagePercent: taskDays ? Math.round((ratios / taskDays) * 100) : null,
  };
}

export function calendarMoney(cents: number) {
  const yuan = cents / 100;
  const trim = (value: number) => value.toFixed(1).replace(/\.0$/, "");
  if (yuan >= 100000000) return `${trim(yuan / 100000000)}亿`;
  if (yuan >= 10000) return `${trim(yuan / 10000)}万`;
  if (yuan >= 1000) return `${trim(yuan / 1000)}千`;
  return cents % 100 === 0 ? String(yuan) : yuan.toFixed(2);
}
