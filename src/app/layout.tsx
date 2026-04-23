import type { Metadata } from "next";
import { JetBrains_Mono } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    template: "%s — Memo",
    default: "Memo",
  },
  description: "A Notion-style workspace, built with zero human code.",
};

/**
 * Inline script that runs before first paint to prevent flash of wrong theme.
 * Reads the stored preference from localStorage and applies the correct
 * data-theme attribute and .dark class before React hydrates.
 */
const themeScript = `(function(){try{var p=localStorage.getItem("memo-theme")||"dark";var d=p==="system"?window.matchMedia("(prefers-color-scheme:dark)").matches?"dark":"light":p;document.documentElement.setAttribute("data-theme",d);if(d==="dark")document.documentElement.classList.add("dark");else document.documentElement.classList.remove("dark")}catch(e){document.documentElement.setAttribute("data-theme","dark");document.documentElement.classList.add("dark")}})()`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${jetbrainsMono.variable} antialiased`}
      data-theme="dark"
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-screen">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
