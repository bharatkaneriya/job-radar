// Each source exposes:
//   name, label, homepage, minIntervalHours
//   fetchRaw(sourceCfg)  -> raw payload (cached to disk)
//   parse(raw, sourceCfg) -> [{ sourceId, title, company, url, location, tags, description, postedAt, salary, jobType }]
// Keeping fetch and parse separate lets the demo mode run on saved fixtures.

import { getJson, getText, htmlToText, toIso, asArray, sleep, decodeEntities, fixMojibake } from '../util.js';
import { logger } from '../../logger.js';
import { XMLParser } from 'fast-xml-parser';

const remotive = {
  name: 'remotive',
  label: 'Remotive',
  homepage: 'https://remotive.com',
  minIntervalHours: 6, // Remotive asks for no more than ~4 calls a day
  async fetchRaw() {
    return getJson('https://remotive.com/api/remote-jobs?category=software-dev');
  },
  parse(raw) {
    return asArray(raw?.jobs).map((j) => ({
      sourceId: String(j.id),
      title: j.title,
      company: j.company_name,
      url: j.url,
      location: j.candidate_required_location || '',
      tags: asArray(j.tags),
      description: htmlToText(j.description),
      postedAt: toIso(j.publication_date),
      salary: j.salary || '',
      jobType: j.job_type || '',
    }));
  },
};

const jobicy = {
  name: 'jobicy',
  label: 'Jobicy',
  homepage: 'https://jobicy.com',
  minIntervalHours: 3,
  async fetchRaw(cfg) {
    const out = [await getJson('https://jobicy.com/api/v2/remote-jobs?count=50')];
    for (const tag of cfg.tags || []) {
      await sleep(1000);
      try {
        out.push(await getJson(`https://jobicy.com/api/v2/remote-jobs?count=50&tag=${encodeURIComponent(tag)}`));
      } catch (e) {
        logger.warn({ source: 'jobicy', tag, err: e }, 'Source tag fetch failed');
      }
    }
    return out;
  },
  parse(raw) {
    return asArray(raw).flatMap((page) =>
      asArray(page?.jobs).map((j) => {
        const sal = j.annualSalaryMin ? `${j.salaryCurrency || ''} ${j.annualSalaryMin}${j.annualSalaryMax ? '–' + j.annualSalaryMax : ''}/yr`.trim() : '';
        return {
          sourceId: String(j.id),
          title: decodeEntities(j.jobTitle),
          company: j.companyName,
          url: j.url,
          location: j.jobGeo || '',
          tags: [...asArray(j.jobIndustry), ...asArray(j.jobLevel)].map((t) => decodeEntities(t)),
          description: htmlToText(j.jobDescription || j.jobExcerpt),
          postedAt: toIso(j.pubDate),
          salary: sal,
          jobType: asArray(j.jobType).join(', '),
        };
      })
    );
  },
};

const himalayas = {
  name: 'himalayas',
  label: 'Himalayas',
  homepage: 'https://himalayas.app',
  minIntervalHours: 3,
  async fetchRaw(cfg) {
    const pages = [];
    for (let i = 0; i < (cfg.pages || 3); i++) {
      if (i) await sleep(1000);
      const page = await getJson(`https://himalayas.app/jobs/api?limit=20&offset=${i * 20}`);
      pages.push(page);
      if (!asArray(page?.jobs).length) break;
    }
    return pages;
  },
  parse(raw) {
    return asArray(raw).flatMap((page) =>
      asArray(page?.jobs).map((j) => {
        const sal = j.minSalary ? `${j.currency || ''} ${j.minSalary}${j.maxSalary ? '–' + j.maxSalary : ''}`.trim() : '';
        return {
          sourceId: String(j.guid || j.applicationLink || `${j.companyName}-${j.title}`),
          title: j.title,
          company: j.companyName,
          url: j.applicationLink || j.guid,
          location: asArray(j.locationRestrictions).join(', ') || 'Worldwide',
          tags: asArray(j.categories),
          description: htmlToText(j.description || j.excerpt),
          postedAt: toIso(j.pubDate),
          salary: sal,
          jobType: j.employmentType || '',
        };
      })
    );
  },
};

