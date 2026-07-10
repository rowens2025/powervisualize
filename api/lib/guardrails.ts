/**
 * RyAgent guardrails — preflight safety + intent routing shared by the
 * streaming chat endpoint. Ported from the original single-shot handler so the
 * two endpoints behave identically on rate limiting, lockouts, moderation, and
 * the canned intent replies.
 */
import type { VercelRequest } from '@vercel/node';

export type ChatMsg = { role: 'user' | 'assistant'; content: string };

export type PageContext = {
  path?: string;
  title?: string;
  pageSlug?: string;
  pageType?: string;
};

export type Intent =
  | 'ACKNOWLEDGEMENT'
  | 'PROFESSIONAL'
  | 'PERSONAL'
  | 'MADISON'
  | 'WORK_STYLE'
  | 'PAGE_CONTEXT'
  | 'PERSONALITY';

const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_MAX = 20;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;

const rateMap = new Map<string, { count: number; resetAt: number }>();
const strikeMap = new Map<string, { strikes: number; lastStrikeAt: number; lockedUntil?: number }>();

export function getClientIp(req: VercelRequest): string {
  const xfwd = req.headers['x-forwarded-for'];
  if (typeof xfwd === 'string' && xfwd.length > 0) return xfwd.split(',')[0].trim();
  const realIp = req.headers['x-real-ip'];
  if (typeof realIp === 'string' && realIp.length > 0) return realIp;
  return req.socket?.remoteAddress || 'unknown';
}

export function rateLimit(req: VercelRequest): { ok: true } | { ok: false; retryAfterSec: number } {
  const ip = getClientIp(req);
  const now = Date.now();
  const entry = rateMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return { ok: true };
  }
  entry.count += 1;
  if (entry.count > RATE_MAX) {
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)) };
  }
  return { ok: true };
}

export function checkStrikes(req: VercelRequest): { strikes: number; lockedUntil?: number } {
  const ip = getClientIp(req);
  const now = Date.now();
  const entry = strikeMap.get(ip);
  if (!entry) return { strikes: 0 };
  if (entry.lockedUntil && now < entry.lockedUntil) return { strikes: entry.strikes, lockedUntil: entry.lockedUntil };
  if (entry.lockedUntil && now >= entry.lockedUntil) {
    strikeMap.set(ip, { strikes: 0, lastStrikeAt: 0 });
    return { strikes: 0 };
  }
  return { strikes: entry.strikes };
}

export function addStrike(req: VercelRequest): { strikes: number; lockedUntil?: number } {
  const ip = getClientIp(req);
  const now = Date.now();
  const entry = strikeMap.get(ip) || { strikes: 0, lastStrikeAt: 0 };
  entry.strikes += 1;
  entry.lastStrikeAt = now;
  if (entry.strikes >= 3) entry.lockedUntil = now + LOCKOUT_DURATION_MS;
  strikeMap.set(ip, entry);
  return { strikes: entry.strikes, lockedUntil: entry.lockedUntil };
}

export function checkContentModeration(question: string): { allowed: boolean; reason?: string; severity?: 'strike' | 'warn' } {
  const lower = question.toLowerCase();
  if (lower.includes('madison larocca') || lower.includes('madison avery') || lower.includes('this is madison')) {
    return { allowed: true };
  }

  // Explicit sexual content only. Casual profanity ("this is shit", "fucking
  // cool") is NOT blocked — the assistant just replies professionally.
  const sexualPatterns = [
    /\b(sexual|nude|naked|porn|pornography|erotic|orgasm|masturbat|penis|vagina|pussy)\b/i,
    /\b(blowjob|handjob|cumshot|deepthroat)\b/i,
  ];
  for (const p of sexualPatterns) if (p.test(lower)) return { allowed: false, reason: 'explicit_content', severity: 'strike' };

  // Only unambiguous hate/violence. Common words like "hate", "kill", "hurt",
  // "attack" are benign in a data/chart context ("I hate bar charts", "kill the
  // legend") and must NOT trigger a strike.
  const harassmentPatterns = [
    /\b(racist|racism|nazi|slur|bigot|kkk|lynch|genocide)\b/i,
    /\b(rape|raping|molest|murder someone)\b/i,
  ];
  for (const p of harassmentPatterns) if (p.test(lower)) return { allowed: false, reason: 'harassment', severity: 'strike' };

  const careerKeywords = [
    'skill', 'project', 'experience', 'ryan', 'power bi', 'python', 'sql', 'azure', 'synapse', 'data',
    'analytics', 'engineering', 'modeling', 'dashboard', 'portfolio', 'github', 'repo', 'a/b', 'testing',
    'geospatial', 'react', 'vite', 'tailwind', 'devops', 'ci/cd', 'mortgage', 'fannie', 'visualization', 'chart',
  ];
  const hasCareerKeyword = careerKeywords.some((k) => lower.includes(k));
  if (!hasCareerKeyword && question.length > 20) {
    const offTopicPatterns = [
      /\b(weather|sports|politics|religion|cooking|recipe|movie|music|game|gaming)\b/i,
      /^(hi|hello|hey|what|who|when|where|why|how)\s+[^?]*\?$/i,
    ];
    for (const p of offTopicPatterns) if (p.test(lower)) return { allowed: false, reason: 'off_topic', severity: 'warn' };
  }
  return { allowed: true };
}

