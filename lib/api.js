// Thin fetch wrapper for this app's API routes (app/api).
export class ApiError extends Error {
  constructor(status, message, fields) {
    super(message);
    this.status = status;
    this.fields = fields;
  }
}

export async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(`/api${path}`, {
    method,
    credentials: 'same-origin',
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    // empty or non-JSON body
  }
  if (!res.ok) throw new ApiError(res.status, data?.error || `Request failed (${res.status})`, data?.fields);
  return data;
}

// SWR fetcher: key is the API path.
export const fetcher = (path) => api(path);

export const qs = (params) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') p.set(k, v);
  const s = p.toString();
  return s ? `?${s}` : '';
};

export const STATUSES = [
  { value: 'new', label: 'New', cls: 'bg-sky-100 text-sky-800' },
  { value: 'saved', label: 'Saved', cls: 'bg-violet-100 text-violet-800' },
  { value: 'applied', label: 'Applied', cls: 'bg-amber-100 text-amber-800' },
  { value: 'interview', label: 'Interview', cls: 'bg-emerald-100 text-emerald-800' },
  { value: 'offer', label: 'Offer', cls: 'bg-green-200 text-green-900' },
  { value: 'rejected', label: 'Rejected', cls: 'bg-rose-100 text-rose-800' },
  { value: 'skipped', label: 'Skipped', cls: 'bg-slate-200 text-slate-600' },
];
export const statusMeta = (v) => STATUSES.find((s) => s.value === v) || STATUSES[0];

export function timeAgo(date) {
  if (!date) return '';
  const s = (Date.now() - new Date(date)) / 1000;
  if (s < 60) return 'just now';
  const units = [['y', 31536000], ['mo', 2592000], ['d', 86400], ['h', 3600], ['m', 60]];
  for (const [u, n] of units) if (s >= n) return `${Math.floor(s / n)}${u} ago`;
  return '';
}
