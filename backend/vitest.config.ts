import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
    globalSetup: ["./test/preparar-plantilla.ts"],
    testTimeout: 20_000,
  },
});
