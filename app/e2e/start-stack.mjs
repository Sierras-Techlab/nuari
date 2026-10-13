import { spawn } from "node:child_process";
import { once } from "node:events";
import { resolve } from "node:path";
import process from "node:process";

const appRoot = resolve(process.cwd());
const apiRoot = resolve(appRoot, "../api");
const mode = process.env.E2E_WEB_MODE ?? "build";
const webPort = new URL(process.env.E2E_WEB_ORIGIN ?? "http://127.0.0.1:3100").port || "3100";
const apiPort = process.env.E2E_API_PORT ?? "3101";
const socketPath = process.env.NUARI_E2E_CONTROL_SOCKET;
if (!socketPath) throw new Error("NUARI_E2E_CONTROL_SOCKET must be provided by Playwright.");
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const children = new Set();
let stopping = false;

function assertIsolatedDatabaseUrl(value, name) {
  if (!value) throw new Error(`${name} is required; refusing to use an ambient/shared database.`);
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${name} must be a PostgreSQL URL for a local E2E database.`);
  }
  const localHost = ["localhost", "127.0.0.1", "::1"].includes(parsed.hostname);
  const databaseName = decodeURIComponent(parsed.pathname.slice(1));
  if (parsed.protocol !== "postgres:" && parsed.protocol !== "postgresql:") {
    throw new Error(`${name} must use the PostgreSQL protocol.`);
  }
  const sharedDevEndpoint = process.env.TEST_DATABASE_SHARED_DEV_ENDPOINT;
  const sharedDevHost =
    Boolean(sharedDevEndpoint) &&
    /^ep-[a-z0-9-]+$/.test(sharedDevEndpoint) &&
    parsed.hostname.endsWith(".neon.tech") &&
    parsed.hostname.replace(/-pooler\./, ".").startsWith(`${sharedDevEndpoint}.`);
  const localOk = localHost && (databaseName === "nuari_task07" || /(^|[_-])e2e($|[_-])/i.test(databaseName));
  if (!localOk && !sharedDevHost) {
    throw new Error(`${name} must target the dedicated local nuari_task07 database, a database named for E2E, or the explicitly confirmed shared dev endpoint.`);
  }
}

assertIsolatedDatabaseUrl(process.env.TEST_DATABASE_URL, "TEST_DATABASE_URL");
assertIsolatedDatabaseUrl(process.env.TEST_DIRECT_URL, "TEST_DIRECT_URL");

function run(command, args, cwd, env) {
  const child = spawn(command, args, {
    cwd,
    env,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  children.add(child);
  child.once("exit", (code, signal) => {
    children.delete(child);
    if (!stopping) shutdown(code ?? (signal ? 1 : 0));
  });
  return child;
}

function webEnvironment(nodeEnvironment, port) {
  const env = {
    ...process.env,
    NODE_ENV: nodeEnvironment,
    PORT: port,
    NEXT_PUBLIC_API_URL: "/api",
    API_INTERNAL_URL: `http://127.0.0.1:${apiPort}`,
    // La API de E2E corre fuera de producción (cookie `nuari_session`) aunque Next use `next start`.
    NUARI_SESSION_COOKIE_NAME: "nuari_session",
  };
  for (const key of [
    "TEST_DATABASE_URL",
    "TEST_DIRECT_URL",
    "DATABASE_URL",
    "DIRECT_URL",
    "RESEND_API_KEY",
    "CSRF_SECRET",
    "RATE_LIMIT_SECRET",
    "NUARI_E2E_CONTROL_SOCKET",
  ]) delete env[key];
  return env;
}

async function runBuild() {
  const child = spawn(npm, ["run", "build"], {
    cwd: appRoot,
    env: webEnvironment("production", webPort),
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  const [code] = await once(child, "exit");
  if (code !== 0) throw new Error("Next.js production build failed.");
}

async function runApiSetup(command, args, env) {
  const child = spawn(command, args, {
    cwd: apiRoot,
    env,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  const [code] = await once(child, "exit");
  if (code !== 0) throw new Error("API E2E database setup failed.");
}

function shutdown(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (process.platform === "win32" && child.pid) {
      spawn("taskkill", ["/pid", String(child.pid), "/t", "/f"], { stdio: "ignore" });
    } else {
      child.kill("SIGTERM");
    }
  }
  process.exit(code);
}

process.once("SIGINT", () => shutdown(130));
process.once("SIGTERM", () => shutdown(143));

if (mode === "build") await runBuild();
else if (mode !== "dev") throw new Error("E2E_WEB_MODE must be either 'dev' or 'build'.");

const apiEnv = {
  ...process.env,
  NODE_ENV: "development",
  PORT: apiPort,
  WEB_ORIGIN: process.env.E2E_WEB_ORIGIN ?? "http://127.0.0.1:3100",
  TEST_DATABASE_URL: process.env.TEST_DATABASE_URL,
  TEST_DIRECT_URL: process.env.TEST_DIRECT_URL,
  DATABASE_URL: process.env.TEST_DATABASE_URL,
  DIRECT_URL: process.env.TEST_DIRECT_URL,
  DOTENV_CONFIG_PATH: resolve(appRoot, "e2e", "dotenv-disabled"),
  API_INTERNAL_URL: `http://127.0.0.1:${apiPort}`,
  NUARI_E2E_CONTROL_SOCKET: socketPath,
  NUARI_E2E_TEST_MODE: "1",
};

await runApiSetup(npm, ["run", "db:generate"], apiEnv);
await runApiSetup(npm, ["run", "db:migrate:deploy"], apiEnv);
await runApiSetup(npm, ["run", "build"], apiEnv);
run(npm, ["run", "start:e2e"], apiRoot, apiEnv);
const webEnv = webEnvironment(mode === "build" ? "production" : "development", webPort);
run(npm, ["run", mode === "build" ? "start" : "dev", "--", "--hostname", "127.0.0.1"], appRoot, webEnv);

await new Promise(() => {});
