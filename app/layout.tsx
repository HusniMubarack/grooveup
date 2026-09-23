import type { Metadata, Viewport } from "next";
import { Header } from "@/components/header";
import { MobileNav } from "@/components/mobile-nav";
import "./globals.css";

export const metadata: Metadata = {
  title: "Atelier — learn dance from real teachers",
  description: "Dance teachers sell lessons. Students learn on their phone.",
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0b0a09" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh antialiased">
        <Header />
        <main className="mx-auto max-w-5xl px-4 pb-24 pt-4 md:pb-10">{children}</main>
        <MobileNav />
      </body>
    </html>
  );
}
