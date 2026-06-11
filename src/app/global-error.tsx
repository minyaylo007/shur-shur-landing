"use client";

/**
 * Last-resort error UI. It replaces the root layout when rendering crashes,
 * so it MUST render its own <html>/<body>, use inline styles only and touch
 * no dictionaries/imports (nothing here may fail). Copy is bilingual uk+en.
 */
export default function GlobalError({ reset }: { reset: () => void }) {
  return (
    <html lang="uk">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
          background: "#3f0a12",
          color: "#faf7f0",
          fontFamily: "system-ui, sans-serif",
          textAlign: "center",
        }}
      >
        <div style={{ maxWidth: "32rem" }}>
          <p
            style={{
              fontFamily: "'Courier New', Courier, monospace",
              fontSize: "1.5rem",
              fontWeight: 700,
              letterSpacing: "0.08em",
              margin: "0 0 20px",
            }}
          >
            shur-shur
          </p>
          <p style={{ fontSize: "1.05rem", lineHeight: 1.55, margin: "0 0 8px" }}>
            Щось пішло не так. Оновіть сторінку або напишіть нам в Instagram.
          </p>
          <p style={{ fontSize: "0.95rem", lineHeight: 1.55, opacity: 0.85, margin: "0 0 24px" }}>
            Something went wrong. Refresh the page or message us on Instagram.
          </p>
          <p style={{ margin: 0, display: "flex", gap: "20px", justifyContent: "center", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={reset}
              style={{
                cursor: "pointer",
                border: "2px solid #faf7f0",
                borderRadius: "999px",
                background: "transparent",
                color: "#faf7f0",
                font: "inherit",
                fontWeight: 700,
                padding: "10px 22px",
              }}
            >
              Спробувати ще раз / Try again
            </button>
            <a
              href="https://www.instagram.com/shur.shur.agency"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "inline-flex",
                alignItems: "center",
                color: "#faf7f0",
                fontWeight: 700,
                textDecoration: "underline",
                textUnderlineOffset: "4px",
              }}
            >
              @shur.shur.agency
            </a>
          </p>
        </div>
      </body>
    </html>
  );
}
