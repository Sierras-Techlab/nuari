import axios, { type AxiosInstance } from "axios";

const API_TIMEOUT_MS = 10_000;

type ApiEnvironment = {
  NODE_ENV?: string;
  NEXT_PUBLIC_API_URL?: string;
};

export function getApiBaseUrl(
  env: ApiEnvironment = process.env,
): string {
  const configuredUrl = env.NEXT_PUBLIC_API_URL?.trim();

  if (configuredUrl && configuredUrl !== "/api") {
    throw new Error("NEXT_PUBLIC_API_URL must be /api (same-origin).");
  }
  return "/api";
}

export function createApiClient(baseURL = getApiBaseUrl()): AxiosInstance {
  if (baseURL !== "/api") throw new Error("The browser API must be same-origin /api.");
  return axios.create({
    baseURL,
    withCredentials: true,
    timeout: API_TIMEOUT_MS,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
  });
}

let sharedApiClient: AxiosInstance | undefined;

export function getApiClient(): AxiosInstance {
  sharedApiClient ??= createApiClient();
  return sharedApiClient;
}
