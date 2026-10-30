import { test, expect, type Page } from "@playwright/test";

async function setup(page: Page) {
  await page.clock.install({ time: new Date("2026-10-30T04:00:00Z") });
  await page.goto("./");
  await page.getByLabel("第一个周期的起始日期").fill("2026-10-30");
  await page.getByRole("button", { name: "开始我的第一个 7 天" }).click();
  await expect(
    page.getByRole("button", { name: "月历", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
}
function taskList(total: number, done: number) {
  return Array.from({ length: total }, (_, i) => ({
    id: `task-${i}`,
    text: `任务${i + 1}`,
    done: i < done,
  }));
}
async function seed(page: Page, days: Record<string, unknown>) {
  await page.getByRole("button", { name: "数据与安装" }).click();
  await page.getByLabel("选择 JSON 备份").setInputFiles({
    name: "calendar.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify({
        version: 1,
        anchor: "2026-10-18",
        periods: {
          0: { name: "本周", color: "#826693" },
          1: { name: "下周", color: "#4f7965" },
        },
        days,
      }),
    ),
  });
  await page.getByRole("button", { name: "确认替换并恢复" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
}
const cell = (page: Page, date: string) =>
  page.locator(`.calendar-day[data-date="${date}"]`);

test("月历默认当前月、星期位置、切月跨年、闰年和今天定位", async ({ page }) => {
  await setup(page);
  await expect(page.locator(".calendar-heading h1")).toHaveText("2026年 10月");
  await expect(page.locator(".calendar-day")).toHaveCount(31);
  await expect(page.locator(".calendar-grid > *").nth(4)).toHaveAttribute(
    "data-date",
    "2026-10-01",
  );
  await expect(cell(page, "2026-10-30")).toHaveAttribute(
    "aria-current",
    "date",
  );
  await expect(cell(page, "2026-10-30")).toContainText("暂无任务");
  await expect(page.getByTestId("month-average")).toHaveText("—");
  await page.getByRole("button", { name: "上一个月" }).click();
  await expect(page.locator(".calendar-heading h1")).toHaveText("2026年 9月");
  await expect(page.locator(".calendar-day")).toHaveCount(30);
  await cell(page, "2026-09-15").click();
  await expect(page.getByRole("heading", { name: "9月15日" })).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "返回月历" }).click();
  await expect(page.locator(".calendar-heading h1")).toHaveText("2026年 9月");
  await cell(page, "2026-09-15").click();
  await page.goBack();
  await expect(page.locator(".calendar-heading h1")).toHaveText("2026年 9月");
  for (let i = 0; i < 4; i++)
    await page.getByRole("button", { name: "下一个月" }).click();
  await expect(page.locator(".calendar-heading h1")).toHaveText("2027年 1月");
  await page.getByRole("button", { name: "上一个月" }).click();
  await expect(page.locator(".calendar-heading h1")).toHaveText("2026年 12月");
  await page.goto("./#month/2028-02");
  await expect(page.locator(".calendar-day")).toHaveCount(29);
  await expect(page.locator(".calendar-grid > *").nth(2)).toHaveAttribute(
    "data-date",
    "2028-02-01",
  );
  await expect(cell(page, "2028-02-29")).toBeVisible();
  await page.goto("./#month/2027-02");
  await expect(page.locator(".calendar-day")).toHaveCount(28);
  await page.getByRole("button", { name: "今天", exact: true }).click();
  await expect(page.locator(".calendar-heading h1")).toHaveText("2026年 10月");
});

