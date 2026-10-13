# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: authentication.spec.ts >> registro, verificación, onboarding, sesión, expiración y acceso EMPLOYEE
- Location: e2e\authentication.spec.ts:9:5

# Error details

```
Error: expect(page).toHaveURL(expected) failed

Expected pattern: /\/app$/
Received string:  "http://127.0.0.1:3100/onboarding"
Timeout: 10000ms

Call log:
  - Expect "toHaveURL" with timeout 10000ms
    24 × locator resolved to <html lang="es-AR" class="manrope_b7d5735e-module__suUhcW__variable geist_mono_d6617093-module__z61v7q__variable light">…</html>
       - unexpected value "http://127.0.0.1:3100/onboarding"

```

```yaml
- banner:
  - link "nuari, inicio":
    - /url: /
    - text: nuari
  - button "Volver"
  - text: E2E 9219d2cd
  - button "Cerrar sesión"
  - status: Paso 4 de 4
- main:
  - region "Todo está listo para empezar.":
    - heading "Todo está listo para empezar." [level=1]
    - paragraph: Revisá la configuración de tu espacio antes de continuar
    - heading "Taller 9219d2cd" [level=2]
    - paragraph: nuari.app/taller-9219d2cd
    - text: Servicios Plan Pro
    - button "Entrar a mi espacio" [disabled]
    - text: Podés cambiar tu plan en cualquier momento.
- alert
```

# Test source

