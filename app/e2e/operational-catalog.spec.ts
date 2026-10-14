import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { cleanupRun, createMultiOrganizationFixture, takeVerificationLink } from "./test-support";

const password = "Nuari E2E password 2026!";

test("private professional route does not expose page content to an anonymous visitor", async ({ request }) => {
  const response = await request.get("/app/profesionales", { maxRedirects: 0 });
  expect([302, 307, 308]).toContain(response.status());
  expect(response.headers().location).toMatch(/\/login/);
  const body = await response.text();
  expect(body).not.toContain("Administrá al personal que presta servicios");
  expect(body).not.toContain("Nuevo profesional");
});

test("catalog API flow persists across reload and isolates a second tenant", async ({ page }) => {
  test.setTimeout(180_000);
  const runId = randomUUID();
  const email = `e2e-${runId}@example.test`;
  const customerName = `Cliente ${runId.slice(0, 8)}`;
  const serviceName = `Servicio ${runId.slice(0, 8)}`;
  const staffName = `Profesional ${runId.slice(0, 8)}`;
  const staffEmail = `contacto-${runId.slice(0, 8)}@example.test`;

  try {
    await page.goto("/register");
    await page.getByLabel("Nombre", { exact: true }).fill("E2E");
    await page.getByLabel("Apellido", { exact: true }).fill(runId.slice(0, 8));
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByLabel("Contraseña", { exact: true }).fill(password);
    await page.getByLabel(/Acepto los/).check();
    await page.getByRole("button", { name: "Crear mi cuenta" }).click();
    await expect(page).toHaveURL(/\/verify-email\?registered=1$/);
    await page.goto(new URL(await takeVerificationLink(email)).href);
    await page.getByRole("button", { name: "Confirmar verificación" }).click();
    await expect(page.getByRole("heading", { name: "¡Correo verificado!" })).toBeVisible();
    await page.getByRole("link", { name: "Continuar a Nuari" }).click();
    await expect(page).toHaveURL(/\/onboarding$/);
    await page.getByLabel("Nombre del negocio").fill(`Negocio ${runId.slice(0, 8)}`);
    await page.getByRole("button", { name: "Continuar" }).click();
    await page.getByText("Servicios", { exact: true }).click();
    await page.getByRole("button", { name: "Continuar" }).click();
    await page.getByText("Pro", { exact: true }).click();
    await page.getByRole("button", { name: "Continuar" }).click();
    const enterWorkspace = page.getByRole("button", { name: "Entrar a mi espacio" });
    await expect(enterWorkspace).toBeEnabled();
    await enterWorkspace.click();
    await expect(page).toHaveURL(/\/app$/);

    const initialSnapshot = await page.context().request.get(new URL("/api/auth/me", page.url()).href);
    const firstOrganizationId = (await initialSnapshot.json() as { activeOrganizationId: string }).activeOrganizationId;

    await page.goto("/app/clientes");
    await page.getByLabel("Nombre", { exact: true }).fill(customerName);
    await page.getByRole("button", { name: "Agregar cliente" }).click();
    await expect(page.getByText("Cliente agregado")).toBeVisible();

    await page.goto("/app/servicios");
    await page.locator("#service-name").fill(serviceName);
    await page.getByLabel("Asignación profesional").selectOption("CUSTOMER_CHOICE");
    await page.getByRole("button", { name: "Agregar servicio" }).click();
    await expect(page.getByText(serviceName, { exact: true })).toBeVisible();

    await page.goto("/app/profesionales");
    await page.getByLabel("Nombre", { exact: true }).fill(staffName);
    await page.getByLabel("Correo", { exact: true }).fill(staffEmail);
    await page.getByRole("button", { name: "Agregar profesional" }).click();
    await expect(page.getByText("Profesional agregado")).toBeVisible();

    await page.goto("/app/servicios");
    await page.getByRole("button", { name: new RegExp(serviceName) }).click();
    await expect(page.getByRole("heading", { name: "Detalle del servicio" })).toBeVisible();
    await page.getByLabel("Profesional para habilitar").selectOption({ label: staffName });
    await page.getByRole("button", { name: "Habilitar profesional" }).click();
    await expect(page.getByText("Profesional habilitado para el servicio")).toBeVisible();

    await page.reload();
    await page.getByRole("button", { name: new RegExp(serviceName) }).click();
    await expect(page.getByText(staffName, { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("link", { name: "Profesionales" })).toBeVisible();
    await page.getByRole("button", { name: /Cerrar sesi[oó]n/i }).click();
    await expect(page).toHaveURL(/\/login$/);
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByLabel("Contraseña", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Iniciar sesión" }).click();
    await expect(page).toHaveURL(/\/app$/);

    const secondOrganization = await createMultiOrganizationFixture(runId);
    await page.reload();
    const organizationSelector = page.getByLabel("Negocio activo");
    await expect(organizationSelector).toBeVisible();
    await organizationSelector.selectOption(secondOrganization.organizationId);
    await expect(organizationSelector).toHaveValue(secondOrganization.organizationId);
    await page.goto("/app/clientes");
    await expect(page.getByText(customerName, { exact: true })).toHaveCount(0);
    await page.goto("/app/servicios");
    await expect(page.getByText(serviceName, { exact: true })).toHaveCount(0);
    await page.goto("/app/profesionales");
    await expect(page.getByText(staffName, { exact: true })).toHaveCount(0);

    await organizationSelector.selectOption(firstOrganizationId);
    await expect(organizationSelector).toHaveValue(firstOrganizationId);
    await page.reload();
    await page.goto("/app/profesionales");
    await expect(page.getByText(staffName, { exact: true })).toBeVisible();

  } finally {
    await test.step("cleanupRun elimina sólo los fixtures de este escenario", () => cleanupRun(runId));
  }
});
