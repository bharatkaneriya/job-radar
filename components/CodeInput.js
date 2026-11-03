'use client';

import { useRef, useState } from 'react';

const LENGTH = 6;

// One box per digit: typing moves forward, backspace moves back, and pasting fills the row.
// Remount with a new key to clear it.
export default function CodeInput({ onChange, onComplete, disabled, invalid }) {
  const [digits, setDigits] = useState(() => Array(LENGTH).fill(''));
  const boxes = useRef([]);

  const focus = (i) => {
    const box = boxes.current[Math.max(0, Math.min(LENGTH - 1, i))];
    box?.focus();
    box?.select();
  };

  const update = (next) => {
    setDigits(next);
    const code = next.join('');
    onChange?.(code);
    if (code.length === LENGTH) onComplete?.(code);
  };

  // Several digits arrive at once from a paste or autofill.
  const fill = (text, from) => {
    const typed = text.slice(0, LENGTH - from).split('');
    const next = digits.map((d, i) => typed[i - from] ?? d);
    update(next);
    focus(from + typed.length);
  };

  const handleChange = (i, value) => {
    const text = value.replace(/\D/g, '');
    if (!text) return update(digits.map((d, j) => (j === i ? '' : d)));
    if (text.length > 2) return fill(text, 0);
    // Two characters means a digit was typed next to the one already in the box.
    const digit = text.length === 2 ? text.replace(digits[i], '').slice(-1) || digits[i] : text;
    update(digits.map((d, j) => (j === i ? digit : d)));
    focus(i + 1);
  };

  const handleKeyDown = (i, e) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) {
      e.preventDefault();
      update(digits.map((d, j) => (j === i - 1 ? '' : d)));
      focus(i - 1);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      focus(i - 1);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      focus(i + 1);
    }
  };

  const handlePaste = (i, e) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text').replace(/\D/g, '');
    if (text) fill(text, text.length >= LENGTH ? 0 : i);
  };

  const tone = invalid ? 'border-red-400 bg-red-50 text-red-700 focus:border-red-500 focus:ring-red-100' : 'border-slate-300 bg-white text-slate-900 focus:border-brand-500 focus:ring-brand-100';

  return (
    <div className="grid grid-cols-6 gap-2 sm:gap-3" role="group" aria-label="6-digit code">
      {digits.map((digit, i) => (
        <input
          key={i}
          ref={(el) => (boxes.current[i] = el)}
          value={digit}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={(e) => handlePaste(i, e)}
          onFocus={(e) => e.target.select()}
          disabled={disabled}
          autoFocus={i === 0}
          inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          aria-label={`Digit ${i + 1} of ${LENGTH}`}
          className={`aspect-square w-full min-w-0 rounded-xl border-2 p-0 text-center text-xl font-semibold shadow-sm transition outline-none focus:ring-4 disabled:opacity-60 sm:text-2xl ${tone}`}
        />
      ))}
    </div>
  );
}
