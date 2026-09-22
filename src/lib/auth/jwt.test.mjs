// P0.2: FE JWT HMAC verify. Run: `npm run test:unit`
import test from "node:test";
import assert from "node:assert/strict";
import { SignJWT } from "jose";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = join(__dirname, "../.."); // .../src
const SECRET = "unit-test-secret-0123456789-abcdefghijklmnopqrstuvwxyz";
const WRONG = "wrong-secret-0123456789-abcdefghijklmnopqrstuvwxyzxxxx";
const key = new TextEncoder().encode(SECRET);
const wrongKey = new TextEncoder().encode(WRONG);

process.env.JWT_SECRET = SECRET;
process.env.JWT_ISSUER = "ClinicApp";
process.env.JWT_AUDIENCE = "ClinicApp";

const { verifyJwt, decodeJwt, isExpired } = await import(pathToFileURL(join(__dirname, "jwt.ts")).href);

async function mint({ role = "Admin", sub = "11111111-1111-1111-1111-111111111111", secret = key, expSecs = 3600 } = {}) {
  return new SignJWT({
    role,
    "http://schemas.microsoft.com/ws/2008/06/identity/claims/role": role,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(sub)
    .setIssuer("ClinicApp")
    .setAudience("ClinicApp")
    .setExpirationTime(`${expSecs}s`)
    .sign(secret);
}

test("verifyJwt accepts a properly signed token", async () => {
  const token = await mint({ role: "Doctor" });
  const claims = await verifyJwt(token);
  assert.ok(claims);
  assert.equal(claims.role, "Doctor");
  assert.equal(claims.sub, "11111111-1111-1111-1111-111111111111");
});

test("verifyJwt rejects wrong secret (forged Admin role)", async () => {
  const token = await mint({ role: "Admin", secret: wrongKey });
  assert.equal(decodeJwt(token)?.role, "Admin");
  assert.equal(await verifyJwt(token), null);
});

test("verifyJwt rejects tampered payload", async () => {
  const token = await mint({ role: "Patient" });
  const [h, p, s] = token.split(".");
  const raw = JSON.parse(Buffer.from(p, "base64url").toString());
  raw.role = "Admin";
  raw["http://schemas.microsoft.com/ws/2008/06/identity/claims/role"] = "Admin";
  const forged = `${h}.${Buffer.from(JSON.stringify(raw)).toString("base64url").replace(/=+$/, "")}.${s}`;
  assert.equal(decodeJwt(forged)?.role, "Admin");
  assert.equal(await verifyJwt(forged), null);
});

test("verifyJwt rejects expired token", async () => {
  const token = await new SignJWT({ role: "Staff" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject("11111111-1111-1111-1111-111111111111")
    .setIssuer("ClinicApp")
    .setAudience("ClinicApp")
    .setExpirationTime(Math.floor(Date.now() / 1000) - 120)
    .sign(key);
  assert.equal(await verifyJwt(token), null);
});

test("verifyJwt rejects alg none / unsigned", async () => {
  const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({
      sub: "11111111-1111-1111-1111-111111111111",
      role: "Admin",
      iss: "ClinicApp",
      aud: "ClinicApp",
      exp: Math.floor(Date.now() / 1000) + 3600,
    }),
  ).toString("base64url");
  assert.equal(await verifyJwt(`${header}.${payload}.`), null);
});

test("verifyJwt fails closed when JWT_SECRET is missing", async () => {
  const token = await mint();
  const prev = process.env.JWT_SECRET;
  delete process.env.JWT_SECRET;
  delete process.env.DOTNET_JWT_SECRET;
  try {
    assert.equal(await verifyJwt(token), null);
  } finally {
    process.env.JWT_SECRET = prev;
  }
});

test("isExpired respects skew", () => {
  const now = Math.floor(Date.now() / 1000);
  assert.equal(isExpired({ sub: "x", exp: now + 100 }), false);
  assert.equal(isExpired({ sub: "x", exp: now - 1 }), true);
});

test("source: jwt.ts must use jose jwtVerify", () => {
  const src = readFileSync(join(__dirname, "jwt.ts"), "utf8");
  assert.match(src, /from ["']jose["']/);
  assert.match(src, /jwtVerify/);
  assert.match(src, /export async function verifyJwt/);
});

test("source: proxy + session + token route call verifyJwt for gating", () => {
  const proxy = readFileSync(join(SRC, "proxy.ts"), "utf8");
  const session = readFileSync(join(__dirname, "session.ts"), "utf8");
  const tokenRoute = readFileSync(join(SRC, "app/api/session/token/route.ts"), "utf8");
  for (const [name, src] of [
    ["proxy", proxy],
    ["session", session],
    ["token", tokenRoute],
  ]) {
    assert.match(src, /verifyJwt/, `${name} must call verifyJwt`);
  }
  // proxy must not gate role from decodeJwt
  assert.doesNotMatch(proxy, /decodeJwt/);
  assert.doesNotMatch(session, /decodeJwt/);
  assert.doesNotMatch(tokenRoute, /decodeJwt/);
});
