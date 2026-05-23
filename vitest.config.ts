import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      {
        plugins: [react()],
        test: {
          name: "unit",
          include: [
            "apps/**/*.test.ts",
            "apps/**/*.test.tsx",
            "tests/api/**/*.test.ts",
            "packages/**/*.test.ts",
            "packages/**/*.test.tsx",
            "workers/**/*.test.ts",
          ],
          exclude: ["**/*.integration.test.ts", "tests/e2e/**"],
          environment: "jsdom",
          setupFiles: ["./packages/testing/src/vitest.setup.ts"],
        },
      },
      {
        test: {
          name: "integration",
          include: ["apps/**/*.integration.test.ts", "packages/**/*.integration.test.ts"],
          environment: "node",
        },
      },
    ],
  },
});
