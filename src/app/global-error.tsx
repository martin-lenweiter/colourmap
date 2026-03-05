'use client';

export default function GlobalError({
  error: _error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          padding: '2rem',
          textAlign: 'center',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <h2>Something went wrong</h2>
        <p style={{ color: '#666', marginTop: '0.5rem' }}>
          A critical error occurred. Please refresh the page.
        </p>
        <button
          type="button"
          onClick={reset}
          style={{
            marginTop: '1rem',
            padding: '0.5rem 1rem',
            cursor: 'pointer',
            borderRadius: '0.375rem',
            border: '1px solid #ccc',
            background: '#fff',
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
