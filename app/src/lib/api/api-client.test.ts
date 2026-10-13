import { describe, expect, it } from "vitest";

import {
  createApiClient,
  getApiBaseUrl,
  getApiClient,
} from "./api-client";

describe("getApiBaseUrl", () => {
  it("uses the same-origin API path when no URL is configured", () => {
    expect(getApiBaseUrl({ NODE_ENV: "development" })).toBe(
      "/api",
    );
  });

  it("accepts the same-origin API path", () => {
    expect(
      getApiBaseUrl({
        NODE_ENV: "production",
        NEXT_PUBLIC_API_URL: "/api",
      }),
    ).toBe("/api");
  });

  it("rejects a cross-origin API URL", () => {
    expect(() => getApiBaseUrl({
      NODE_ENV: "production",
      NEXT_PUBLIC_API_URL: "https://api.nuari.app/api",
    })).toThrow(
      "same-origin",
    );
  });
});

describe("Axios API client", () => {
  it("uses the Nuari API timeout and base URL", () => {
    const client = createApiClient("/api");

    expect(client.defaults.baseURL).toBe("/api");
    expect(client.defaults.timeout).toBe(10_000);
    expect(client.defaults.withCredentials).toBe(true);
  });

  it("reuses the lazily created client", () => {
    expect(getApiClient()).toBe(getApiClient());
  });
});
