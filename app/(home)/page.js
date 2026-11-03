import Link from 'next/link';
import PublicHeader from '@/components/PublicHeader';

const SOURCES = [
  ['Remotive', 'https://remotive.com'],
  ['Jobicy', 'https://jobicy.com'],
  ['Himalayas', 'https://himalayas.app'],
  ['Arbeitnow', 'https://www.arbeitnow.com'],
  ['We Work Remotely', 'https://weworkremotely.com'],
  ['HN Who is hiring', 'https://news.ycombinator.com'],
];

const STEPS = [
  ['Build your profile', 'Add your skills with a weight for each, plus where and how you want to work.'],
  ['Get scored matches', 'Every post from six public remote boards is scored against your profile. Location-locked and off-stack posts drop down.'],
  ['Track applications', 'Mark jobs saved, applied, interview, offer or rejected, and keep notes on each one.'],
];

export default function Home() {
  return (
    <>
      <PublicHeader />
      <main>
        <section className="mx-auto max-w-6xl px-4 pt-16 pb-12 md:pt-24">
          <div className="max-w-3xl">
            <p className="mb-3 text-sm font-medium text-brand-600">Remote developer jobs, ranked for you</p>
            <h1 className="text-4xl font-bold tracking-tight text-slate-900 md:text-5xl">Stop scrolling job boards. Get the posts that fit your stack.</h1>
            <p className="mt-5 text-lg text-slate-600">
              Job Radar pulls fresh posts from public remote job boards, scores each one against your skills and location, and gives you one list to work through and track.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/signup" className="btn-primary px-6 py-3 text-base">
                Create free account
              </Link>
              <Link href="/login" className="btn-secondary px-6 py-3 text-base">
                Log in
              </Link>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-12">
          <div className="grid gap-4 md:grid-cols-3">
            {STEPS.map(([title, text], i) => (
              <div key={title} className="card p-6">
                <div className="mb-3 grid h-8 w-8 place-items-center rounded-full bg-brand-50 text-sm font-semibold text-brand-700">{i + 1}</div>
                <h2 className="font-semibold text-slate-900">{title}</h2>
                <p className="mt-2 text-sm text-slate-600">{text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-12">
          <div className="card grid gap-8 p-8 md:grid-cols-2">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">Your list, or a live search</h2>
              <p className="mt-2 text-slate-600">
                Your matches are stored, so the list opens instantly. When you want the newest posts, run a live search: Job Radar checks the boards again and adds anything new.
              </p>
            </div>
            <div>
              <h2 className="text-xl font-semibold text-slate-900">Scoring you control</h2>
              <p className="mt-2 text-slate-600">
                Skill weights, keywords to boost or avoid, preferred locations, job types and a minimum score. Change them any time and your list re-scores.
              </p>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-12">
          <h2 className="text-sm font-medium tracking-wide text-slate-500 uppercase">Jobs sourced from</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {SOURCES.map(([name, url]) => (
              <a key={name} href={url} target="_blank" rel="noopener noreferrer" className="chip px-3 py-1 text-sm hover:bg-slate-200">
                {name}
              </a>
            ))}
          </div>
          <p className="mt-3 text-xs text-slate-500">Listings link back to the original post. Job Radar never applies or sends anything for you.</p>
        </section>
      </main>
      <footer className="border-t border-slate-200 py-8 text-center text-sm text-slate-500">© {new Date().getFullYear()} Job Radar</footer>
    </>
  );
}
