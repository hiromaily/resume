import type { Repositories, User } from "./db/ports";
import type { Translator } from "./translate/ports";

export type AppEnv = {
  Variables: {
    user: User | null;
    repos: Repositories;
    now: () => Date;
    translator: Translator | null;
  };
};
