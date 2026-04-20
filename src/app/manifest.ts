import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Memo",
    short_name: "Memo",
    description: "A Notion-style workspace, built with zero human code.",
    start_url: "/",
    display: "standalone",
    background_color: "#1a1a1f",
    theme_color: "#1a1a1f",
    icons: [
      {
        src: "/android-chrome-192x192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/android-chrome-512x512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