const arbeitnow = {
  name: 'arbeitnow',
  label: 'Arbeitnow',
  homepage: 'https://www.arbeitnow.com',
  minIntervalHours: 3,
  async fetchRaw(cfg) {
    const pages = [];
    for (let p = 1; p <= (cfg.pages || 2); p++) {
      if (p > 1) await sleep(1000);
      pages.push(await getJson(`https://www.arbeitnow.com/api/job-board-api?page=${p}`));
    }
    return pages;
  },
  parse(raw, cfg = {}) {
    return asArray(raw)
      .flatMap((page) => asArray(page?.data))
      .filter((j) => !cfg.remoteOnly || j.remote === true)
      .map((j) => ({
        sourceId: String(j.slug),
        title: j.title,
        company: j.company_name,
        url: j.url,
        location: [...new Set([j.remote ? 'Remote' : '', j.location].filter(Boolean))].join(' · '),
        tags: asArray(j.tags),
        description: htmlToText(j.description),
        postedAt: toIso(j.created_at),
        salary: '',
        jobType: asArray(j.job_types).join(', '),
      }));
  },
};

const xml = new XMLParser({ ignoreAttributes: true, processEntities: true, htmlEntities: true });

const weworkremotely = {
  name: 'weworkremotely',
  label: 'We Work Remotely',
  homepage: 'https://weworkremotely.com',
  minIntervalHours: 3,
  async fetchRaw(cfg) {
    const out = [];
    for (const [i, feed] of (cfg.feeds || []).entries()) {
      if (i) await sleep(1000);
      try {
        out.push(await getText(feed));
      } catch (e) {
        logger.warn({ source: 'weworkremotely', feed, err: e }, 'Source feed fetch failed');
      }
    }
    return out;
  },
  parse(raw) {
    return asArray(raw).flatMap((doc) => {
      const items = asArray(xml.parse(doc)?.rss?.channel?.item);
      return items.map((it) => {
        const full = decodeEntities(String(it.title || ''));
        const idx = full.indexOf(':');
        const company = idx > 0 ? full.slice(0, idx).trim() : '';
        const title = idx > 0 ? full.slice(idx + 1).trim() : full;
        return {
          sourceId: String(it.guid || it.link),
          title,
          company,
          url: it.link,
          location: String(it.region || ''),
          tags: asArray(it.category).map(String),
          description: htmlToText(it.description),
          postedAt: toIso(it.pubDate),
          salary: '',
          jobType: String(it.type || ''),
        };
      });
    });
  },
};

const hackernews = {
  name: 'hackernews',
  label: 'HN Who is hiring',
  homepage: 'https://news.ycombinator.com',
  minIntervalHours: 12,
  async fetchRaw() {
    const search = await getJson(
      'https://hn.algolia.com/api/v1/search_by_date?tags=story,author_whoishiring&query=who%20is%20hiring&hitsPerPage=5'
    );
    const story = asArray(search?.hits).find((h) => /who is hiring/i.test(h.title || ''));
    if (!story) return { story: null, item: null };
    const item = await getJson(`https://hn.algolia.com/api/v1/items/${story.objectID}`);
    return { story: { id: story.objectID, title: story.title }, item };
  },
  parse(raw, cfg = {}) {
    const children = asArray(raw?.item?.children).filter((c) => c && c.text && c.author);
    return children
      .map((c) => {
        const text = htmlToText(c.text);
        const firstLine = text.split('\n')[0].slice(0, 200);
        const parts = firstLine.split('|').map((s) => s.trim());
        return {
          sourceId: String(c.id),
          title: parts[1] || firstLine,
          company: parts[0] || c.author,
          url: `https://news.ycombinator.com/item?id=${c.id}`,
          location: parts.slice(2).join(' | ') || firstLine,
          tags: [],
          description: text,
          postedAt: toIso(c.created_at_i ?? c.created_at),
          salary: '',
          jobType: '',
        };
      })
      .filter((j) => !cfg.remoteOnly || /remote/i.test(j.location + ' ' + j.title));
  },
};

const salaryRange = (min, max, unit = '') =>
  min ? `${min}${max && max !== min ? '–' + max : ''}${unit}` : '';

// RemoteOK's API terms: link back to the job on Remote OK and credit it as the source.
// `url` below is the remoteok.com page, and the source label credits it.
const remoteok = {
  name: 'remoteok',
  label: 'Remote OK',
  homepage: 'https://remoteok.com',
  minIntervalHours: 6,
  async fetchRaw(cfg) {
    const out = [];
    for (const [i, tag] of (cfg.tags || ['dev']).entries()) {
      if (i) await sleep(1500);
      try {
        out.push(await getJson(`https://remoteok.com/api?tag=${encodeURIComponent(tag)}`));
      } catch (e) {
        logger.warn({ source: 'remoteok', tag, err: e }, 'Source tag fetch failed');
      }
    }
    return out;
  },
  parse(raw) {
    return asArray(raw)
      .flatMap((page) => asArray(page))
      .filter((j) => j && j.id && j.position) // the first element is the legal notice
      .map((j) => ({
        sourceId: String(j.id),
        title: decodeEntities(fixMojibake(j.position)),
        company: decodeEntities(fixMojibake(j.company)),
        url: j.url || `https://remoteok.com/remote-jobs/${j.slug}`,
        location: fixMojibake(j.location) || 'Remote',
        tags: asArray(j.tags).map(String),
        description: htmlToText(fixMojibake(j.description)),
        postedAt: toIso(j.epoch ?? j.date),
        salary: salaryRange(j.salary_min, j.salary_max, ' USD/yr'),
        jobType: '',
      }));
  },
};

