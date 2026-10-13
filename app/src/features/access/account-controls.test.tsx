/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { accessFixture } from "@/test/access-fixtures";
import { AccountControls } from "./account-controls";
const mocks = vi.hoisted(() => ({ multi: false, signOut: vi.fn(), select: vi.fn() }));
vi.mock("./access-provider", () => ({ useAccess: () => {
  const snapshot = accessFixture();
  if (mocks.multi) snapshot.memberships.push({ ...snapshot.memberships[0], id: "other-member", role: "EMPLOYEE", organization: { ...snapshot.memberships[0].organization, id: "other-org", name: "Otro negocio" } });
  return { snapshot, signOut: mocks.signOut, select: mocks.select };
} }));
describe("account controls", () => {
  afterEach(() => { cleanup(); vi.clearAllMocks(); mocks.multi = false; });
  it("shows the actual account and logout even without a selector", () => {
    render(<AccountControls />); expect(screen.getByText("Juan Pérez")).toBeTruthy(); expect(screen.queryByRole("combobox")).toBeNull(); fireEvent.click(screen.getByRole("button", { name: "Cerrar sesión" })); expect(mocks.signOut).toHaveBeenCalledOnce();
  });
  it("sends only the requested organization selection for backend validation", () => {
    mocks.multi = true; render(<AccountControls />); fireEvent.change(screen.getByRole("combobox", { name: "Negocio activo" }), { target: { value: "other-org" } }); expect(mocks.select).toHaveBeenCalledExactlyOnceWith("other-org");
  });
});
