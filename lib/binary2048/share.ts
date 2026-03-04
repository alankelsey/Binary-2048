export function buildShareText(score: number, highScore: number, moves: number): string {
  return `I scored ${score} in Binary 2048 (high ${highScore}, moves ${moves}). Can you beat it?`;
}

export function buildShareLandingUrl(
  pageUrl: string,
  options?: {
    referralCode?: string;
    campaign?: string;
    source?: string;
    medium?: string;
  }
): string {
  const base = new URL(pageUrl);
  if (options?.referralCode) base.searchParams.set("ref", options.referralCode);
  if (options?.campaign) base.searchParams.set("utm_campaign", options.campaign);
  if (options?.source) base.searchParams.set("utm_source", options.source);
  if (options?.medium) base.searchParams.set("utm_medium", options.medium);
  return base.toString();
}

export function buildShareUrls(text: string, pageUrl: string): { x: string; linkedin: string } {
  const encodedText = encodeURIComponent(text);
  const encodedUrl = encodeURIComponent(pageUrl);
  return {
    x: `https://x.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`
  };
}
