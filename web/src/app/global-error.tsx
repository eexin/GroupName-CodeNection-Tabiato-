"use client";

/** Last line of defence: an error in the root layout itself. Must render its own <html>. */
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", background: "#eff6f5", color: "#12312f", display: "grid", placeItems: "center", minHeight: "100dvh", margin: 0 }}>
        <main style={{ textAlign: "center", padding: 32, maxWidth: 360 }}>
          <h1 style={{ fontSize: 20 }}>Tabiato couldn&apos;t start</h1>
          <p style={{ fontSize: 13, color: "#3d5c59" }}>Please try again in a moment.{error.digest ? ` Reference: ${error.digest}` : ""}</p>
          <button onClick={() => retry()} style={{ marginTop: 12, height: 48, padding: "0 28px", borderRadius: 15, border: 0, background: "#b8402a", color: "#fff", fontWeight: 700, fontSize: 14 }}>
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
