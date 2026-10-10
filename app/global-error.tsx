'use client'

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8f9fb', padding: '24px' }}>
          <div style={{ maxWidth: 420, textAlign: 'center' }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: '#dc2626', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Critical error
            </p>
            <h1 style={{ fontSize: 22, fontWeight: 600, color: '#182350', margin: '8px 0' }}>
              Lantern hit a critical error
            </h1>
            <p style={{ fontSize: 14, color: '#6b7280', marginBottom: 16 }}>
              Something went wrong loading the application. Please try reloading the page.
            </p>
            {error.digest && (
              <p style={{ fontSize: 11, color: '#9ca3af', fontFamily: 'monospace', marginBottom: 16 }}>
                Reference: {error.digest}
              </p>
            )}
            <button
              onClick={() => reset()}
              style={{ background: '#182350', color: '#fff', fontSize: 14, fontWeight: 500, padding: '10px 20px', borderRadius: 8, border: 'none', cursor: 'pointer' }}
            >
              Reload
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}