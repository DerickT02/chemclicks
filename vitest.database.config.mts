import { defineConfig } from "vitest/config";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    envDir: false,
    include: ["tests/database/integration/student_quiz_attempts.test.ts"],
    environment: "node",
    hookTimeout: 30_000,
    testTimeout: 30_000,
  },
});
