import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 45000,
  use: {
    baseURL: "http://localhost:4173/seven-days/",
    ...devices["iPhone 13"],
    timezoneId: "Asia/Shanghai",
    browserName: "chromium",
    channel: "msedge",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm.cmd run preview -- --port 4173 --strictPort",
    url: "http://localhost:4173/seven-days/",
    reuseExistingServer: !process.env.CI,
  },
});
