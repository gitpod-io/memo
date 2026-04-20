import type { Preview } from "@storybook/react";
import React from "react";
import "../src/app/globals.css";

const preview: Preview = {
  decorators: [
    (Story) =>
      React.createElement(
        "div",
        { className: "dark" },
        React.createElement(Story)
      ),
  ],
  parameters: {
    backgrounds: {
      default: "memo-dark",
      values: [{ name: "memo-dark", value: "oklch(0.13 0.008 255)" }],
    },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    layout: "centered",
  },
};

export { preview as default };
