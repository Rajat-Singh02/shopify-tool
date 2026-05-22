import { HealthResponseSchema, type HealthResponse } from "@shoppable-video/shared";

import { serializeError } from "../lib/errors";

type HttpResult = {
  status: number;
  headers: Record<string, string>;
  body: string;
};

export function getHealthResponse(): HealthResponse {
  return HealthResponseSchema.parse({
    ok: true,
    service: "shoppable-video-shopify-app",
    version: "0.0.0",
  });
}

export function handleHealthRequest(): HttpResult {
  try {
    return {
      status: 200,
      headers: { "content-type": "application/json; charset=utf-8" },
      body: JSON.stringify(getHealthResponse()),
    };
  } catch (error) {
    return {
      status: 500,
      headers: { "content-type": "application/json; charset=utf-8" },
      body: JSON.stringify(serializeError(error)),
    };
  }
}
