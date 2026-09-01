type DatabaseEnvironment = {
  DATABASE_URL?: string;
};

export function getDatabaseUrl(
  env: DatabaseEnvironment = process.env,
): string {
  const databaseUrl = env.DATABASE_URL?.trim();

  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required to access PostgreSQL.');
  }

  return databaseUrl;
}
