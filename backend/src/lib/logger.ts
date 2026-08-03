import { config } from "../config/index.js";

/**
 * Minimal structured logger.
 *
 * The old routers logged full transaction objects and account keys on the hot
 * path with bare `console.log`, which leaked wallet data into Render's logs and
 * made real errors unfindable. Use these levels instead; `debug` is silent in
 * production.
 */

type Fields = Record<string, unknown>;

function emit(level: "debug" | "info" | "warn" | "error", message: string, fields?: Fields) {
  const line = {
    level,
    time: new Date().toISOString(),
    message,
    ...fields,
  };

  const serialized = JSON.stringify(line, (_key, value) =>
    typeof value === "bigint" ? value.toString() : value,
  );

  if (level === "error") console.error(serialized);
  else if (level === "warn") console.warn(serialized);
  else console.log(serialized);
}

export const logger = {
  debug(message: string, fields?: Fields) {
    if (config.isProduction || config.isTest) return;
    emit("debug", message, fields);
  },
  info(message: string, fields?: Fields) {
    if (config.isTest) return;
    emit("info", message, fields);
  },
  warn(message: string, fields?: Fields) {
    if (config.isTest) return;
    emit("warn", message, fields);
  },
  error(message: string, fields?: Fields) {
    emit("error", message, fields);
  },
};
