import axios, { type AxiosInstance } from "axios";

const DEVELOPMENT_API_URL = "http://localhost:3001/api";
const API_TIMEOUT_MS = 10_000;

type ApiEnvironment = {
  NODE_ENV?: string;
  NEXT_PUBLIC_API_URL?: string;
};

export function getApiBaseUrl(
  env: ApiEnvironment = process.env,
): string {
  const configuredUrl = env.NEXT_PUBLIC_API_URL?.trim();

  if (configuredUrl) {
    return configuredUrl.replace(/\/+$/, "");
  }

  if (env.NODE_ENV !== "production") {
    return DEVELOPMENT_API_URL;
  }

  throw new Error(
    "NEXT_PUBLIC_API_URL is required when the web application runs in production.",
  );
}

export function createApiClient(baseURL = getApiBaseUrl()): AxiosInstance {
  return axios.create({
    baseURL,
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
