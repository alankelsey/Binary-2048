export function researchRequestHeaders(headers = {}) {
  const apiKey = (process.env.BINARY2048_API_KEY ?? "").trim();
  if (!apiKey) throw new Error("BINARY2048_API_KEY is required for research API requests");
  const challengeToken = (process.env.BINARY2048_CHALLENGE_TOKEN ?? "").trim();
  return {
    ...headers,
    "x-api-key": apiKey,
    ...(challengeToken ? { "x-binary2048-challenge-token": challengeToken } : {})
  };
}
