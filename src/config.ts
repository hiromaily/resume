export type AppConfig = {
  dbDriver: string;
  databaseUrl: string;
  port: number;
  secureCookies: boolean;
  translator: string | undefined;
};

export function loadConfig(env: Record<string, string | undefined>): AppConfig {
  return {
    dbDriver: env.DB_DRIVER ?? "sqlite",
    databaseUrl: env.DATABASE_URL ?? "./data/app.db",
    port: Number(env.PORT ?? 3000),
    secureCookies: env.SECURE_COOKIES === "true",
    translator: env.TRANSLATOR || undefined,
  };
}
