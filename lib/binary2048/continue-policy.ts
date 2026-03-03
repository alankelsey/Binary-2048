export type SessionClass = "ranked" | "unranked";

export function canContinueAfterWin(sessionClass: SessionClass): boolean {
  return sessionClass === "unranked";
}
