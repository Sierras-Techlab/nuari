import { describe, expect, it } from "vitest";

import { isSafeReturnTo } from "./return-to";

describe("safe internal return paths", () => {
  it.each(["/", "/invitacion/invitation-token-123456789", "/login?registered=1"])('accepts %s', (value) => {
    expect(isSafeReturnTo(value)).toBe(true);
  });

  it.each(["https://evil.test", "//evil.test", "/\\evil.test", "/invitacion/\u0000token", null, 42])('rejects %s', (value) => {
    expect(isSafeReturnTo(value)).toBe(false);
  });
});
