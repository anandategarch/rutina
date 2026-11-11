import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Rutina",
    short_name: "Rutina",
    description: "Pelacak kebiasaan dan arus kas harian dalam satu tampilan yang tenang.",
    lang: "id",
    start_url: "/",
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "minimal-ui"],
    orientation: "portrait",
    background_color: "#F8FAFC",
    theme_color: "#F8FAFC",
    categories: ["lifestyle", "productivity", "finance"],
    prefer_related_applications: false,
    icons: [
      { src: "/icons/icon-192.png?v=2", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png?v=2", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png?v=2", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
