export const COMMON_GATE_PATTERNS = [
  /\[y\/N\]/i,
  /\(yes\/no\)/i,
  /\(y\/n\)/i,
  /Do you want to proceed\?/i,
  /Allow edit\?/i,
  /Are you sure/i,
];

export const HIGH_RISK_KEYWORDS = [
  /delete/i,
  /force push/i,
  /drop table/i,
  /rm -rf/i,
  /overwrite/i,
  /\bDROP\b/i,
  /\bTRUNCATE\b/i,
];

export function checkGate(text: string): { matches: boolean; highRisk: boolean } {
  const highRisk = HIGH_RISK_KEYWORDS.some(pattern => pattern.test(text));
  const matches = highRisk || COMMON_GATE_PATTERNS.some(pattern => pattern.test(text));
  return { matches, highRisk };
}
