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
  {
    files: ["src/**/*.ts", "src/**/*.tsx"],
    ignores: [
      "src/lib/sentry.ts",
      "src/lib/capture.ts",
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
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;
