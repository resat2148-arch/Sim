import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["{core,modules,scenarios,scripts}/**/*.test.ts"],
  },
});