test("日/月数据正确、复用详情、双向更新、阶段颜色、持久化与离线", async ({
  page,
  context,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await setup(page);
  await seed(page, {
    "2026-10-20": { tasks: taskList(5, 2), expenseCents: 3800 },
    "2026-10-21": { tasks: taskList(5, 5), expenseCents: 12650 },
    "2026-10-22": { tasks: [], expenseCents: 12500 },
    "2026-10-23": { tasks: taskList(2, 0), expenseCents: 0 },
    "2026-11-01": { tasks: taskList(1, 1), expenseCents: 1000000 },
  });
  await expect(
    cell(page, "2026-10-20").locator(".calendar-completion"),
  ).toHaveText("40%");
  await expect(
    cell(page, "2026-10-21").locator(".calendar-completion"),
  ).toHaveText("✓ 100%");
  await expect(cell(page, "2026-10-22")).toContainText("暂无任务");
  await expect(cell(page, "2026-10-22")).not.toContainText("100%");
  await expect(
    cell(page, "2026-10-23").locator(".calendar-completion"),
  ).toHaveText("0%");
  await expect(
    cell(page, "2026-10-20").locator(".calendar-expense"),
  ).toHaveText("¥38");
  await expect(
    cell(page, "2026-10-21").locator(".calendar-expense"),
  ).toHaveText("¥126.50");
  await expect(page.getByTestId("month-average")).toHaveText("47%");
  await expect(page.getByTestId("month-spending")).toHaveText("¥ 289.50");
  for (const day of [18, 20, 24])
    await expect(
      cell(page, `2026-10-${day}`).locator(".calendar-stage"),
    ).toHaveCSS("background-color", "rgb(130, 102, 147)");
  await expect(cell(page, "2026-10-25").locator(".calendar-stage")).toHaveCSS(
    "background-color",
    "rgb(79, 121, 101)",
  );
  await cell(page, "2026-10-20").click();
  await expect(page.getByRole("heading", { name: "10月20日" })).toBeVisible();
  await page
    .getByRole("checkbox", { name: "完成：任务3", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "新任务", exact: true })
    .fill("新增再删除");
  await page.getByRole("button", { name: "添加任务", exact: true }).click();
  await page.getByRole("button", { name: "返回月历" }).click();
  await expect(
    cell(page, "2026-10-20").locator(".calendar-completion"),
  ).toHaveText("50%");
  await cell(page, "2026-10-20").click();
  await page.getByRole("button", { name: "删除：新增再删除" }).click();
  await page.getByRole("button", { name: "确认删除", exact: true }).click();
  await page.getByRole("textbox", { name: "消费金额" }).fill("50.25");
  await page.getByRole("button", { name: "保存金额" }).click();
  await page.getByRole("button", { name: "返回月历" }).click();
  await expect(
    cell(page, "2026-10-20").locator(".calendar-completion"),
  ).toHaveText("60%");
  await expect(
    cell(page, "2026-10-20").locator(".calendar-expense"),
  ).toHaveText("¥50.25");
  await expect(page.getByTestId("month-average")).toHaveText("53%");
  await expect(page.getByTestId("month-spending")).toHaveText("¥ 301.75");
  await page.getByRole("button", { name: "7天", exact: true }).click();
  await expect(
    page.locator(".day-card").filter({ hasText: "10月20日" }),
  ).toContainText("60%");
  await page.getByRole("button", { name: /^2026年10月20日/ }).click();
  await page
    .getByRole("checkbox", { name: "取消完成：任务1", exact: true })
    .click();
  await page.getByRole("button", { name: "返回 7 天" }).click();
  await page.getByRole("button", { name: "编辑阶段" }).click();
  await page.getByRole("button", { name: "暖橙", exact: true }).click();
  await page.getByRole("button", { name: "保存阶段" }).click();
  await page.getByRole("button", { name: "月历", exact: true }).click();
  await expect(
    cell(page, "2026-10-20").locator(".calendar-completion"),
  ).toHaveText("40%");
  await expect(cell(page, "2026-10-20").locator(".calendar-stage")).toHaveCSS(
    "background-color",
    "rgb(166, 107, 61)",
  );
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect
    .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller))
    .toBe(true);
  await context.setOffline(true);
  await page.reload();
  await expect(
    cell(page, "2026-10-20").locator(".calendar-expense"),
  ).toHaveText("¥50.25");
  await page.getByRole("button", { name: "下一个月" }).click();
  await cell(page, "2026-11-02").click();
  await page
    .getByRole("textbox", { name: "新任务", exact: true })
    .fill("未来的离线任务");
  await page.getByRole("button", { name: "添加任务", exact: true }).click();
  await page.getByRole("button", { name: "返回月历" }).click();
  await page.reload();
  await expect(
    cell(page, "2026-11-02").locator(".calendar-completion"),
  ).toHaveText("0%");
  await context.setOffline(false);
  expect(errors).toEqual([]);
});

test("320–430px七列完整、大金额和文本不溢出、六周月份可点击", async ({
  page,
}) => {
  await setup(page);
  await seed(page, {
    "2026-08-01": { tasks: taskList(5, 5), expenseCents: 99999 },
    "2026-08-02": { tasks: taskList(5, 4), expenseCents: 12650 },
    "2026-08-03": { tasks: [], expenseCents: 123456 },
    "2026-08-04": { tasks: [], expenseCents: 999999999999 },
  });
  await page.goto("./#month/2026-08");
  await page.clock.runFor(4000);
  await expect(page.locator(".calendar-grid > *")).toHaveCount(42);
  for (const width of [320, 360, 375, 390, 414, 430, 768]) {
    await page.setViewportSize({ width, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    const layout = await page.locator(".calendar-day").evaluateAll((days) =>
      days.every((day) => {
        const box = day.getBoundingClientRect();
        return (
          box.height >= 90 &&
          Array.from(
            day.querySelectorAll(
              ".calendar-number, .calendar-completion, .calendar-expense",
            ),
          ).every((text) => {
            const rect = text.getBoundingClientRect();
            return (
              text.scrollWidth <= text.clientWidth + 1 &&
              rect.left >= box.left &&
              rect.right <= box.right
            );
          })
        );
      }),
    );
    expect(layout).toBe(true);
    expect(
      await page
        .locator(".calendar-grid")
        .evaluate(
          (grid) =>
            getComputedStyle(grid).gridTemplateColumns.split(" ").length,
        ),
    ).toBe(7);
    if (width === 320 || width === 390)
      await page.screenshot({
        path: `test-results/calendar-${width}.png`,
        fullPage: true,
      });
  }
  await page.setViewportSize({ width: 320, height: 844 });
  await cell(page, "2026-08-04").click();
  await expect(page.getByRole("textbox", { name: "消费金额" })).toHaveValue(
    "9999999999.99",
  );
});
