'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { Alert, Spinner } from './ui';
import CodeInput from './CodeInput';
import PasswordInput from './PasswordInput';

const RESEND_SECONDS = 60;
const STEPS = ['email', 'code', 'password'];

function StepBar({ step }) {
  const current = STEPS.indexOf(step);
  return (
    <div className="mb-6" aria-label={`Step ${current + 1} of ${STEPS.length}`}>
      <div className="flex gap-1.5">
        {STEPS.map((s, i) => (
          <span key={s} className={`h-1 flex-1 rounded-full transition-colors ${i <= current ? 'bg-brand-600' : 'bg-slate-200'}`} />
        ))}
      </div>
    </div>
  );
}

export default function ForgotPasswordForm() {
  const router = useRouter();
  const [step, setStep] = useState('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [codeKey, setCodeKey] = useState(0);
  const [token, setToken] = useState('');
  const [passwords, setPasswords] = useState({ password: '', confirm: '' });
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [wait, setWait] = useState(0);

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait(wait - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  const clearCode = () => {
    setCode('');
    setCodeKey((k) => k + 1);
  };

  const startOver = () => {
    clearCode();
    setToken('');
    setPasswords({ password: '', confirm: '' });
    setError('');
    setNotice('');
    setStep('email');
  };

  const run = async (fn) => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await fn();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const sendCode = () => api('/auth/forgot-password', { method: 'POST', body: { email } });

  const requestCode = (e) => {
    e.preventDefault();
    run(async () => {
      await sendCode();
      clearCode();
      setWait(RESEND_SECONDS);
      setStep('code');
    });
  };

  const resend = () =>
    run(async () => {
      await sendCode();
      clearCode();
      setWait(RESEND_SECONDS);
      setNotice('A new code is on its way. Use the newest one.');
    });

  const verify = (value) =>
    run(async () => {
      try {
        const res = await api('/auth/verify-reset-code', { method: 'POST', body: { email, code: value } });
        setToken(res.token);
        setStep('password');
      } catch (err) {
        clearCode();
        throw err;
      }
    });

  const mismatch = passwords.confirm && passwords.password !== passwords.confirm;

  const reset = (e) => {
    e.preventDefault();
    if (passwords.password !== passwords.confirm) return setError('The passwords do not match');
    run(async () => {
      await api('/auth/reset-password', { method: 'POST', body: { email, token, password: passwords.password } });
      router.replace('/login?reset=1');
    });
  };

  const setPw = (k) => (e) => setPasswords({ ...passwords, [k]: e.target.value });

  return (
    <div className="card w-full max-w-md p-6 sm:p-8">
      <StepBar step={step} />

      {step === 'email' && (
        <>
          <h1 className="text-2xl font-semibold text-slate-900">Forgot your password?</h1>
          <p className="mt-1 text-sm text-slate-500">Enter your email and we&apos;ll send you a 6-digit code.</p>
          <form onSubmit={requestCode} className="mt-6 space-y-4">
            <div>
              <label className="label" htmlFor="email">
                Email
              </label>
              <input id="email" type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus autoComplete="email" />
            </div>
            <Alert>{error}</Alert>
            <button className="btn-primary w-full" disabled={busy}>
              {busy ? 'Please wait…' : 'Send code'}
            </button>
          </form>
        </>
      )}

      {step === 'code' && (
        <>
          <h1 className="text-2xl font-semibold text-slate-900">Check your email</h1>
          <p className="mt-1 text-sm text-slate-500">
            If <span className="font-medium break-all text-slate-700">{email}</span> has an account, we&apos;ve sent it a 6-digit code. It expires in 10 minutes.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (code.length === 6) verify(code);
            }}
            className="mt-6 space-y-4"
          >
            <CodeInput key={codeKey} onChange={setCode} onComplete={verify} disabled={busy} invalid={!!error && !code} />
            <Alert>{error}</Alert>
            <Alert kind="info">{notice}</Alert>
            <button className="btn-primary w-full" disabled={busy || code.length < 6}>
              {busy ? <Spinner className="h-4 w-4" /> : 'Verify code'}
            </button>
          </form>
          <p className="mt-4 text-center text-sm text-slate-500">
            Didn&apos;t get it?{' '}
            {wait > 0 ? (
              <span>Send a new code in {wait}s</span>
            ) : (
              <button type="button" className="font-medium text-brand-600 hover:underline disabled:opacity-60" onClick={resend} disabled={busy}>
                Send a new code
              </button>
            )}
          </p>
          <p className="mt-1 text-center text-sm">
            <button type="button" className="text-slate-500 hover:underline" onClick={startOver}>
              Use a different email
            </button>
          </p>
        </>
      )}

      {step === 'password' && (
        <>
          <h1 className="text-2xl font-semibold text-slate-900">Set a new password</h1>
          <p className="mt-1 text-sm text-slate-500">Code verified. Choose a new password for your account.</p>
          <form onSubmit={reset} className="mt-6 space-y-4">
            <div>
              <label className="label" htmlFor="password">
                New password
              </label>
              <PasswordInput id="password" value={passwords.password} onChange={setPw('password')} required minLength={8} autoFocus autoComplete="new-password" />
              <p className="mt-1 text-xs text-slate-500">At least 8 characters.</p>
            </div>
            <div>
              <label className="label" htmlFor="confirm">
                Confirm password
              </label>
              <PasswordInput id="confirm" value={passwords.confirm} onChange={setPw('confirm')} required minLength={8} autoComplete="new-password" aria-invalid={!!mismatch} />
              {mismatch && <p className="mt-1 text-xs text-red-600">The passwords do not match.</p>}
            </div>
            <Alert>{error}</Alert>
            <button className="btn-primary w-full" disabled={busy || mismatch}>
              {busy ? 'Please wait…' : 'Reset password'}
            </button>
          </form>
          <p className="mt-4 text-center text-sm">
            <button type="button" className="text-slate-500 hover:underline" onClick={startOver}>
              Start over
            </button>
          </p>
        </>
      )}

      <p className="mt-6 text-center text-sm text-slate-500">
        <Link href="/login" className="font-medium text-brand-600 hover:underline">
          Back to log in
        </Link>
      </p>
    </div>
  );
}
