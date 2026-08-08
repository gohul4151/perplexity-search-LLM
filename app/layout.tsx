import type { Metadata } from "next";
import "./globals.css";

// Browser tab title + meta description for the whole app.
export const metadata: Metadata = {
  title: "Perplexity AI",
  description: "AI-powered search assistant using Tavily",
};

/**
 * Root layout wrapping every page. Sets the base white background / black text
 * theme used across the app. Auth state comes from the Supabase browser client
 * (no React context provider needed).
 */
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-white text-black antialiased">{children}</body>
    </html>
  );
}
