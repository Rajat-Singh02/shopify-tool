import pino from "pino";

const logLevel =
  typeof process === "undefined" ? "silent" : (process.env.LOG_LEVEL ?? "info");

export const logger = pino({
  level: logLevel,
  browser: {
    asObject: true,
  },
  base: {
    service: "shoppable-video-shopify-app",
  },
});
