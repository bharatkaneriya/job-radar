// Each source exposes:
//   name, label, homepage, minIntervalHours
//   fetchRaw(sourceCfg)  -> raw payload (cached to disk)
//   parse(raw, sourceCfg) -> [{ sourceId, title, company, url, location, tags, description, postedAt, salary, jobType }]
// Keeping fetch and parse separate lets the demo mode run on saved fixtures.

import { getJson, getText, htmlToText, toIso, asArray, sleep, decodeEntities } from '../util.js';
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
        console.warn(`  jobicy tag "${tag}": ${e.message}`);
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
        console.warn(`  weworkremotely feed failed: ${e.message}`);
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

export const SOURCES = { remotive, jobicy, himalayas, arbeitnow, weworkremotely, hackernews };
