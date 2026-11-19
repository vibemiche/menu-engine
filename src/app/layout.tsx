import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Menu Engine – food cost e menu che fanno margine",
  description:
    "Calcola il food cost reale di ogni piatto con una foto di menu, fatture e ricette. Audit del menu, strategia AI e nuovo design del menu.",
};

export const viewport: Viewport = { themeColor: "#2f6b4f", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
