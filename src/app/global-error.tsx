'use client'

/**
 * Last resort: the root layout itself failed, so there is no theme, no fonts
 * and no components to lean on. Everything here is inline on purpose.
 */
export default function GlobalError({ reset }: { reset: () => void }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100dvh',
          display: 'grid',
          placeItems: 'center',
          background: '#0F1216',
          color: '#EDF0F3',
          fontFamily: 'ui-sans-serif, system-ui, sans-serif',
          textAlign: 'center',
          padding: 24,
        }}
      >
        <div style={{ maxWidth: 380 }}>
          <h1 style={{ fontSize: 22, fontWeight: 600, margin: '0 0 12px' }}>
            Ajeg could not start
          </h1>
          <p style={{ color: '#98A2AE', lineHeight: 1.5, margin: '0 0 20px' }}>
            Your data is still stored on this device. Reloading usually fixes it.
          </p>
          <button
            onClick={reset}
            style={{
              height: 44,
              padding: '0 20px',
              borderRadius: 14,
              border: 0,
              background: '#63C9B6',
              color: '#0F1216',
              fontSize: 15,
              fontWeight: 500,
            }}
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  )
}
