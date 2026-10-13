export function getInternalApiOrigin(env: { API_INTERNAL_URL?: string; NODE_ENV?: string } = process.env): string {
  const configured = env.API_INTERNAL_URL;
  if (!configured && env.NODE_ENV === "production") throw new Error("API_INTERNAL_URL is required in production.");
  const url = new URL(configured ?? "http://localhost:3001");
  const localOrigin = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.pathname !== "/" || url.search || url.hash || (env.NODE_ENV === "production" && url.protocol !== "https:" && !localOrigin)) throw new Error("API_INTERNAL_URL must be an exact HTTP(S) origin; production requires HTTPS except for local loopback tests.");
  return url.origin;
}
