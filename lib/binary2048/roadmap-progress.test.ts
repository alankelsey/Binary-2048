import { computeRoadmapProgress } from "@/lib/binary2048/roadmap-progress";

describe("computeRoadmapProgress", () => {
  it("computes done/total/percent from markdown checkboxes", () => {
    const md = `
- [x] a
- [ ] b
- [X] c
`;
    expect(computeRoadmapProgress(md)).toEqual({
      total: 3,
      done: 2,
      percent: 67
    });
  });

  it("returns zeros when no checkbox lines exist", () => {
    expect(computeRoadmapProgress("hello")).toEqual({
      total: 0,
      done: 0,
      percent: 0
    });
  });
});
