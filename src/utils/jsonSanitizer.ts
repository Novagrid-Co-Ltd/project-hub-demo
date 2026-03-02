export function sanitizeAndParseJson<T = unknown>(raw: string): T | null {
  // 1. Strip ```json ... ``` code fences
  const fenceMatch = raw.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  const content = fenceMatch ? fenceMatch[1]!.trim() : raw.trim();

  // 2. Try direct parse
  try {
    return JSON.parse(content) as T;
  } catch {
    // continue
  }

  // 3. Extract first { to last }
  const firstBrace = content.indexOf("{");
  const lastBrace = content.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace === -1 || firstBrace >= lastBrace) {
    return null;
  }

  try {
    return JSON.parse(content.slice(firstBrace, lastBrace + 1)) as T;
  } catch {
    return null;
  }
}
