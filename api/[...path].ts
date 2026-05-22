import type { IncomingMessage, ServerResponse } from "node:http";

import { handleNodeServerRequest } from "../apps/shopify-app/server/vercel-runtime";

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  await handleNodeServerRequest(request, response);
}
