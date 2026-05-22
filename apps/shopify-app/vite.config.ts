import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

import { handleHealthRequest } from "./routes/health";

function healthRoutePlugin(): Plugin {
  return {
    name: "shoppable-video-health-route",
    configureServer(server) {
      server.middlewares.use("/health", (_request, response) => {
        const { status, body, headers } = handleHealthRequest();

        response.statusCode = status;
        for (const [key, value] of Object.entries(headers)) {
          response.setHeader(key, value);
        }

        response.end(body);
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), healthRoutePlugin()],
  server: {
    port: 5173,
  },
  build: {
    outDir: "dist/client",
  },
});
