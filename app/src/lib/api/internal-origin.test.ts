import { describe, expect, it } from "vitest";
import { getInternalApiOrigin } from "./internal-origin";

describe("getInternalApiOrigin", () => {
  it("defaults to the local API during development", () => {
    expect(getInternalApiOrigin({ NODE_ENV: "development" })).toBe("http://localhost:3001");
  });

  it("accepts HTTPS production origins and local loopback for build/start tests", () => {
    expect(getInternalApiOrigin({ NODE_ENV: "production", API_INTERNAL_URL: "https://api.internal.nuari.app" })).toBe("https://api.internal.nuari.app");
    expect(getInternalApiOrigin({ NODE_ENV: "production", API_INTERNAL_URL: "http://127.0.0.1:3001" })).toBe("http://127.0.0.1:3001");
    for (const API_INTERNAL_URL of ["http://api.internal.nuari.app", "https://api.internal.nuari.app/path", "https://user:secret@api.internal.nuari.app"]) {
      expect(() => getInternalApiOrigin({ NODE_ENV: "production", API_INTERNAL_URL })).toThrow("exact HTTP(S) origin");
    }
  });

  it("rejects a missing production origin", () => {
    expect(() => getInternalApiOrigin({ NODE_ENV: "production" })).toThrow("required in production");
  });
});
