// Scores a normalized job against a scoring config. Higher = better fit.
// Returns { score, matched: [skill names], flags: [reasons it was pushed down] }.
// buildScoreConfig(profile) turns a user's profile into that config.

import * as D from './defaults.js';
import { escapeRe } from './util.js';

const cache = new Map();
const re = (p) => {
  if (!cache.has(p)) cache.set(p, new RegExp(p, 'i'));
  return cache.get(p);
};

export function scoreJob(job, cfg) {
  const title = String(job.title || '');
  const body = `${(job.tags || []).join(' ')}\n${job.description || ''}`;
  const location = String(job.location || '');
  let score = 0;
  const matched = [];
  const flags = [];

  for (const s of cfg.skills) {
    const r = re(s.pattern);
    if (r.test(title)) {
      score += s.weight * cfg.titleMultiplier;
      matched.push(s.name);
    } else if (r.test(body)) {
      score += s.weight;
      matched.push(s.name);
    }
  }

  for (const n of cfg.negative) {
    const hay = n.scope === 'any' ? `${title}\n${body}` : title;
    if (re(n.pattern).test(hay)) {
      score -= n.penalty;
      flags.push(n.label);
    }
  }

  // Location: explicit restriction in the text wins over everything.
  const loc = cfg.location;
  const head = `${title}\n${location}\n${body.slice(0, 3000)}`;
  const bodyHit = loc.bodyBlock.find((p) => re(p).test(head));
  if (bodyHit) {
    score -= loc.blockPenalty;
    const m = head.match(re(bodyHit));
    flags.push(`Location rule: "${m ? m[0] : 'restricted'}"`);
  } else if (location && re(loc.allow).test(location)) {
    score += loc.allowBonus;
  } else if (location && loc.regionBlock && re(loc.regionBlock).test(location)) {
    score -= loc.blockPenalty;
    flags.push(`Location: ${location.slice(0, 60)}`);
  }

  if (cfg.freelanceBonus && re(cfg.freelanceBonus.pattern).test(`${title}\n${job.jobType || ''}\n${body.slice(0, 3000)}`)) {
    score += cfg.freelanceBonus.points;
    matched.push('Contract/freelance');
  }

  return { score: Math.round(score), matched, flags };
}

// "Vue" → \bvue\b ; names that start/end with a symbol (C#, .NET) can't use \b on that side.
export function keywordPattern(name) {
  const key = String(name).trim().toLowerCase();
  if (D.SKILL_PATTERNS[key]) return D.SKILL_PATTERNS[key];
  const body = escapeRe(key).replace(/\s+/g, '[- ]?');
  const pre = /^\w/.test(key) ? '\\b' : '(^|\\W)';
  const post = /\w$/.test(key) ? '\\b' : '(?=\\W|$)';
  return `${pre}${body}${post}`;
}

const anyOf = (patterns) => (patterns.length ? `(${patterns.join('|')})` : null);

export function buildScoreConfig(profile = {}) {
  const prefs = profile.preferences || {};
  const skills = (profile.skills || [])
    .filter((s) => s?.name?.trim())
    .map((s) => ({ name: s.name.trim(), pattern: keywordPattern(s.name), weight: Number(s.weight) || 1 }));

  for (const k of prefs.includeKeywords || []) {
    if (k?.trim()) skills.push({ name: k.trim(), pattern: keywordPattern(k), weight: D.includeKeywordPoints });
  }

  // Penalise other main stacks only if the user doesn't list them.
  const mine = skills.map((s) => re(s.pattern));
  const otherStacks = D.OTHER_STACKS.filter((p) => !mine.some((r) => r.test(p.replace(/\\/g, ''))));
  const negative = [...D.DEFAULT_NEGATIVE];
  if (otherStacks.length) {
    negative.push({ label: 'Different main stack', pattern: `\\b(${otherStacks.join('|')})\\b`, scope: 'title', penalty: D.otherStackPenalty });
  }
  for (const k of prefs.excludeKeywords || []) {
    if (k?.trim()) negative.push({ label: `Excluded: ${k.trim()}`, pattern: keywordPattern(k), scope: 'any', penalty: 40 });
  }

  // Preferred locations: always welcome, and removed from the blocked-region list.
  const preferred = (prefs.preferredLocations || []).map((l) => l.trim().toLowerCase()).filter(Boolean);
  const allow = anyOf([D.DEFAULT_LOCATION.allow, ...preferred.map(keywordPattern)]);
  const blocked = D.DEFAULT_LOCATION.regionBlock.filter((r) => !preferred.some((p) => re(`^${r}$`).test(p)));
  const location = {
    ...D.DEFAULT_LOCATION,
    allow,
    regionBlock: blocked.length ? `\\b(${blocked.join('|')})\\b` : null,
    bodyBlock: preferred.length ? D.DEFAULT_LOCATION.bodyBlock.filter((p) => !preferred.some((l) => re(p).test(`${l}-only`) || re(p).test(`must be in ${l}`))) : D.DEFAULT_LOCATION.bodyBlock,
  };

  const jobTypes = prefs.jobTypes || [];
  const wantsFreelance = !jobTypes.length || jobTypes.some((t) => t !== 'full-time');

  return {
    skills,
    titleMultiplier: D.titleMultiplier,
    negative,
    location,
    freelanceBonus: wantsFreelance ? D.freelanceBonus : null,
    minScore: prefs.minScore ?? 15,
    maxAgeDays: prefs.maxAgeDays ?? 14,
    remoteOnly: !!prefs.remoteOnly,
    jobTypes,
  };
}

// Hard filters that run before scoring. Jobs that don't say their type are kept.
export function passesFilters(job, cfg) {
  if (cfg.remoteOnly) {
    const hay = `${job.title}\n${job.location}\n${job.jobType}`;
    const sayRemote = /remote|anywhere|worldwide|global/i.test(hay);
    const sayOnsite = /\b(on[- ]?site|in[- ]office|hybrid)\b/i.test(hay);
    // Most sources are remote-only boards; only drop posts that say they're on-site.
    if (sayOnsite && !sayRemote) return false;
  }
  if (cfg.jobTypes?.length && job.jobType) {
    const known = Object.values(D.JOB_TYPE_PATTERNS).some((p) => re(p).test(job.jobType));
    if (known && !cfg.jobTypes.some((t) => D.JOB_TYPE_PATTERNS[t] && re(D.JOB_TYPE_PATTERNS[t]).test(job.jobType))) return false;
  }
  return true;
}
