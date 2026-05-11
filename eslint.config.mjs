import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  // Playwright E2E tests are not React — disable React-specific rules
  {
    files: ["e2e/**/*.ts"],
    rules: {
      "react-hooks/rules-of-hooks": "off",
    },
  },
  // Prevent raw lazyCaptureException imports — use captureSupabaseError or
  // captureApiError from @/lib/sentry instead. The classification wrappers
  // and React error boundaries are exempt.
  // Prevent direct sonner toast imports — use @/lib/toast instead to keep
  // sonner (~15 kB) out of the initial bundle via lazy loading.
  {
    files: ["src/**/*.ts", "src/**/*.tsx"],
    ignores: [
      "src/lib/sentry/**",
      "src/lib/capture.ts",
      "src/lib/toast.ts",
      "src/app/global-error.tsx",
      "src/components/route-error.tsx",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@/lib/capture",
              importNames: ["lazyCaptureException"],
              message:
                "Use captureSupabaseError or captureApiError from @/lib/sentry instead. Raw lazyCaptureException bypasses error classification.",
            },
            {
              name: "sonner",
              importNames: ["toast"],
              message:
                "Use @/lib/toast instead. Direct sonner imports bypass lazy-loading and add ~15 kB to the initial bundle.",
            },
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;
