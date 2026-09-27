"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "Georgia, ui-serif, serif",
          background: "#f3efe6",
          color: "#1f1a14",
          padding: "2rem",
        }}
      >
        <div style={{ maxWidth: "28rem" }}>
          <h1 style={{ fontSize: "1.75rem", margin: 0 }}>Family Circles</h1>
          <p style={{ color: "#5a5147", lineHeight: 1.5 }}>
            The app failed to load. Check that Postgres is up and{" "}
            <code>DATA_DIR</code> is writable, then try again.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: "1rem",
              background: "#1f4d3a",
              color: "#f4f8f5",
              border: "none",
              borderRadius: "0.4rem",
              padding: "0.55rem 1rem",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