const workingnomads = {
  name: 'workingnomads',
  label: 'Working Nomads',
  homepage: 'https://www.workingnomads.com',
  minIntervalHours: 6,
  async fetchRaw() {
    return getJson('https://www.workingnomads.com/api/exposed_jobs/');
  },
  parse(raw, cfg = {}) {
    const cats = (cfg.categories || []).map((c) => c.toLowerCase());
    return asArray(raw)
      .filter((j) => !cats.length || cats.includes(String(j.category_name || '').toLowerCase()))
      .map((j) => ({
        sourceId: String(j.url).match(/\/(\d+)\/?$/)?.[1] || String(j.url),
        title: decodeEntities(j.title),
        company: decodeEntities(j.company_name),
        url: j.url,
        location: j.location || 'Remote',
        tags: String(j.tags || '').split(',').map((t) => t.trim()).filter(Boolean),
        description: htmlToText(j.description),
        postedAt: toIso(j.pub_date),
        salary: '',
        jobType: '',
      }));
  },
};

// Company career boards hosted on Greenhouse / Ashby. Both expose free, keyless JSON APIs.
// Admins pick the companies via `boards` (the slug in the board URL).
const REMOTE_RE = /remote|anywhere|worldwide|distributed/i;

async function fetchBoards(source, boards, urlFor) {
  const out = [];
  for (const [i, board] of asArray(boards).entries()) {
    if (i) await sleep(500);
    try {
      out.push({ board, data: await getJson(urlFor(board)) });
    } catch (e) {
      logger.warn({ source, board, err: e }, 'Source board fetch failed');
    }
  }
  return out;
}

const greenhouse = {
  name: 'greenhouse',
  label: 'Greenhouse boards',
  homepage: 'https://www.greenhouse.com',
  minIntervalHours: 6,
  fetchRaw: (cfg) =>
    fetchBoards('greenhouse', cfg.boards, (b) => `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(b)}/jobs?content=true`),
  parse(raw, cfg = {}) {
    return asArray(raw).flatMap(({ board, data }) =>
      asArray(data?.jobs)
        .map((j) => ({
          sourceId: `${board}:${j.id}`,
          title: decodeEntities(j.title),
          company: j.company_name || board,
          url: j.absolute_url,
          location: j.location?.name || '',
          tags: asArray(j.departments).map((d) => d.name).filter(Boolean),
          description: htmlToText(decodeEntities(j.content)), // content arrives HTML-escaped
          postedAt: toIso(j.first_published || j.updated_at),
          salary: '',
          jobType: '',
        }))
        .filter((j) => !cfg.remoteOnly || REMOTE_RE.test(j.location))
    );
  },
};

const ashby = {
  name: 'ashby',
  label: 'Ashby boards',
  homepage: 'https://www.ashbyhq.com',
  minIntervalHours: 6,
  fetchRaw: (cfg) =>
    fetchBoards('ashby', cfg.boards, (b) => `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(b)}?includeCompensation=true`),
  parse(raw, cfg = {}) {
    return asArray(raw).flatMap(({ board, data }) =>
      asArray(data?.jobs)
        .filter((j) => j.isListed !== false)
        .filter((j) => !cfg.remoteOnly || j.isRemote || REMOTE_RE.test(`${j.workplaceType} ${j.location}`))
        .map((j) => ({
          sourceId: `${board}:${j.id}`,
          title: j.title,
          company: board.charAt(0).toUpperCase() + board.slice(1),
          url: j.jobUrl,
          location: [j.location, ...asArray(j.secondaryLocations).map((l) => l.location)].filter(Boolean).join(', ') || 'Remote',
          tags: [j.department, j.team].filter(Boolean),
          description: j.descriptionPlain || htmlToText(j.descriptionHtml),
          postedAt: toIso(j.publishedAt),
          salary: j.compensation?.compensationTierSummary || '',
          jobType: j.employmentType || '',
        }))
    );
  },
};

export const SOURCES = { remotive, jobicy, himalayas, arbeitnow, weworkremotely, hackernews, remoteok, workingnomads, greenhouse, ashby };
