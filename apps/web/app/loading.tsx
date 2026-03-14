'use client';

import { useEffect, useState } from 'react';

export default function Loading() {
  const [showFallback, setShowFallback] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setShowFallback(true), 5000);
    return () => clearTimeout(t);
  }, []);

  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center gap-4"
      style={{ backgroundColor: '#0a0a0f', color: '#a1a1aa' }}
    >
      <div className="flex items-center gap-3">
        <div
          className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent"
          style={{ borderColor: '#635BFF', borderTopColor: 'transparent' }}
        />
        <span>Loading...</span>
      </div>
      {showFallback && (
        <p className="text-sm">
          Taking a while? <a href="/" className="underline">Refresh the page</a>
        </p>
      )}
    </div>
  );
}
