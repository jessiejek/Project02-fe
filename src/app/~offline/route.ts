//JJQR - AI (Nov 14, 2026)
export const dynamic = "force-static";

const HTML = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Offline · Dr. Grace Gavino Medical Clinic</title>
    <style>
      html, body { margin: 0; min-height: 100%; }
      body {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 24px;
        background: #f8f9ff;
        color: #0b1c30;
        font-family: system-ui, -apple-system, sans-serif;
        line-height: 1.5;
      }
      main { max-width: 28rem; text-align: center; }
      h1 { margin: 0 0 12px; font-size: 1.5rem; }
      p { margin: 0 0 24px; }
      button {
        appearance: none;
        border: 0;
        border-radius: 999px;
        padding: 12px 24px;
        background: #00685f;
        color: #ffffff;
        font: inherit;
        font-weight: 600;
        cursor: pointer;
      }
    </style>
  </head>
  <body>
    <main>
      <h1>You're offline</h1>
      <p>Clinic data needs a connection. Nothing was saved on this device.</p>
      <button type="button" onclick="location.reload()">Try again</button>
    </main>
  </body>
</html>
`;

export function GET() {
  return new Response(HTML, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
    },
  });
}
//JJQR - END
