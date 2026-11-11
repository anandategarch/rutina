import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  /* v2.34 · "/" mengalihkan langsung ke shell PWA satu file. Sebelumnya
     "/" membungkus shell dalam iframe yang distyling kelas Tailwind —
     saat Tailwind dipangkas bersama scaffold lama (v2.32), kelas itu
     mati dan iframe jatuh ke ukuran bawaan ±300×150 ("tampilan kecil").
     Redirect menghilangkan iframe sekaligus: URL kanonik = shell,
     viewport-fit/safe-area ditangani shell sendiri, SW scope "/" tetap. */
  async redirects() {
    return [
      {
        source: "/",
        destination: "/rutina.html",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
