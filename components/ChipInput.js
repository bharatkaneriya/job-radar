'use client';

import { useState } from 'react';

// Type and press Enter or comma to add; click × to remove.
export default function ChipInput({ value = [], onChange, placeholder, suggestions = [] }) {
  const [text, setText] = useState('');
  const add = (raw) => {
    const items = raw.split(',').map((s) => s.trim()).filter(Boolean);
    const next = [...value];
    for (const it of items) if (!next.some((v) => v.toLowerCase() === it.toLowerCase())) next.push(it);
    onChange(next);
    setText('');
  };
  const unused = suggestions.filter((s) => !value.some((v) => v.toLowerCase() === s.toLowerCase()));

  return (
    <div>
      <div className="input flex min-h-10 flex-wrap items-center gap-1.5 py-1.5">
        {value.map((v) => (
          <span key={v} className="chip bg-brand-50 text-brand-700">
            {v}
            <button type="button" className="cursor-pointer text-brand-500 hover:text-brand-700" onClick={() => onChange(value.filter((x) => x !== v))} aria-label={`Remove ${v}`}>
              ×
            </button>
          </span>
        ))}
        <input
          className="min-w-24 flex-1 bg-transparent text-sm outline-none"
          value={text}
          placeholder={value.length ? '' : placeholder}
          onChange={(e) => (e.target.value.endsWith(',') ? add(e.target.value) : setText(e.target.value))}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              if (text.trim()) add(text);
            } else if (e.key === 'Backspace' && !text && value.length) {
              onChange(value.slice(0, -1));
            }
          }}
          onBlur={() => text.trim() && add(text)}
        />
      </div>
      {unused.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {unused.map((s) => (
            <button key={s} type="button" className="chip cursor-pointer hover:bg-slate-200" onClick={() => add(s)}>
              + {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
