import { defineConfig, devices } from "@playwright/test";

const webOrigin = process.env.E2E_WEB_ORIGIN ?? "http://127.0.0.1:3100";
const webMode = process.env.E2E_WEB_MODE ?? "build";
const controlSocket = process.env.NUARI_E2E_CONTROL_SOCKET ??
  (process.platform === "win32"
    ? `\\\\.\\pipe\\nuari-e2e-${process.pid}`
    : `/tmp/nuari-e2e-${process.pid}.sock`);
process.env.NUARI_E2E_CONTROL_SOCKET = controlSocket;

if (webMode !== "build" && webMode !== "dev") {
  throw new Error("E2E_WEB_MODE must be either 'dev' or 'build'.");
}

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: 1,
  reporter: process.env.CI ? "github" : "list",
  timeout: 120_000,
  expect: { timeout: 10_000 },
  use: {
    ...devices["Desktop Chrome"],
    baseURL: webOrigin,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: {
    command: "node ./e2e/start-stack.mjs",
    cwd: process.cwd(),
    url: `${webOrigin}/api/health`,
    reuseExistingServer: false,
    timeout: 240_000,
    env: { ...process.env, NUARI_E2E_CONTROL_SOCKET: controlSocket },
    stdout: "pipe",
    stderr: "pipe",
  },
});
