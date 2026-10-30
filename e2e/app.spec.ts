import { test, expect, chromium, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

async function setup(page: Page) {
  await page.clock.install({ time: new Date("2026-10-30T04:00:00Z") });
  await page.goto("./");
  await page.getByLabel("第一个周期的起始日期").fill("2026-10-30");
  await page.getByRole("button", { name: "开始我的第一个 7 天" }).click();
  await page.getByRole("button", { name: "7天", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "第 1 阶段", exact: true }),
  ).toBeVisible();
}
async function add(page: Page, text: string) {
  await page.getByRole("textbox", { name: "新任务", exact: true }).fill(text);
  await page.getByRole("button", { name: "添加任务", exact: true }).click();
  await expect(
    page.getByRole("button", { name: `修改：${text}`, exact: true }),
  ).toBeVisible();
}
async function home(page: Page) {
  await page.getByRole("button", { name: "返回 7 天" }).click();
}
async function openDate(page: Page, date: string) {
  await page
    .getByRole("button", { name: new RegExp(`^2026年${date}`) })
    .click();
}
async function amount(page: Page, value: string) {
  await page.getByRole("textbox", { name: "消费金额" }).fill(value);
  await page.getByRole("button", { name: "保存金额" }).click();
  await expect(page.getByRole("textbox", { name: "消费金额" })).toHaveValue(
    Number(value).toFixed(2),
  );
}
test("创建周期、任务完整操作、消费、刷新、过去未来和手机布局", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(() => {
    Object.defineProperty(crypto, "randomUUID", { value: undefined });
  });
  await setup(page);
  await expect(page.locator(".day-card")).toHaveCount(7);
  await expect(page.locator(".date-range")).toContainText(
    "2026年10月30日 — 2026年11月5日",
  );
  await page.getByRole("button", { name: "编辑阶段" }).click();
  await page.getByLabel("阶段名称").fill("慢慢来的一周");
  await page.getByRole("button", { name: "松绿", exact: true }).click();
  await page.getByRole("button", { name: "保存阶段" }).click();
  await expect(
    page.getByRole("heading", { name: "慢慢来的一周" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "打开今天" }).click();
  await add(page, "联系客户");
  await add(page, "阅读");
  await add(page, "散步");
  await page
    .getByRole("checkbox", { name: "完成：联系客户", exact: true })
    .click();
  await page.getByRole("checkbox", { name: "完成：阅读", exact: true }).click();
  await expect(page.getByRole("progressbar")).toHaveAttribute(
    "aria-valuenow",
    "67",
  );
  await page.getByRole("button", { name: "修改：阅读", exact: true }).click();
  await page.getByLabel("任务内容").fill("阅读二十分钟");
  await page.getByRole("button", { name: "保存修改", exact: true }).click();
  await expect(
    page.getByRole("checkbox", { name: "取消完成：阅读二十分钟" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "删除：散步", exact: true }).click();
  await page.getByRole("button", { name: "确认删除", exact: true }).click();
  await expect(page.getByRole("progressbar")).toHaveAttribute(
    "aria-valuenow",
    "100",
  );
  await expect(page.getByText("今天的任务，全部完成")).toBeVisible();
  await add(page, "喝水");
  await expect(page.getByRole("progressbar")).toHaveAttribute(
    "aria-valuenow",
    "67",
  );
  await page.getByRole("checkbox", { name: "取消完成：联系客户" }).click();
  await expect(page.getByRole("progressbar")).toHaveAttribute(
    "aria-valuenow",
    "33",
  );
  await amount(page, "126.50");
  await page.reload();
  await expect(
    page.getByRole("checkbox", { name: "取消完成：阅读二十分钟" }),
  ).toBeVisible();
  await expect(page.getByRole("textbox", { name: "消费金额" })).toHaveValue(
    "126.50",
  );
  await home(page);
  await openDate(page, "10月31日");
  await amount(page, "85");
  await add(page, "未来的事");
  await home(page);
  await expect(page.locator(".spending-summary")).toContainText("211.50");
  await expect(page.locator(".spending-summary")).toContainText("30.21");
  await page.getByRole("button", { name: "上一阶段" }).click();
  await openDate(page, "10月29日");
  await add(page, "补记昨天");
  await amount(page, "12");
  await home(page);
  for (const width of [320, 375, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "回到本期" }).click();
  await page.screenshot({
    path: "test-results/mobile-home.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
});

test("未来3天追加、未来7天覆盖，跨阶段和消费保留", async ({ page }) => {
  await setup(page);
  await openDate(page, "10月31日");
  await add(page, "原有任务");
  await amount(page, "9");
  await home(page);
  await page.getByRole("button", { name: "打开今天" }).click();
  await add(page, "源任务");
  await page
    .getByRole("checkbox", { name: "完成：源任务", exact: true })
    .click();
  await page.getByRole("button", { name: "应用到其他日期" }).click();
  await page.getByRole("button", { name: "下一步 · 确认应用" }).click();
  await expect(page.getByRole("dialog")).toContainText("1 条任务 → 3 天");
  await expect(page.getByRole("dialog")).toContainText(
    "2026年10月31日 — 2026年11月2日",
  );
  await page.getByRole("button", { name: "确认追加", exact: true }).click();
  await home(page);
  await openDate(page, "10月31日");
  await expect(page.locator(".task")).toHaveCount(2);
  await expect(
    page.getByRole("checkbox", { name: "完成：源任务", exact: true }),
  ).toHaveAttribute("aria-checked", "false");
  await expect(page.getByRole("textbox", { name: "消费金额" })).toHaveValue(
    "9.00",
  );
  await home(page);
  await page.getByRole("button", { name: "打开今天" }).click();
  await add(page, "另一个任务");
  await page.getByRole("button", { name: "应用到其他日期" }).click();
  await page.getByRole("button", { name: "7 天", exact: true }).click();
  await page.getByRole("radio", { name: "覆盖" }).check();
  await page.getByRole("button", { name: "下一步 · 确认应用" }).click();
  await expect(page.getByRole("dialog")).toContainText("2 条任务 → 7 天");
  await page.getByRole("button", { name: "确认覆盖", exact: true }).click();
  await home(page);
  await openDate(page, "10月31日");
  await expect(
    page.getByRole("button", { name: "修改：原有任务" }),
  ).toHaveCount(0);
  await expect(page.locator(".task")).toHaveCount(2);
  await expect(page.getByRole("textbox", { name: "消费金额" })).toHaveValue(
    "9.00",
  );
  await home(page);
  await page.getByRole("button", { name: "下一阶段" }).click();
  await openDate(page, "11月6日");
  await expect(page.locator(".task")).toHaveCount(2);
  await expect(page.getByRole("progressbar")).toHaveAttribute(
    "aria-valuenow",
    "0",
  );
});

test("多行粘贴、指定范围、确认取消及JSON备份往返", async ({ page }) => {
  await setup(page);
  await page.getByRole("button", { name: "粘贴任务", exact: true }).click();
  await page
    .getByRole("textbox")
    .fill("联系8位客户\n学习20分钟\n02:00前睡觉\n记录今日消费");
  await expect(page.locator(".preview-tasks li")).toHaveCount(4);
  await page.getByLabel("应用到", { exact: true }).selectOption("range");
  await page.getByLabel("开始日期").fill("2026-11-03");
  await page.getByLabel("结束日期").fill("2026-11-09");
  await page.getByRole("button", { name: "下一步 · 确认应用" }).click();
  await expect(page.getByRole("dialog")).toContainText("4 条任务 → 7 天");
  await page.getByRole("button", { name: "返回修改" }).click();
  await expect(page.locator(".preview-tasks li")).toHaveCount(4);
  await page.getByRole("button", { name: "下一步 · 确认应用" }).click();
  await page.getByRole("button", { name: "确认追加", exact: true }).click();
  await openDate(page, "11月3日");
  await expect(page.locator(".task")).toHaveCount(4);
  await home(page);
  await page.getByRole("button", { name: "数据与安装" }).click();
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出备份", exact: true }).click();
  const download = await downloadEvent;
  const file = await download.path();
  const raw = await readFile(file!, "utf8");
  const backup = JSON.parse(raw);
  expect(backup.version).toBe(1);
  expect(Object.keys(backup.days)).toHaveLength(7);
  expect(backup.days["2026-11-09"].tasks).toHaveLength(4);
  await page.getByLabel("选择 JSON 备份").setInputFiles({
    name: "bad.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"version":9}'),
  });
  await expect(page.getByRole("alert")).toContainText("备份格式不正确");
  backup.periods["0"].name = "恢复后的阶段";
  backup.days["2026-11-03"].tasks[0].done = true;
  backup.days["2026-11-03"].expenseCents = 12650;
  await page.getByLabel("选择 JSON 备份").setInputFiles({
    name: "backup.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(backup)),
  });
  await expect(page.getByRole("dialog")).toContainText("7 天的记录");
  await page.getByRole("button", { name: "确认替换并恢复" }).click();
  await expect(
    page.getByRole("heading", { name: "恢复后的阶段" }),
  ).toBeVisible();
  await openDate(page, "11月3日");
  await expect(page.getByRole("progressbar")).toHaveAttribute(
    "aria-valuenow",
    "25",
  );
  await expect(page.getByRole("textbox", { name: "消费金额" })).toHaveValue(
    "126.50",
  );
});

test("PWA清单和图标可用、浏览器安装条件、离线打开编辑并持久化", async ({}, testInfo) => {
  const context = await chromium.launchPersistentContext(
    testInfo.outputPath("pwa-profile"),
    {
      channel: "msedge",
      headless: true,
      baseURL: "http://localhost:4173/seven-days/",
      viewport: { width: 390, height: 844 },
      timezoneId: "Asia/Shanghai",
    },
  );
  try {
    const page = await context.newPage();
    await page.addInitScript(() => {
      window.addEventListener("beforeinstallprompt", () => {
        (window as any).__installReady = true;
      });
    });
    await setup(page);
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });
    await page.reload();
    await expect
      .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller))
      .toBe(true);
    const manifest = await (
      await page.request.get("./manifest.webmanifest")
    ).json();
    expect(manifest.display).toBe("standalone");
    expect(manifest.icons).toHaveLength(2);
    for (const icon of manifest.icons)
      expect((await page.request.get("./" + icon.src)).ok()).toBe(true);
    const cdp = await context.newCDPSession(page);
    const installability = await cdp.send("Page.getInstallabilityErrors");
    expect(installability.installabilityErrors).toEqual([]);
    // Browsers allow one prompt per event, even when the user dismisses it.
    await page.evaluate(() => {
      const event = new Event("beforeinstallprompt", { cancelable: true });
      Object.assign(event, {
        prompt: async () => undefined,
        userChoice: Promise.resolve({ outcome: "dismissed" }),
      });
      window.dispatchEvent(event);
    });
    await page.getByRole("button", { name: "数据与安装" }).click();
    await page.getByRole("button", { name: "安装七日" }).click();
    await expect(page.getByRole("button", { name: "安装七日" })).toHaveCount(0);
    await page.getByRole("button", { name: "关闭", exact: true }).click();
    await context.setOffline(true);
    await page.reload();
    await page.getByRole("button", { name: "打开今天" }).click();
    await add(page, "离线添加的任务");
    await amount(page, "18.80");
    await page.reload();
    await expect(
      page.getByRole("button", { name: "修改：离线添加的任务" }),
    ).toBeVisible();
    await expect(page.getByRole("textbox", { name: "消费金额" })).toHaveValue(
      "18.80",
    );
    await context.setOffline(false);
  } finally {
    await context.close();
  }
});
