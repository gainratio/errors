import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // The README's examples import the package by name. Point that name at src/
  // (and its translation files at locales/) so test/readme.contract.test.ts
  // runs the examples against this commit.
  resolve: {
    alias: [
      {
        find: /^@gainratio\/errors\/locales\/(.+)$/,
        replacement: fileURLToPath(new URL("locales/$1", import.meta.url)),
      },
      {
        find: /^@gainratio\/errors$/,
        replacement: fileURLToPath(new URL("src/index.ts", import.meta.url)),
      },
    ],
  },
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      // types.ts is type-only (no runtime); index.ts is a re-export barrel.
      exclude: ["src/types.ts", "src/index.ts"],
      // The whole library is ~200 lines of pure logic with no I/O, so every
      // line and branch is reachable from a plain unit test. 100% is the bar
      // the README advertises; keeping it enforced here means the two agree.
      thresholds: {
        statements: 100,
        lines: 100,
        functions: 100,
        branches: 100,
      },
    },
  },
});
