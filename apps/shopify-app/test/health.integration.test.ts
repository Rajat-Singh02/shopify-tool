import { describe, expect, it } from "vitest";

import { getHealthResponse, handleHealthRequest } from "../routes/health";

describe("health route", () => {
  it("returns liveness metadata", () => {
    expect(getHealthResponse()).toEqual({
      ok: true,
      service: "shoppable-video-shopify-app",
      version: "0.0.0",
    });
  });

  it("serializes as an HTTP JSON response", () => {
    const result = handleHealthRequest();

    expect(result.status).toBe(200);
    expect(result.headers["content-type"]).toContain("application/json");
    expect(JSON.parse(result.body)).toEqual(getHealthResponse());
  });
});
