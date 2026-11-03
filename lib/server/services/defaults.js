// Defaults carried over from the old config.js. Profiles override skills,
// locations and keywords; the rules below apply to everyone.
// Patterns are regular expressions (case-insensitive). '\\b' is a word boundary.

// Source options. Stored in the Setting collection on first use; admins can edit them.
export const DEFAULT_SOURCES = {
  remotive: { enabled: true }, // asks for max ~4 requests/day → minIntervalHours 6
  jobicy: { enabled: true, tags: ['laravel', 'react', 'php', 'nodejs', 'shopify'] },
  himalayas: { enabled: true, pages: 3 }, // 20 jobs per page
  arbeitnow: { enabled: true, pages: 2, remoteOnly: true },
  weworkremotely: {
    enabled: true,
    feeds: [
      'https://weworkremotely.com/categories/remote-full-stack-programming-jobs.rss',
      'https://weworkremotely.com/categories/remote-back-end-programming-jobs.rss',
      'https://weworkremotely.com/categories/remote-front-end-programming-jobs.rss',
    ],
  },
  hackernews: { enabled: true, remoteOnly: true }, // monthly "Who is hiring?" thread
};

// Pre-filled for new profiles; users edit names and weights.
export const SUGGESTED_SKILLS = [
  { name: 'Laravel', weight: 10 },
  { name: 'PHP', weight: 6 },
  { name: 'React', weight: 8 },
  { name: 'Node.js', weight: 6 },
  { name: 'Shopify', weight: 8 },
  { name: 'MySQL', weight: 4 },
  { name: 'PostgreSQL', weight: 4 },
  { name: 'JavaScript', weight: 3 },
  { name: 'TypeScript', weight: 3 },
  { name: 'Next.js', weight: 3 },
  { name: 'Full-stack', weight: 3 },
  { name: 'Tailwind', weight: 2 },
];

// Well-known skills whose names don't make a good regex on their own.
export const SKILL_PATTERNS = {
  'react': '\\breact(\\.?js)?\\b',
  'node.js': 'node\\.?js|\\bnestjs\\b|express\\.js',
  'node': 'node\\.?js|\\bnestjs\\b|express\\.js',
  'postgresql': '\\bpostgres(ql)?\\b',
  'postgres': '\\bpostgres(ql)?\\b',
  'next.js': '\\bnext\\.?js\\b',
  'nextjs': '\\bnext\\.?js\\b',
  'vue': '\\bvue(\\.?js)?\\b',
  'vue.js': '\\bvue(\\.?js)?\\b',
  'full-stack': '\\bfull[- ]?stack\\b',
  'fullstack': '\\bfull[- ]?stack\\b',
  'livewire/inertia': '\\b(livewire|inertia(\\.?js)?)\\b',
  'erp/crm': '\\b(erp|crm)\\b',
  'android': '\\b(android|kotlin|react native)\\b',
  'apis': '\\brest(ful)? api|\\brestful\\b|\\bgraphql\\b',
  'c#': '(^|[^a-z])c#',
  'c++': '(^|[^a-z])c\\+\\+',
  '.net': '\\.net\\b',
};

export const titleMultiplier = 2;

// What to push down. scope: 'title' checks only the job title; 'any' checks title + description.
// "Different main stack" is dropped when the user lists one of those languages as a skill.
export const DEFAULT_NEGATIVE = [
  { label: 'Not a dev role', pattern: '\\b(sales|marketing|recruit(er|ing)|account (executive|manager)|customer (support|success)|designer|copywriter|data (scientist|analyst))\\b', scope: 'title', penalty: 40 },
  { label: 'Junior/intern', pattern: '\\b(intern(ship)?|junior|trainee|graduate)\\b', scope: 'title', penalty: 8 },
  { label: 'Leadership track', pattern: '\\b(director|vp|head of|chief|cto)\\b', scope: 'title', penalty: 6 },
  { label: 'On-site/hybrid', pattern: '\\b(on[- ]?site|in[- ]office|hybrid)\\b', scope: 'title', penalty: 10 },
];
export const OTHER_STACKS = ['java', 'golang', 'ruby', 'rails', '\\.net', 'c#', 'scala', 'rust', 'elixir', 'python', 'django', 'ios', 'swift'];
export const otherStackPenalty = 12;

export const DEFAULT_LOCATION = {
  // Used when the profile has no preferred locations.
  allow: '\\b(worldwide|anywhere|global(ly)?)\\b',
  // Location field is only one of these regions → penalty (unless the user prefers it).
  regionBlock: ['usa?', 'u\\.s\\.a?\\.?', 'united states', 'canada', 'north america', 'americas', 'latam', 'latin america', 'uk', 'united kingdom', 'europe', 'eu', 'eea', 'emea', 'germany', 'deutschland', 'berlin', 'munich', 'hamburg', 'france', 'spain', 'netherlands', 'poland', 'australia'],
  // Description says it outright → penalty.
  bodyBlock: [
    '\\b(us|usa|u\\.s\\.|uk|eu)[- ]only\\b',
    'must (be|reside|live|be located|be based)( in| within)? (the )?(us|usa|united states|canada|uk|europe|eu|eea)\\b',
    'only (open to|accepting|considering) (candidates|applicants) (in|from|based in|located in) (the )?(us|usa|united states|canada|uk|europe|eu)\\b',
    '(legally )?(eligible|authori[sz]ed) to work in the (us|united states|uk|eu)\\b',
    '\\bsecurity clearance\\b',
    '\\b(us|u\\.s\\.) citizens?\\b',
  ],
  allowBonus: 4,
  blockPenalty: 35,
};

export const freelanceBonus = { pattern: '\\b(contract(or)?|freelance(r)?|part[- ]time|project[- ]based|fixed[- ]price)\\b', points: 4 };
export const includeKeywordPoints = 3;

export const JOB_TYPE_PATTERNS = {
  'full-time': '\\bfull[- _]?time\\b|\\bpermanent\\b',
  'part-time': '\\bpart[- _]?time\\b',
  'contract': '\\bcontract(or)?\\b|\\btemporary\\b',
  'freelance': '\\bfreelance(r)?\\b|\\bproject[- ]based\\b',
};

export const STATUSES = ['new', 'saved', 'applied', 'interview', 'offer', 'rejected', 'skipped'];
