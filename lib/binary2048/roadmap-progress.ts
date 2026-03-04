export type RoadmapProgress = {
  total: number;
  done: number;
  percent: number;
};

const CHECKBOX_RE = /^\s*-\s\[( |x|X)\]\s+/;

export function computeRoadmapProgress(markdown: string): RoadmapProgress {
  const lines = markdown.split(/\r?\n/);
  let total = 0;
  let done = 0;

  for (const line of lines) {
    const match = line.match(CHECKBOX_RE);
    if (!match) continue;
    total += 1;
    if (match[1].toLowerCase() === "x") done += 1;
  }

  const percent = total === 0 ? 0 : Math.round((done / total) * 100);
  return { total, done, percent };
}
