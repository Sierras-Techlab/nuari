import { connect } from "node:net";
import { randomUUID } from "node:crypto";

type SupportCommand =
  | { id: string; operation: "mailbox.take"; email: string }
  | { id: string; operation: "fixture.employee"; runId: string }
  | { id: string; operation: "fixture.multi-organization"; runId: string }
  | { id: string; operation: "clock.advance"; milliseconds: number }
  | { id: string; operation: "run.cleanup"; runId: string };

type SupportOperation = SupportCommand extends infer Command
  ? Command extends { id: string }
    ? Omit<Command, "id">
    : never
  : never;

type SupportResponse<T> = { id: string; ok: true; result: T } | { id: string; ok: false; error: string };

export type EmployeeFixture = {
  email: string;
  password: string;
  organizationId: string;
  role: "EMPLOYEE";
  ownerEmail: string;
};
export type MultiOrganizationFixture = { organizationId: string; name: string };

const configuredSocketPath = process.env.NUARI_E2E_CONTROL_SOCKET;

if (!configuredSocketPath) {
  throw new Error("NUARI_E2E_CONTROL_SOCKET is required for private process-injected E2E support.");
}
const socketPath = configuredSocketPath;

async function invoke<T>(request: SupportOperation): Promise<T> {
  const id = randomUUID();
  const response = await new Promise<SupportResponse<T>>((resolve, reject) => {
    const socket = connect(socketPath);
    let buffer = "";
    socket.setTimeout(5_000, () => socket.destroy(new Error("E2E test-support socket timed out.")));
    socket.once("connect", () => socket.write(`${JSON.stringify({ ...request, id })}\n`));
    socket.on("data", (chunk: Buffer) => {
      buffer += chunk.toString("utf8");
      const lineEnd = buffer.indexOf("\n");
      if (lineEnd < 0) return;
      const payload: unknown = JSON.parse(buffer.slice(0, lineEnd));
      socket.end();
      if (!isResponse<T>(payload) || payload.id !== id) {
        reject(new Error("Invalid private E2E support response."));
      } else resolve(payload);
    });
    socket.once("error", reject);
  });
  if (!response.ok) throw new Error(`Private E2E support operation failed: ${response.error}`);
  return response.result;
}

function isResponse<T>(value: unknown): value is SupportResponse<T> {
  if (typeof value !== "object" || value === null || !("id" in value) || !("ok" in value)) return false;
  const response = value as { id: unknown; ok: unknown; result?: unknown; error?: unknown };
  return typeof response.id === "string" &&
    (response.ok === true || (response.ok === false && typeof response.error === "string"));
}

export function takeVerificationLink(email: string): Promise<string> {
  return invoke<string>({ operation: "mailbox.take", email });
}

export function createEmployeeFixture(runId: string): Promise<EmployeeFixture> {
  return invoke<EmployeeFixture>({ operation: "fixture.employee", runId });
}

export function createMultiOrganizationFixture(runId: string): Promise<MultiOrganizationFixture> {
  return invoke<MultiOrganizationFixture>({ operation: "fixture.multi-organization", runId });
}

export function advanceClock(milliseconds: number): Promise<void> {
  if (!Number.isSafeInteger(milliseconds) || milliseconds < 0) {
    throw new Error("Clock advance must be a non-negative safe integer.");
  }
  return invoke<void>({ operation: "clock.advance", milliseconds });
}

export function cleanupRun(runId: string): Promise<void> {
  return invoke<void>({ operation: "run.cleanup", runId });
}
