const UA = 'job-radar/1.0 (personal job search tool)';

export async function getText(url, { timeoutMs = 20000 } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': UA,
        Accept: 'application/json, application/rss+xml, text/xml;q=0.9, */*;q=0.8',
      },
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return await res.text();
  } catch (err) {
    if (err.name === 'AbortError') throw new Error(`Timed out after ${timeoutMs / 1000}s: ${url}`);
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export async function getJson(url, opts) {
  return JSON.parse(await getText(url, opts));
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'", '#x27': "'", '#x2F': '/', ndash: '–', mdash: '—', hellip: '…', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“' };

export function decodeEntities(s = '') {
  return String(s)
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z0-9#]+);/gi, (m, n) => ENTITIES[n] ?? ENTITIES[n.toLowerCase()] ?? m);
}

export function htmlToText(html = '') {
  const text = String(html)
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, '\n')
    .replace(/<p[^>]*>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, ' ');
  return decodeEntities(text)
    .replace(/[ \t ]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// Accepts ISO strings, RFC-822 dates, unix seconds or ms. Returns ISO or ''.
export function toIso(v) {
  if (v === undefined || v === null || v === '') return '';
  if (typeof v === 'number' || /^\d+$/.test(String(v))) {
    const n = Number(v);
    const d = new Date(n < 1e12 ? n * 1000 : n);
    return isNaN(d) ? '' : d.toISOString();
  }
  const d = new Date(v);
  return isNaN(d) ? '' : d.toISOString();
}

export function normKey(s = '') {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '');
}

export const escapeRe = (s = '') => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const asArray =(v) => (Array.isArray(v) ? v : v === undefined || v === null || v === '' ? [] : [v]);
