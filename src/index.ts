import { createApp } from "./app";
import { loadConfig } from "./config";
import { createRepositories } from "./db";
import { createTranslator } from "./translate";

const config = loadConfig(Bun.env);
const repos = createRepositories(config);
const translator = createTranslator(config);
const app = createApp({ repos, config, translator });

const server = Bun.serve({ port: config.port, fetch: app.fetch });
console.log(`Listening on ${server.url}`);
