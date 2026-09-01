import { describe, expect, it } from "vitest";

import {
  createApiClient,
  getApiBaseUrl,
  getApiClient,
} from "./api-client";

describe("getApiBaseUrl", () => {
  it("uses the local API during development when no URL is configured", () => {
    expect(getApiBaseUrl({ NODE_ENV: "development" })).toBe(
      "http://localhost:3001/api",
    );
  });

  it("normalizes a configured production URL", () => {
    expect(
      getApiBaseUrl({
        NODE_ENV: "production",
        NEXT_PUBLIC_API_URL: "https://api.nuari.app/api/",
      }),
    ).toBe("https://api.nuari.app/api");
  });

  it("rejects a missing production URL", () => {
    expect(() => getApiBaseUrl({ NODE_ENV: "production" })).toThrow(
      "NEXT_PUBLIC_API_URL",
    );
  });
});

describe("Axios API client", () => {
  it("uses the Nuari API timeout and base URL", () => {
    const client = createApiClient("https://api.nuari.app/api");

    expect(client.defaults.baseURL).toBe("https://api.nuari.app/api");
    expect(client.defaults.timeout).toBe(10_000);
  });

  it("reuses the lazily created client", () => {
    expect(getApiClient()).toBe(getApiClient());
  });
});
