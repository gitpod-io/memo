import type { Metadata } from "next";
import { JetBrains_Mono, Inter } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const SITE_URL = "https://software-factory.dev";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    template: "%s — Memo",
    default: "Memo",
  },
  description: "A Notion-style workspace, built with zero human code.",
  openGraph: {
    title: "Memo",
    description: "A Notion-style workspace, built with zero human code.",
    url: SITE_URL,
    siteName: "Memo",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Memo",
    description: "A Notion-style workspace, built with zero human code.",
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon.png", type: "image/png", sizes: "32x32" },
    ],
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
  },
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
      className={`${jetbrainsMono.variable} ${inter.variable} antialiased`}
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