```ts
  1   | import { randomUUID } from "node:crypto";
  2   | import { expect, test } from "@playwright/test";
  3   | import { advanceClock, cleanupRun, createEmployeeFixture, createMultiOrganizationFixture, takeVerificationLink } from "./test-support";
  4   | 
  5   | const password = "Nuari E2E password 2026!";
  6   | 
  7   | test.describe.configure({ mode: "serial" });
  8   | 
  9   | test("registro, verificación, onboarding, sesión, expiración y acceso EMPLOYEE", async ({ page, browser }) => {
  10  |   const runId = randomUUID();
  11  |   const email = `e2e-${runId}@example.test`;
  12  | 
  13  |   try {
  14  |     await page.goto("/register");
  15  |     await page.getByLabel("Nombre", { exact: true }).fill("E2E");
  16  |     await page.getByLabel("Apellido", { exact: true }).fill(runId.slice(0, 8));
  17  |     await page.getByLabel("Email", { exact: true }).fill(email);
  18  |     await page.getByLabel("Contraseña", { exact: true }).fill(password);
  19  |     await page.getByLabel(/Acepto los/).check();
  20  |     await page.getByRole("button", { name: "Crear mi cuenta" }).click();
  21  |     await expect(page).toHaveURL(/\/login\?registered=1$/);
  22  | 
  23  |     await page.getByLabel("Email", { exact: true }).fill(email);
  24  |     await page.getByLabel("Contraseña", { exact: true }).fill(password);
  25  |     await page.getByRole("button", { name: "Iniciar sesión" }).click();
  26  |     await expect(page).toHaveURL(/\/onboarding$/);
  27  |     const authCookies = await page.context().cookies();
  28  |     for (const name of ["nuari_session", "nuari_csrf"]) {
  29  |       const cookie = authCookies.find((candidate) => candidate.name === name);
  30  |       expect(cookie).toBeDefined();
  31  |       expect(cookie?.httpOnly).toBe(true);
  32  |       expect(cookie?.sameSite).toBe("Lax");
  33  |       expect(cookie?.domain).toBe("127.0.0.1");
  34  |       expect(cookie?.path).toBe("/");
  35  |     }
  36  |     await expect(page.getByText("Verificá tu correo para activar la prueba.")).toBeVisible();
  37  | 
  38  |     const verificationLink = await takeVerificationLink(email);
  39  |     const verificationUrl = new URL(verificationLink);
  40  |     expect(verificationUrl.origin).toBe(new URL(page.url()).origin);
  41  |     await page.goto(verificationUrl.href);
  42  |     await expect(page.getByRole("button", { name: "Confirmar verificación" })).toBeVisible();
  43  |     await page.getByRole("button", { name: "Confirmar verificación" }).click();
  44  |     await expect(page.getByText("Correo verificado. Volvé a Nuari para continuar.")).toBeVisible();
  45  |     await page.goto("/onboarding");
  46  |     await expect(page.getByText("Verificá tu correo para activar la prueba.")).toHaveCount(0);
  47  | 
  48  |     await page.getByLabel("Nombre del negocio").fill(`Taller ${runId.slice(0, 8)}`);
  49  |     await page.getByRole("button", { name: "Continuar" }).click();
  50  |     await page.getByText("Servicios", { exact: true }).click();
  51  |     await page.getByRole("button", { name: "Continuar" }).click();
  52  |     await page.getByText("Pro", { exact: true }).click();
  53  |     await page.getByRole("button", { name: "Continuar" }).click();
  54  |     await page.getByRole("button", { name: "Entrar a mi espacio" }).click();
> 55  |     await expect(page).toHaveURL(/\/app$/);
      |                        ^ Error: expect(page).toHaveURL(expected) failed
  56  |     await expect(page.getByRole("heading", { name: "Un día ordenado empieza acá." })).toBeVisible();
  57  | 
  58  |     await page.reload();
  59  |     await expect(page).toHaveURL(/\/app$/);
  60  |     await expect(page.getByRole("heading", { name: "Un día ordenado empieza acá." })).toBeVisible();
  61  |     const snapshotResponse = await page.context().request.get(new URL("/api/auth/me", page.url()).href);
  62  |     expect(snapshotResponse.ok()).toBe(true);
  63  |     const firstOrganizationId = (await snapshotResponse.json() as { activeOrganizationId: string }).activeOrganizationId;
  64  |     const secondOrganization = await createMultiOrganizationFixture(runId);
  65  |     await page.reload();
  66  |     const organizationSelector = page.getByLabel("Negocio activo");
  67  |     await expect(organizationSelector).toBeVisible();
  68  |     await organizationSelector.selectOption(secondOrganization.organizationId);
  69  |     await expect(organizationSelector).toHaveValue(secondOrganization.organizationId);
  70  |     const selectedSnapshot = await page.context().request.get(new URL("/api/auth/me", page.url()).href);
  71  |     expect((await selectedSnapshot.json() as { activeOrganizationId: string }).activeOrganizationId).toBe(secondOrganization.organizationId);
  72  |     await organizationSelector.selectOption(firstOrganizationId);
  73  | 
  74  |     const employee = await createEmployeeFixture(runId);
  75  |     const employeeContext = await browser.newContext({ baseURL: new URL(page.url()).origin });
  76  |     const employeePage = await employeeContext.newPage();
  77  |     try {
  78  |       await employeePage.goto("/login");
  79  |       await employeePage.getByLabel("Email", { exact: true }).fill(employee.email);
  80  |       await employeePage.getByLabel("Contraseña", { exact: true }).fill(employee.password);
  81  |       await employeePage.getByRole("button", { name: "Iniciar sesión" }).click();
  82  |       await expect(employeePage).toHaveURL(/\/app$/);
  83  |       await expect(employeePage.getByRole("heading", { name: "Un día ordenado empieza acá." })).toBeVisible();
  84  |       await expect(employeePage.getByRole("link", { name: "Agenda" })).toBeVisible();
  85  |     } finally {
  86  |       await employeeContext.close();
  87  |     }
  88  | 
  89  |     const activeSessionCheck = async () => {
  90  |       const response = await page.context().request.get(new URL("/api/auth/me", page.url()).href);
  91  |       expect(response.ok()).toBe(true);
  92  |       expect((await response.json() as { access: { businessAllowed: boolean } }).access.businessAllowed).toBe(true);
  93  |     };
  94  |     await advanceClock(6 * 24 * 60 * 60 * 1000);
  95  |     await activeSessionCheck();
  96  |     await advanceClock(6 * 24 * 60 * 60 * 1000);
  97  |     await activeSessionCheck();
  98  |     await advanceClock(2 * 24 * 60 * 60 * 1000);
  99  |     const expiredResponse = await page.context().request.get(new URL("/api/auth/me", page.url()).href);
  100 |     expect(expiredResponse.ok()).toBe(true);
  101 |     expect((await expiredResponse.json() as { access: { businessAllowed: boolean; reason: string } }).access).toMatchObject({ businessAllowed: false, reason: "TRIAL_EXPIRED" });
  102 |     await page.reload();
  103 |     await expect(page.getByRole("heading", { name: "Tu suscripción necesita atención" })).toBeVisible();
  104 |     await expect(page.getByRole("link", { name: "Agenda" })).toHaveCount(0);
  105 |     await page.goto("/app/agenda");
  106 |     await expect(page).toHaveURL(/\/app$/);
  107 | 
  108 |     await page.getByRole("button", { name: /Cerrar sesi[oó]n/i }).click();
  109 |     await expect(page).toHaveURL(/\/login$/);
  110 |     await page.getByLabel("Email", { exact: true }).fill(email);
  111 |     await page.getByLabel("Contraseña", { exact: true }).fill(password);
  112 |     await page.getByRole("button", { name: "Iniciar sesión" }).click();
  113 |     await expect(page).toHaveURL(/\/app$/);
  114 |     await expect(page.getByRole("link", { name: "Agenda" })).toHaveCount(0);
  115 |   } finally {
  116 |     await cleanupRun(runId);
  117 |   }
  118 | });
  119 | 
  120 | test("visitante no recibe contenido privado en HTML/RSC de rutas privadas", async ({ request }) => {
  121 |   for (const path of ["/onboarding", "/app", "/app/agenda", "/app/equipo"]) {
  122 |     const response = await request.get(path, { maxRedirects: 0 });
  123 |     expect([302, 307, 308]).toContain(response.status());
  124 |     expect(response.headers().location).toMatch(/\/login/);
  125 |     const body = await response.text();
  126 |     expect(body).not.toContain("Un día ordenado empieza acá.");
  127 |     expect(body).not.toContain("Turnos, servicios, clientes, caja y equipo");
  128 |   }
  129 | });
  130 | 
```