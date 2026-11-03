'use client';

import { useEffect, useRef, useState } from 'react';
import Script from 'next/script';

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

// Google Identity Services button. Calls onCredential(idToken); the API verifies it.
export default function GoogleButton({ onCredential, text = 'continue_with' }) {
  const ref = useRef(null);
  const cb = useRef(onCredential);
  cb.current = onCredential;
  const [loaded, setLoaded] = useState(typeof window !== 'undefined' && !!window.google?.accounts?.id);

  useEffect(() => {
    if (!CLIENT_ID || !loaded || !ref.current) return;
    window.google.accounts.id.initialize({ client_id: CLIENT_ID, callback: (r) => cb.current(r.credential) });
    window.google.accounts.id.renderButton(ref.current, { theme: 'outline', size: 'large', text, width: ref.current.offsetWidth || 320 });
  }, [loaded, text]);

  if (!CLIENT_ID) return null;
  return (
    <>
      <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" onReady={() => setLoaded(true)} />
      <div className="flex w-full justify-center">
        <div ref={ref} className="w-full max-w-[400px]" />
      </div>
    </>
  );
}
