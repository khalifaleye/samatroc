import type { MetadataRoute } from "next";

/** Sitemap statique : l'application est servie sur la route "/" */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: "/",
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
  ];
}