export function classifyIntent(question: string): Intent {
  const lower = question.toLowerCase().trim();

  const pageContextPatterns = [
    /^(what page am i on|where am i|what is this page|what project is this|tell me about this page)$/i,
    /\b(what page|where am i|what is this|tell me about this page|what project is this|what am i looking at|explain this)\b/i,
  ];
  if (pageContextPatterns.some((p) => p.test(lower))) return 'PAGE_CONTEXT';

  const personalityPatterns = [
    /\b(does ryan (like|enjoy|love)|ryan.*(favorite|favourite|hobby|hobbies|interest|interests))\b/i,
    /\b(favorite movie|favourite movie|favorite movies|favourite movies)\b/i,
    /\b(snowboarding|skiing|movies|lord.*ring|lotr)\b/i,
  ];
  if (personalityPatterns.some((p) => p.test(lower))) return 'PERSONALITY';

  if (lower.includes('madison larocca') || lower.includes('madison avery') || lower.includes('this is madison')) return 'MADISON';

  const acknowledgementPatterns = [/^(ok|okay|cool|thanks|thank you|got it|sounds good|nice|alright|sure|yep|yeah|yes|no|nope)\s*[.!?]*$/i];
  if (acknowledgementPatterns.some((p) => p.test(lower))) return 'ACKNOWLEDGEMENT';

  const workStylePatterns = [
    /\b(like.*work|enjoy.*work|passionate.*work|motivated|what.*motivate|what.*drive|work.*ethic|love.*work|passion.*data)\b/i,
    /\b(does ryan|is ryan)\s+(like|enjoy|love|passionate|motivated)\b/i,
  ];
  if (workStylePatterns.some((p) => p.test(lower))) return 'WORK_STYLE';

  const personalPatterns = [
    /\b(family|wife|husband|kids|children|personal.*life|dating|relationship.*status|cousins|siblings|parents)\b/i,
  ];
  if (personalPatterns.some((p) => p.test(lower)) && !lower.includes('skill') && !lower.includes('work') && !lower.includes('data')) {
    return 'PERSONAL';
  }

  return 'PROFESSIONAL';
}

// --- canned replies for non-professional intents (streamed as one message) ---

export const MADISON_REPLIES = [
  "Hey Mads, I'm working, but wish we were in Aruba ;)",
  "Hey Mads, I'm working, but I'll take you out for tacos later",
  "Hey Mads, I'm working, but let's grab McDonald's later",
];

export const WORK_STYLE_REPLY =
  "Yes—Ryan clearly enjoys building data products and solving problems. His portfolio shows sustained investment in analytics engineering, automation, and shipping real systems, and he's relocating to NYC for career growth. Outside work he's into skiing/snowboarding (Beaver Creek), cooking, concerts, hiking, and marathon training, and he's a die-hard Eagles fan. Python is his favorite language; SQL was his first love. To learn more, visit the contact section.";

export const PERSONAL_REPLY =
  "Ryan keeps his personal life private. In general, he values family and relationships, but this assistant focuses on his professional work. If you'd like to speak directly, visit the contact section.";

export const ACK_REPLY =
  "Glad to help — feel free to ask about projects, tools, or how Ryan approaches his work.";

export const STRIKE_MESSAGES = [
  "I can only help with Ryan's skills, projects, and data work. Please keep questions professional and career-related.",
  "I can't help with that. If you're evaluating Ryan for a role, ask about skills/projects. For direct contact, visit the contact section.",
  "Chat is being locked due to repeated policy violations. For direct contact, visit the contact section.",
];
