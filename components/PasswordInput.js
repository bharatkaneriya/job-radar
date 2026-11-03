'use client';

import { useState } from 'react';

const EYE = 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7zM12 15a3 3 0 100-6 3 3 0 000 6z';
const EYE_OFF = 'M3 3l18 18M10.6 5.1A10 10 0 0112 5c6 0 10 7 10 7a17 17 0 01-3.2 3.9M6.5 6.6A17 17 0 002 12s4 7 10 7a10 10 0 005.4-1.6M9.9 9.9a3 3 0 004.2 4.2';

export default function PasswordInput({ className = '', ...props }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      {/* Edge draws its own reveal button; hide it so there aren't two eyes. */}
      <input {...props} type={visible ? 'text' : 'password'} className={`input pr-10 [&::-ms-reveal]:hidden ${className}`} />
      <button
        type="button"
        className="absolute inset-y-0 right-0 grid w-10 place-items-center rounded-r-lg text-slate-400 hover:text-slate-600"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Hide password' : 'Show password'}
        aria-pressed={visible}
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d={visible ? EYE_OFF : EYE} />
        </svg>
      </button>
    </div>
  );
}
