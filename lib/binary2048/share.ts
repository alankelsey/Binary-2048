export function buildShareText(score: number, highScore: number, moves: number): string {
  return `I scored ${score} in Binary 2048 (high ${highScore}, moves ${moves}). Can you beat it?`;
}

export function buildShareUrls(text: string, pageUrl: string): { x: string; linkedin: string } {
  const encodedText = encodeURIComponent(text);
  const encodedUrl = encodeURIComponent(pageUrl);
  return {
    x: `https://x.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`
  };
}
