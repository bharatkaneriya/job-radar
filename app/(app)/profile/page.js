'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import { api, fetcher } from '@/lib/api';
import { useSession } from '@/components/AppShell';
import ChipInput from '@/components/ChipInput';
import { PageHeader, Alert, Spinner } from '@/components/ui';

const JOB_TYPES = [
  ['full-time', 'Full-time'],
  ['part-time', 'Part-time'],
  ['contract', 'Contract'],
  ['freelance', 'Freelance'],
];

const toForm = (p) => ({
  headline: p?.headline || '',
  experienceYears: p?.experienceYears || 0,
  skills: p?.skills?.length ? p.skills.map(({ name, weight }) => ({ name, weight })) : [],
  preferences: {
    includeKeywords: p?.preferences?.includeKeywords || [],
    excludeKeywords: p?.preferences?.excludeKeywords || [],
    preferredLocations: p?.preferences?.preferredLocations || [],
    remoteOnly: p?.preferences?.remoteOnly ?? true,
    jobTypes: p?.preferences?.jobTypes || [],
    minScore: p?.preferences?.minScore ?? 15,
    maxAgeDays: p?.preferences?.maxAgeDays ?? 14,
  },
  sources: p?.sources || [],
});

function Section({ title, hint, children }) {
  return (
    <section className="card p-6">
      <h2 className="font-semibold text-slate-900">{title}</h2>
      {hint && <p className="mt-1 text-sm text-slate-500">{hint}</p>}
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

function ProfileInner() {
  const router = useRouter();
  const welcome = useSearchParams().get('welcome');
  const { refresh } = useSession();
  const { data } = useSWR('/profile', fetcher, { revalidateOnFocus: false });
  const [form, setForm] = useState(null);
  const [newSkill, setNewSkill] = useState('');
  const [msg, setMsg] = useState({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (data && !form) setForm(toForm(data.profile));
  }, [data, form]);

  if (!form) return <Spinner className="h-6 w-6 text-slate-400" />;

  const pref = (k, v) => setForm({ ...form, preferences: { ...form.preferences, [k]: v } });
  const setSkill = (i, patch) => setForm({ ...form, skills: form.skills.map((s, j) => (j === i ? { ...s, ...patch } : s)) });
  const addSkill = (name) => {
    name = name.trim();
    if (!name || form.skills.some((s) => s.name.toLowerCase() === name.toLowerCase())) return;
    setForm({ ...form, skills: [...form.skills, { name, weight: 5 }] });
    setNewSkill('');
  };
  const toggle = (list, v) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    setMsg({});
    try {
      const res = await api('/profile', { method: 'PUT', body: form });
      await refresh();
      if (welcome) return router.replace('/jobs');
      setMsg({ ok: `Saved. ${res.match.matched} matching jobs (${res.match.added} new).` });
    } catch (err) {
      setMsg({ error: err.message });
    } finally {
      setBusy(false);
    }
  };

  const suggestions = (data.suggestedSkills || []).map((s) => s.name).filter((n) => !form.skills.some((s) => s.name.toLowerCase() === n.toLowerCase()));

  return (
    <form onSubmit={save} className="space-y-6">
      <PageHeader title="Profile" subtitle="Your skills and preferences decide which jobs you see and how they're scored." />
      {welcome && <Alert kind="info">Welcome! Check the skills below (we pre-filled common ones), set your preferences, then save to get your first matches.</Alert>}

      <Section title="About you">
        <div className="grid gap-4 md:grid-cols-[1fr_160px]">
          <div>
            <label className="label" htmlFor="headline">Headline</label>
            <input id="headline" className="input" placeholder="Full-stack developer (Laravel, React)" value={form.headline} onChange={(e) => setForm({ ...form, headline: e.target.value })} />
          </div>
          <div>
            <label className="label" htmlFor="exp">Years of experience</label>
            <input id="exp" type="number" min="0" max="60" className="input" value={form.experienceYears} onChange={(e) => setForm({ ...form, experienceYears: e.target.value })} />
          </div>
        </div>
      </Section>

      <Section title="Skills" hint="Weight = points when a post mentions the skill (doubled when it's in the title). Put your main stack at 8–10.">
        {form.skills.length === 0 && <p className="text-sm text-slate-500">No skills yet. Add at least one.</p>}
        <div className="space-y-2">
          {form.skills.map((s, i) => (
            <div key={i} className="flex items-center gap-3">
              <input className="input max-w-48" value={s.name} onChange={(e) => setSkill(i, { name: e.target.value })} aria-label="Skill name" />
              <input type="range" min="1" max="10" value={s.weight} onChange={(e) => setSkill(i, { weight: Number(e.target.value) })} className="flex-1 accent-brand-600" aria-label={`${s.name} weight`} />
              <span className="w-6 text-right text-sm font-semibold text-slate-700">{s.weight}</span>
              <button type="button" className="btn-secondary btn-sm" onClick={() => setForm({ ...form, skills: form.skills.filter((_, j) => j !== i) })} aria-label={`Remove ${s.name}`}>
                ✕
              </button>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            className="input max-w-64"
            placeholder="Add a skill, e.g. Vue"
            value={newSkill}
            onChange={(e) => setNewSkill(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addSkill(newSkill);
              }
            }}
          />
          <button type="button" className="btn-secondary" onClick={() => addSkill(newSkill)}>
            Add
          </button>
        </div>
        {suggestions.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {suggestions.map((n) => (
              <button key={n} type="button" className="chip cursor-pointer hover:bg-slate-200" onClick={() => addSkill(n)}>
                + {n}
              </button>
            ))}
          </div>
        )}
      </Section>

      <Section title="Job preferences">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="label">Boost keywords</label>
            <ChipInput value={form.preferences.includeKeywords} onChange={(v) => pref('includeKeywords', v)} placeholder="e.g. SaaS, e-commerce" />
            <p className="mt-1 text-xs text-slate-500">+3 points each when mentioned.</p>
          </div>
          <div>
            <label className="label">Avoid keywords</label>
            <ChipInput value={form.preferences.excludeKeywords} onChange={(v) => pref('excludeKeywords', v)} placeholder="e.g. crypto, gambling" />
            <p className="mt-1 text-xs text-slate-500">−40 points, which usually hides the post.</p>
          </div>
          <div>
            <label className="label">Where you can work from</label>
            <ChipInput value={form.preferences.preferredLocations} onChange={(v) => pref('preferredLocations', v)} placeholder="e.g. India, APAC" suggestions={['India', 'Asia', 'APAC', 'Europe', 'USA']} />
            <p className="mt-1 text-xs text-slate-500">Posts limited to other regions (e.g. &quot;US only&quot;) are pushed down. Worldwide posts always count.</p>
          </div>
          <div>
            <label className="label">Job types</label>
            <div className="flex flex-wrap gap-2">
              {JOB_TYPES.map(([v, l]) => (
                <label key={v} className={`chip cursor-pointer px-3 py-1 text-sm ${form.preferences.jobTypes.includes(v) ? 'bg-brand-600 text-white' : ''}`}>
                  <input type="checkbox" className="sr-only" checked={form.preferences.jobTypes.includes(v)} onChange={() => pref('jobTypes', toggle(form.preferences.jobTypes, v))} />
                  {l}
                </label>
              ))}
            </div>
            <p className="mt-1 text-xs text-slate-500">None selected = any. Posts that don&apos;t state a type are kept.</p>
            <label className="mt-4 flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" className="accent-brand-600" checked={form.preferences.remoteOnly} onChange={(e) => pref('remoteOnly', e.target.checked)} />
              Remote only (hide posts marked on-site or hybrid)
            </label>
          </div>
          <div>
            <label className="label" htmlFor="minScore">Minimum score: {form.preferences.minScore}</label>
            <input id="minScore" type="range" min="0" max="50" value={form.preferences.minScore} onChange={(e) => pref('minScore', Number(e.target.value))} className="w-full accent-brand-600" />
            <p className="mt-1 text-xs text-slate-500">30+ strong fit · 20–29 worth a look · 15–19 borderline.</p>
          </div>
          <div>
            <label className="label" htmlFor="maxAge">Ignore posts older than: {form.preferences.maxAgeDays} days</label>
            <input id="maxAge" type="range" min="1" max="60" value={form.preferences.maxAgeDays} onChange={(e) => pref('maxAgeDays', Number(e.target.value))} className="w-full accent-brand-600" />
          </div>
        </div>
      </Section>

      <Section title="Sources" hint="Pick the boards to include. None selected = all of them.">
        <div className="flex flex-wrap gap-2">
          {data.sources.map((s) => (
            <label key={s.name} className={`chip cursor-pointer px-3 py-1 text-sm ${form.sources.includes(s.name) ? 'bg-brand-600 text-white' : ''}`}>
              <input type="checkbox" className="sr-only" checked={form.sources.includes(s.name)} onChange={() => setForm({ ...form, sources: toggle(form.sources, s.name) })} />
              {s.label}
            </label>
          ))}
        </div>
      </Section>

      <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center gap-3 border-t border-slate-200 bg-slate-50/95 px-4 py-3 backdrop-blur md:-mx-8 md:px-8">
        <button className="btn-primary" disabled={busy || form.skills.length === 0}>
          {busy ? 'Saving and scoring…' : 'Save profile'}
        </button>
        {msg.ok && <span className="text-sm text-emerald-700">{msg.ok}</span>}
        {msg.error && <span className="text-sm text-red-600">{msg.error}</span>}
      </div>
    </form>
  );
}

export default function ProfilePage() {
  return (
    <Suspense>
      <ProfileInner />
    </Suspense>
  );
}
