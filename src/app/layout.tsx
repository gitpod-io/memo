import type { Metadata } from "next";
import { JetBrains_Mono } from "next/font/google";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Memo",
  description: "A Notion-style workspace, built with zero human code.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${jetbrainsMono.variable} antialiased`}>
      <body className="min-h-screen">
        <TooltipProvider>{children}</TooltipProvider>
        <Toaster
          theme="dark"
          position="bottom-right"
          toastOptions={{
            className: "rounded-sm font-mono text-sm",
          }}
        />
      </body>
    </html>
  );
}
