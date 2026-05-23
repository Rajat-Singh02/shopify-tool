import type { IncomingMessage, ServerResponse } from "node:http";

import { config, handleNodeServerRequest } from "../[...path].js";

export { config };

export default async function handler(
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  normalizeCatchAllUrl(request, "/api/admin");
  await handleNodeServerRequest(request, response);
}

function normalizeCatchAllUrl(request: IncomingMessage, basePath: string): void {
  if (!request.url) {
    return;
  }

  const url = new URL(request.url, "https://vercel.local");
  const path = url.searchParams.get("path") ?? url.searchParams.get("...path");

  if (!path || url.pathname !== `${basePath}/[...path]`) {
    return;
  }

  url.searchParams.delete("path");
  url.searchParams.delete("...path");
  url.pathname = `${basePath}/${path}`;
  request.url = `${url.pathname}${url.search}`;
}
