// Sends requests straight to the route handlers in app/api, matched the way Next matches them.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const API_DIR = path.resolve('app/api');
export const base = 'http://test.local/api';

// Static segments first, the [...path] catch-all last.
const specificity = (dir) => (dir.includes('[...') ? 2 : dir.includes('[') ? 1 : 0);
const routes = fs
  .readdirSync(API_DIR, { recursive: true })
  .filter((f) => path.basename(f) === 'route.js')
  .map((f) => path.dirname(f).replaceAll(path.sep, '/'))
  .sort((a, b) => specificity(a) - specificity(b))
  .map((dir) => ({
    file: path.join(API_DIR, dir, 'route.js'),
    pattern: new RegExp(`^/${dir.replace(/\[\.\.\.(\w+)\]/g, '(?<$1>.+)').replace(/\[(\w+)\]/g, '(?<$1>[^/]+)')}$`),
  }));

export async function dispatch(req) {
  const sub = new URL(req.url).pathname.replace(/^\/api/, '');
  const hit = routes.find((r) => r.pattern.test(sub));
  const mod = await import(pathToFileURL(hit.file));
  return mod[req.method](req, { params: Promise.resolve({ ...sub.match(hit.pattern).groups }) });
}

// Minimal client that keeps the auth cookie. Rate limits count per ip.
export const client = (ip = '127.0.0.1') => {
  let cookie = '';
  return async (method, path, body) => {
    const res = await dispatch(
      new Request(base + path, {
        method,
        headers: { 'content-type': 'application/json', 'x-forwarded-for': ip, ...(cookie && { cookie }) },
        body: body && JSON.stringify(body),
      })
    );
    const set = res.headers.get('set-cookie');
    if (set) cookie = set.split(';')[0];
    return { status: res.status, body: await res.json() };
  };
};
