import { test } from "node:test";
import assert from "node:assert/strict";
import {
  addDays,
  applyTasks,
  createData,
  dateRange,
  exportBackup,
  futureDates,
  newTask,
  parseMoney,
  parseTasks,
  periodDates,
  periodIndex,
  progress,
  spending,
  updateDay,
  validateBackup,
} from "../src/data.ts";
import "fake-indexeddb/auto";
import { loadData, changeData } from "../src/storage.ts";

const fresh = () => createData("2026-10-30", "第 1 阶段", "#496b9b");
test("连续七天，跨月、跨年、闰日和过去周期", () => {
  assert.deepEqual(periodDates("2026-10-30", 0), [
    "2026-10-30",
    "2026-10-31",
    "2026-11-01",
    "2026-11-02",
    "2026-11-03",
    "2026-11-04",
    "2026-11-05",
  ]);
  assert.equal(periodDates("2026-10-30", 1)[0], "2026-11-06");
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
  assert.equal(addDays("2028-02-28", 1), "2028-02-29");
  assert.equal(periodIndex("2026-10-30", "2026-10-29"), -1);
  assert.equal(addDays("2026-03-08", 1), "2026-03-09");
});
test("新增、修改、删除、完成切换和动态完成率", () => {
  let data = updateDay(fresh(), "2026-10-30", (day) => ({
    ...day,
    tasks: ["A", "B", "C"].map(newTask),
  }));
  const mutate = (fn: Parameters<typeof updateDay>[2]) =>
    (data = updateDay(data, "2026-10-30", fn));
  mutate((day) => ({
    ...day,
    tasks: day.tasks.map((task, i) => ({ ...task, done: i < 2 })),
  }));
  assert.equal(progress(data.days["2026-10-30"].tasks).percent, 67);
  mutate((day) => ({
    ...day,
    tasks: day.tasks.map((task) => ({ ...task, done: true })),
  }));
  assert.equal(progress(data.days["2026-10-30"].tasks).percent, 100);
  mutate((day) => ({ ...day, tasks: [...day.tasks, newTask("D")] }));
  assert.equal(progress(data.days["2026-10-30"].tasks).percent, 75);
  mutate((day) => ({
    ...day,
    tasks: day.tasks
      .slice(0, 3)
      .map((task, i) => ({
        ...task,
        text: i === 0 ? "edited" : task.text,
        done: i === 0 ? false : task.done,
      })),
  }));
  assert.equal(data.days["2026-10-30"].tasks[0].text, "edited");
  assert.equal(progress(data.days["2026-10-30"].tasks).percent, 67);
  assert.equal(progress([]).percent, 0);
  assert.equal(
    progress(
      Array.from({ length: 7 }, (_, i) => ({
        ...newTask("task"),
        done: i < 4,
      })),
    ).percent,
    57,
  );
});
test("金额以分存储，累计和七天平均值正确", () => {
  let data = updateDay(fresh(), "2026-10-30", (day) => ({
    ...day,
    expenseCents: parseMoney("126.50"),
  }));
  data = updateDay(data, "2026-10-31", (day) => ({
    ...day,
    expenseCents: parseMoney("85"),
  }));
  assert.deepEqual(spending(data, periodDates(data.anchor, 0)), {
    total: 21150,
    average: 3021,
  });
  assert.equal(parseMoney("0.29"), 29);
  for (const bad of ["-1", "1.234", "NaN", "Infinity", "1e3", ""])
    assert.throws(() => parseMoney(bad));
});
test("未来3天和7天、覆盖、追加、跨周期、消费保留和独立完成状态", () => {
  let data = updateDay(fresh(), "2026-10-31", (day) => ({
    ...day,
    expenseCents: 900,
    tasks: [{ ...newTask("原任务"), done: true }],
  }));
  data = applyTasks(data, futureDates("2026-10-30", 3), ["新任务"], "append");
  assert.equal(data.days["2026-10-31"].tasks.length, 2);
  assert.equal(data.days["2026-10-31"].tasks[0].done, true);
  assert.equal(data.days["2026-10-31"].tasks[1].done, false);
  assert.equal(data.days["2026-11-03"], undefined);
  data = applyTasks(
    data,
    futureDates("2026-10-30", 7),
    ["覆盖任务"],
    "replace",
  );
  assert.equal(data.days["2026-10-31"].tasks.length, 1);
  assert.equal(data.days["2026-10-31"].expenseCents, 900);
  assert.equal(data.days["2026-11-06"].tasks[0].text, "覆盖任务");
  assert.notEqual(
    data.days["2026-10-31"].tasks[0].id,
    data.days["2026-11-01"].tasks[0].id,
  );
  assert.ok(data.periods[1]);
});
test("指定范围含首尾、过去未来都能编辑、错误日期被拒绝", () => {
  const dates = dateRange("2026-11-03", "2026-11-09");
  assert.equal(dates.length, 7);
  const data = applyTasks(
    fresh(),
    ["2026-10-01", "2027-02-01"],
    ["任意一天"],
    "replace",
  );
  assert.equal(Object.keys(data.days).length, 2);
  for (const args of [
    ["2026-02-30", "2026-03-01"],
    ["2026-11-09", "2026-11-03"],
  ])
    assert.throws(() => dateRange(args[0], args[1]));
  for (const count of [0, -2, 1.5, NaN, Infinity])
    assert.throws(() => futureDates("2026-10-30", count));
});
test("按行解析粘贴任务，保留时间，不导入完成状态", () => {
  assert.deepEqual(
    parseTasks("联系8位客户\r\n\n 学习20分钟 \n02:00前睡觉\n记录今日消费"),
    ["联系8位客户", "学习20分钟", "02:00前睡觉", "记录今日消费"],
  );
  assert.deepEqual(parseTasks("1. 任务A\n- [x] 任务B\n• 任务C"), [
    "任务A",
    "任务B",
    "任务C",
  ]);
});
test("JSON完整往返，坏数据和未知版本被拒绝", () => {
  const data = updateDay(fresh(), "2026-10-30", (day) => ({
    ...day,
    expenseCents: 1250,
    tasks: [{ ...newTask("测试"), done: true }],
  }));
  assert.deepEqual(validateBackup(JSON.parse(exportBackup(data))), data);
  for (const bad of [
    { ...data, version: 2 },
    { ...data, anchor: "bad" },
    { ...data, periods: { 0: { name: "bad", color: "url(x)" } } },
    { ...data, days: { "2026-10-30": { tasks: [], expenseCents: -1 } } },
  ])
    assert.throws(() => validateBackup(bad));
  assert.throws(() =>
    validateBackup(
      JSON.parse(
        '{"version":1,"anchor":"2026-10-30","periods":{"__proto__":{}},"days":{}}',
      ),
    ),
  );
});
test("IndexedDB持久化、快速并发编辑、原子替换备份及失败回滚", async () => {
  assert.equal(await loadData(), null);
  await changeData(() => fresh());
  await Promise.all(
    ["一", "二", "三"].map((text) =>
      changeData((data) =>
        updateDay(data!, "2026-10-30", (day) => ({
          ...day,
          tasks: [...day.tasks, newTask(text)],
        })),
      ),
    ),
  );
  assert.equal((await loadData())!.days["2026-10-30"].tasks.length, 3);
  await assert.rejects(
    changeData(() => {
      throw new Error("simulate failure");
    }),
  );
  assert.equal((await loadData())!.days["2026-10-30"].tasks.length, 3);
  const restored = validateBackup(JSON.parse(exportBackup(fresh())));
  await changeData(() => restored);
  assert.deepEqual(await loadData(), restored);
});
