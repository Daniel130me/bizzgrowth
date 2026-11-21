import type { MetadataRoute } from "next";

// Name, colour and home-screen icons for phones. Icons are built by scripts/brand-icons.mjs.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Nellovia",
    short_name: "Nellovia",
    description: "Nellovia is an AI business consultant. It turns scattered marketing, sales and website signals into clear decisions.",
    start_url: "/",
    background_color: "#ffffff",
    theme_color: "#1DA1F2",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
