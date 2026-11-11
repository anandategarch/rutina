import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "Rutina",
  description:
    "Rutina — pelacak kebiasaan & keuangan harian dalam satu tampilan yang tenang.",
  applicationName: "Rutina",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#F8FAFC",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

/* Cangkang minimal: aplikasi sesungguhnya adalah PWA satu file
   public/rutina.html (meregistrasi sw.js sendiri); route "/" hanya
   membungkusnya dalam iframe, dan /api/rutina menjadi jembatan data
   (baca-tulis) ke Turso / SQLite lokal. */
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
