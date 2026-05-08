import type { StorybookConfig } from "@storybook/react-vite";
import path from "node:path";

const config: StorybookConfig = {
  stories: ["../src/**/*.stories.@(ts|tsx)"],
  addons: [
    "@storybook/addon-essentials",
    "@storybook/addon-interactions",
    "@storybook/addon-links",
  ],
  framework: {
    name: "@storybook/react-vite",
    options: {},
  },
  core: {
    disableTelemetry: true,
  },
  staticDirs: ["../public"],
  typescript: {
    reactDocgen: "react-docgen-typescript",
  },
  viteFinal(config) {
    config.resolve ??= {};
    config.resolve.alias = {
      ...config.resolve.alias,
      "@": path.resolve(__dirname, "../src"),
      "next/navigation": path.resolve(
        __dirname,
        "next-navigation-mock.ts",
      ),
    };
    config.server ??= {};
    config.server.allowedHosts = true;
    config.server.hmr = {
      clientPort: 443,
      protocol: "wss",
    };

    // Next.js CJS modules (e.g. next/link) reference `process.env` at
    // import-time. Vite doesn't provide a Node-style `process` global, so we
    // inject a minimal shim via `define`.
    config.define = {
      ...config.define,
      "process.env": JSON.stringify({}),
    };

    return config;
  },
};

export { config as default };
