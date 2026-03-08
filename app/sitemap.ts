import type { MetadataRoute } from "next";

const baseUrl = "https://www.binary2048.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = ["/", "/auth", "/leaderboard", "/store", "/docs", "/docs/user", "/docs/developer", "/privacy", "/replay"];
  return routes.map((route) => ({
    url: `${baseUrl}${route}`,
    changeFrequency: route === "/" ? "daily" : "weekly",
    priority: route === "/" ? 1 : 0.7
  }));
}
