import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { advanceClock, cleanupRun, createEmployeeFixture, createMultiOrganizationFixture, takeVerificationLink } from "./test-support";

const password = "Nuari E2E password 2026!";

test.describe.configure({ mode: "serial" });

test("registro, verificación, onboarding, sesión, expiración y acceso EMPLOYEE", async ({ page, browser }) => {
  const runId = randomUUID();
  const email = `e2e-${runId}@example.test`;

  try {
    await page.goto("/register");
    await page.getByLabel("Nombre", { exact: true }).fill("E2E");
    await page.getByLabel("Apellido", { exact: true }).fill(runId.slice(0, 8));
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByLabel("Contraseña", { exact: true }).fill(password);
    await page.getByLabel(/Acepto los/).check();
    await page.getByRole("button", { name: "Crear mi cuenta" }).click();
    await expect(page).toHaveURL(/\/login\?registered=1$/);

    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByLabel("Contraseña", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Iniciar sesión" }).click();
    await expect(page).toHaveURL(/\/onboarding$/);
    const authCookies = await page.context().cookies();
    for (const name of ["nuari_session", "nuari_csrf"]) {
      const cookie = authCookies.find((candidate) => candidate.name === name);
      expect(cookie).toBeDefined();
      expect(cookie?.httpOnly).toBe(true);
      expect(cookie?.sameSite).toBe("Lax");
      expect(cookie?.domain).toBe("127.0.0.1");
      expect(cookie?.path).toBe("/");
    }
    await expect(page.getByText("Verificá tu correo para activar la prueba.")).toBeVisible();

    const verificationLink = await takeVerificationLink(email);
    const verificationUrl = new URL(verificationLink);
    expect(verificationUrl.origin).toBe(new URL(page.url()).origin);
    await page.goto(verificationUrl.href);
    await expect(page.getByRole("button", { name: "Confirmar verificación" })).toBeVisible();
    await page.getByRole("button", { name: "Confirmar verificación" }).click();
    await expect(page.getByText("Correo verificado. Volvé a Nuari para continuar.")).toBeVisible();
    await page.goto("/onboarding");
    await expect(page.getByText("Verificá tu correo para activar la prueba.")).toHaveCount(0);

    await page.getByLabel("Nombre del negocio").fill(`Taller ${runId.slice(0, 8)}`);
    await page.getByRole("button", { name: "Continuar" }).click();
    await page.getByText("Servicios", { exact: true }).click();
    await page.getByRole("button", { name: "Continuar" }).click();
    await page.getByText("Pro", { exact: true }).click();
    await page.getByRole("button", { name: "Continuar" }).click();
    await page.getByRole("button", { name: "Entrar a mi espacio" }).click();
    await expect(page).toHaveURL(/\/app$/);
    await expect(page.getByRole("heading", { name: "Un día ordenado empieza acá." })).toBeVisible();

    await page.reload();
    await expect(page).toHaveURL(/\/app$/);
    await expect(page.getByRole("heading", { name: "Un día ordenado empieza acá." })).toBeVisible();
    const snapshotResponse = await page.context().request.get(new URL("/api/auth/me", page.url()).href);
    expect(snapshotResponse.ok()).toBe(true);
    const firstOrganizationId = (await snapshotResponse.json() as { activeOrganizationId: string }).activeOrganizationId;
    const secondOrganization = await createMultiOrganizationFixture(runId);
    await page.reload();
    const organizationSelector = page.getByLabel("Negocio activo");
    await expect(organizationSelector).toBeVisible();
    await organizationSelector.selectOption(secondOrganization.organizationId);
    await expect(organizationSelector).toHaveValue(secondOrganization.organizationId);
    const selectedSnapshot = await page.context().request.get(new URL("/api/auth/me", page.url()).href);
    expect((await selectedSnapshot.json() as { activeOrganizationId: string }).activeOrganizationId).toBe(secondOrganization.organizationId);
    await organizationSelector.selectOption(firstOrganizationId);

    const employee = await createEmployeeFixture(runId);
    const employeeContext = await browser.newContext({ baseURL: new URL(page.url()).origin });
    const employeePage = await employeeContext.newPage();
    try {
      await employeePage.goto("/login");
      await employeePage.getByLabel("Email", { exact: true }).fill(employee.email);
      await employeePage.getByLabel("Contraseña", { exact: true }).fill(employee.password);
      await employeePage.getByRole("button", { name: "Iniciar sesión" }).click();
      await expect(employeePage).toHaveURL(/\/app$/);
      await expect(employeePage.getByRole("heading", { name: "Un día ordenado empieza acá." })).toBeVisible();
      await expect(employeePage.getByRole("link", { name: "Agenda" })).toBeVisible();
    } finally {
      await employeeContext.close();
    }

    const activeSessionCheck = async () => {
      const response = await page.context().request.get(new URL("/api/auth/me", page.url()).href);
      expect(response.ok()).toBe(true);
      expect((await response.json() as { access: { businessAllowed: boolean } }).access.businessAllowed).toBe(true);
    };
    await advanceClock(6 * 24 * 60 * 60 * 1000);
    await activeSessionCheck();
    await advanceClock(6 * 24 * 60 * 60 * 1000);
    await activeSessionCheck();
    await advanceClock(2 * 24 * 60 * 60 * 1000);
    const expiredResponse = await page.context().request.get(new URL("/api/auth/me", page.url()).href);
    expect(expiredResponse.ok()).toBe(true);
    expect((await expiredResponse.json() as { access: { businessAllowed: boolean; reason: string } }).access).toMatchObject({ businessAllowed: false, reason: "TRIAL_EXPIRED" });
    await page.reload();
    await expect(page.getByRole("heading", { name: "Tu suscripción necesita atención" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Agenda" })).toHaveCount(0);
    await page.goto("/app/agenda");
    await expect(page).toHaveURL(/\/app$/);

    await page.getByRole("button", { name: /Cerrar sesi[oó]n/i }).click();
    await expect(page).toHaveURL(/\/login$/);
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByLabel("Contraseña", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Iniciar sesión" }).click();
    await expect(page).toHaveURL(/\/app$/);
    await expect(page.getByRole("link", { name: "Agenda" })).toHaveCount(0);
  } finally {
    await cleanupRun(runId);
  }
});

test("visitante no recibe contenido privado en HTML/RSC de rutas privadas", async ({ request }) => {
  for (const path of ["/onboarding", "/app", "/app/agenda", "/app/equipo"]) {
    const response = await request.get(path, { maxRedirects: 0 });
    expect([302, 307, 308]).toContain(response.status());
    expect(response.headers().location).toMatch(/\/login/);
    const body = await response.text();
    expect(body).not.toContain("Un día ordenado empieza acá.");
    expect(body).not.toContain("Turnos, servicios, clientes, caja y equipo");
  }
});
