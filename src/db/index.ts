import type { Repositories } from "./ports";
import { createSqliteRepositories } from "./sqlite";

/** The only place that picks the DB implementation. To add another DB, add one line here */
export function createRepositories(config: { dbDriver: string; databaseUrl: string }): Repositories {
  switch (config.dbDriver) {
    case "sqlite":
      return createSqliteRepositories(config.databaseUrl);
    default:
      throw new Error(`Unsupported DB_DRIVER: ${config.dbDriver}`);
  }
}
