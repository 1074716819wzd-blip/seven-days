import { test } from "node:test";
import assert from "node:assert/strict";
import {
  calendarMoney,
  monthCells,
  monthDates,
  monthSummary,
  shiftMonth,
} from "../src/calendar.ts";
import { createData, newTask } from "../src/data.ts";

test("月历处理28/29/30/31天、闰世纪、首日星期及完整周行", () => {
  for (const [month, days] of [
    ["2026-02", 28],
    ["2028-02", 29],
    ["2026-04", 30],
    ["2026-10", 31],
    ["2000-02", 29],
    ["2100-02", 28],
  ] as const) {
    assert.equal(monthDates(month).length, days);
    assert.equal(monthCells(month).length % 7, 0);
    assert.equal(monthCells(month).filter(Boolean).length, days);
  }
  assert.equal(monthCells("2026-10").indexOf("2026-10-01"), 4);
  assert.equal(monthCells("2026-11").indexOf("2026-11-01"), 0);
  assert.equal(monthCells("2028-02").indexOf("2028-02-01"), 2);
  assert.equal(monthCells("2026-08").length, 42);
});
test("月份前后切换和跨年保持正确年月", () => {
  assert.equal(shiftMonth("2026-10", -1), "2026-09");
  assert.equal(shiftMonth("2026-10", 1), "2026-11");
  assert.equal(shiftMonth("2026-12", 1), "2027-01");
  assert.equal(shiftMonth("2026-01", -1), "2025-12");
  assert.throws(() => shiftMonth("2026-13", 1));
  assert.throws(() => shiftMonth("0000-01", -1));
});
test("月汇总排除无任务日的完成率，含零完成和消费记录，排除其他月份", () => {
  const data = createData("2026-10-30", "阶段", "#496b9b");
  const tasks = (total: number, done: number) =>
    Array.from({ length: total }, (_, i) => ({
      ...newTask("任务"),
      done: i < done,
    }));
  data.days = {
    "2026-10-01": { tasks: tasks(3, 2), expenseCents: 12650 },
    "2026-10-02": { tasks: tasks(5, 5), expenseCents: 3800 },
    "2026-10-03": { tasks: tasks(2, 0), expenseCents: 0 },
    "2026-10-04": { tasks: [], expenseCents: 500 },
    "2026-10-05": { tasks: [], expenseCents: 0 },
    "2026-11-01": { tasks: tasks(1, 1), expenseCents: 99999 },
  };
  assert.deepEqual(monthSummary(data, "2026-10"), {
    totalCents: 16950,
    taskDays: 3,
    averagePercent: 56,
  });
  assert.deepEqual(monthSummary(data, "2026-09"), {
    totalCents: 0,
    taskDays: 0,
    averagePercent: null,
  });
  data.days["2026-09-01"] = { tasks: [], expenseCents: 300 };
  assert.deepEqual(monthSummary(data, "2026-09"), {
    totalCents: 300,
    taskDays: 0,
    averagePercent: null,
  });
});
test("日均完成率按未舍入比例计算，最后一次取整", () => {
  const data = createData("2026-10-30", "阶段", "#496b9b");
  for (let day = 1; day <= 2; day++)
    data.days[`2026-10-0${day}`] = {
      tasks: Array.from({ length: 3 }, (_, i) => ({
        ...newTask("任务"),
        done: i < day,
      })),
      expenseCents: 0,
    };
  assert.equal(monthSummary(data, "2026-10").averagePercent, 50);
});
test("金额简写保持小金额精度，最大存储金额不挤占格子", () => {
  assert.equal(calendarMoney(0), "0");
  assert.equal(calendarMoney(3800), "38");
  assert.equal(calendarMoney(12650), "126.50");
  assert.equal(calendarMoney(99999), "999.99");
  for (const cents of [100000, 999999, 1000000, 999999999999])
    assert.ok(calendarMoney(cents).length <= 5);
});
