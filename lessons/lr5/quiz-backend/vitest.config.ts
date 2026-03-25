import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["src/**/*.unit.test.ts", "src/**/*.feature.test.ts"],
    fileParallelism: false,
    maxConcurrency: 1,
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/**/*.ts"],
      exclude: [
        "src/**/*.test.ts",
        "src/generated/**",
      ],
    },
  },
});