import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Architecture boundaries — app/ → features/ → lib/ and components/. Enforced, not just documented.
  {
    files: ["src/lib/**"],
    rules: { "no-restricted-imports": ["error", { patterns: [{ group: ["@/features/*", "@/app/*", "@/components/*"], message: "lib/ is shared infrastructure; it must not depend on features, routes or UI." }] }] },
  },
  {
    files: ["src/components/**"],
    rules: { "no-restricted-imports": ["error", { patterns: [{ group: ["@/features/*", "@/app/*"], message: "Shared components must not depend on a feature or a route." }] }] },
  },
  {
    files: ["src/features/**"],
    rules: { "no-restricted-imports": ["error", { patterns: [{ group: ["@/app/*"], message: "Features must not import from routes." }] }] },
  },
  // photos are short-lived signed URLs from a private bucket; next/image adds nothing here
  { rules: { "@next/next/no-img-element": "off" } },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // MapLibre's worker, copied out of node_modules by scripts/copy-map-worker.mjs — not our code
    "public/maplibre/**",
  ]),
]);

export default eslintConfig;
