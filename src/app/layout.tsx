import type { Metadata, Viewport } from "next";
import { PwaRegister } from "@/components/pwa/pwa-register";
import "@fontsource-variable/plus-jakarta-sans";
import "./globals.css";

export const metadata: Metadata = {
  title: "Rutina · Konsep Redesain",
  description:
    "Konsep Rutina: pelacak kebiasaan & keuangan dengan data asli dari database Turso — kebiasaan, kategori, transaksi, dompet, dan anggaran.",
  applicationName: "Rutina",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Rutina OS",
  },
  icons: {
    icon: [
      { url: "/icons/icon.svg", type: "image/svg+xml" },
      { url: "/icons/icon-192", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-180", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#F8FAFC",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id">
      <body>
        <PwaRegister />
        {children}
      </body>
    </html>
  );
}
