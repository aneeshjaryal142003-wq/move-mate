const { promisify } = require("node:util");
const { createServer } = require("node:http");
const { randomBytes, createHash, scrypt, timingSafeEqual } = require("node:crypto");
const { DatabaseSync } = require("node:sqlite");
const fsSync = require("node:fs");
const fs = require("node:fs/promises");
const path = require("node:path");

const scryptAsync = promisify(scrypt);
const root = __dirname;
const dataDirectory = path.join(root, "data");
const databaseFile = process.env.DATABASE_PATH
  ? path.resolve(root, process.env.DATABASE_PATH)
  : path.join(dataDirectory, "movemate.sqlite");
const usersFile = path.join(dataDirectory, "users.json");
const shipmentsFile = path.join(dataDirectory, "shipments.json");
const port = Number(process.env.PORT) || 8000;
const host = process.env.HOST || "127.0.0.1";
const sessionLifetimeSeconds = 7 * 24 * 60 * 60;

fsSync.mkdirSync(path.dirname(databaseFile), { recursive: true });
const database = new DatabaseSync(databaseFile);
database.exec(`
  PRAGMA foreign_keys = ON;
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS shipments (
    id TEXT PRIMARY KEY,
    tracking_code TEXT NOT NULL UNIQUE,
    user_id TEXT NOT NULL REFERENCES users(id),
    data TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS shipments_user_created
    ON shipments(user_id, created_at DESC);
  CREATE TABLE IF NOT EXISTS quotes (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    data TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires_at);
`);

function importLegacyJson(file, insert) {
  if (!fsSync.existsSync(file)) return;
  const contents = JSON.parse(fsSync.readFileSync(file, "utf8"));
  if (!Array.isArray(contents)) {
    throw new Error(`${path.basename(file)} must contain a JSON array.`);
  }
  for (const entry of contents) insert(entry);
}

database.exec("BEGIN");
try {
  importLegacyJson(usersFile, (user) => {
    database.prepare(`
      INSERT OR IGNORE INTO users (id, name, email, password_hash, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(user.id, user.name, user.email, user.passwordHash, user.createdAt);
  });
  importLegacyJson(shipmentsFile, (shipment) => {
    database.prepare(`
      INSERT OR IGNORE INTO shipments (id, tracking_code, user_id, data, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      shipment.id,
      shipment.trackingCode,
      shipment.userId,
      JSON.stringify(shipment),
      shipment.createdAt,
    );
  });
  database.exec("COMMIT");
} catch (error) {
  database.exec("ROLLBACK");
  throw error;
}
database.prepare("DELETE FROM sessions WHERE expires_at <= ?").run(Date.now());

const modes = [
  { id: "road", name: "Road", icon: "▰", days: "2–6 days", base: 38, perPound: 0.72 },
  { id: "rail", name: "Rail", icon: "⌁", days: "3–8 days", base: 62, perPound: 0.48 },
  { id: "air", name: "Air", icon: "✈", days: "1–3 days", base: 85, perPound: 2.4 },
  { id: "sea", name: "Sea", icon: "◒", days: "10–24 days", base: 145, perPound: 0.38 },
];

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
};

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function sendJson(response, status, payload, headers = {}) {
  response.writeHead(status, {
    ...response.getHeaders(),
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
    ...headers,
  });
  response.end(JSON.stringify(payload));
}

async function readJson(request) {
  const chunks = [];
  let size = 0;

  for await (const chunk of request) {
    size += chunk.length;
    if (size > 16 * 1024) {
      throw new HttpError(413, "Request body is too large.");
    }
    chunks.push(chunk);
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new HttpError(400, "Request body must be valid JSON.");
  }
}

function normalizeLocation(value, field) {
  if (typeof value !== "string") {
    throw new HttpError(400, `${field} is required.`);
  }

  const location = value.trim();
  if (!location || location.length > 120 || /[\u0000-\u001f\u007f]/.test(location)) {
    throw new HttpError(400, `${field} must be between 1 and 120 characters.`);
  }

  return location;
}

function buildQuote(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new HttpError(400, "A JSON quote request is required.");
  }

  const origin = normalizeLocation(payload.origin, "Pickup location");
  const destination = normalizeLocation(payload.destination, "Destination");
  if (origin.toLocaleLowerCase() === destination.toLocaleLowerCase()) {
    throw new HttpError(400, "Pickup and destination must be different.");
  }

  const weight = payload.weight;
  if (!Number.isInteger(weight) || weight < 1 || weight > 5000) {
    throw new HttpError(400, "Weight must be a whole number from 1 to 5,000 lb.");
  }

  if (!modes.some((mode) => mode.id === payload.mode)) {
    throw new HttpError(400, "Choose a valid transport mode.");
  }

  return {
    id: randomBytes(12).toString("hex"),
    createdAt: new Date().toISOString(),
    currency: "USD",
    estimateOnly: true,
    shipment: { origin, destination, weight, weightUnit: "lb" },
    selectedMode: payload.mode,
    estimates: modes.map((mode) => ({
      id: mode.id,
      name: mode.name,
      icon: mode.icon,
      transitTime: mode.days,
      price: Math.round((mode.base + weight * mode.perPound) * 100) / 100,
    })),
  };
}

function normalizeEmail(value) {
  if (typeof value !== "string") {
    throw new HttpError(400, "Enter a valid email address.");
  }
  const email = value.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new HttpError(400, "Enter a valid email address.");
  }
  return email;
}

function validatePassword(value) {
  if (typeof value !== "string" || Array.from(value).length < 10 || value.length > 128) {
    throw new HttpError(400, "Password must be between 10 and 128 characters.");
  }
  return value;
}

function normalizeName(value) {
  if (typeof value !== "string") {
    throw new HttpError(400, "Enter your name.");
  }
  const name = value.trim();
  if (!name || name.length > 60 || /[\u0000-\u001f\u007f]/.test(name)) {
    throw new HttpError(400, "Name must be between 1 and 60 characters.");
  }
  return name;
}

async function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = await scryptAsync(password, salt, 64, { N: 16384, r: 8, p: 1 });
  return `${salt.toString("base64url")}:${hash.toString("base64url")}`;
}

async function verifyPassword(password, savedHash) {
  const [saltValue, hashValue] = savedHash.split(":");
  if (!saltValue || !hashValue) return false;
  const salt = Buffer.from(saltValue, "base64url");
  const expectedHash = Buffer.from(hashValue, "base64url");
  if (salt.length !== 16 || expectedHash.length !== 64) return false;
  const actualHash = await scryptAsync(password, salt, expectedHash.length, { N: 16384, r: 8, p: 1 });
  return timingSafeEqual(expectedHash, actualHash);
}

function sessionCookie(token, request) {
  const secure = request.socket.encrypted ? "; Secure" : "";
  return `movemate_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${sessionLifetimeSeconds}${secure}`;
}

function clearSessionCookie(request) {
  const secure = request.socket.encrypted ? "; Secure" : "";
  return `movemate_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secure}`;
}

function getSession(request) {
  const cookie = request.headers.cookie || "";
  const token = cookie.match(/(?:^|;\s*)movemate_session=([a-f0-9]{64})(?:;|$)/)?.[1];
  if (!token) return null;

  const tokenHash = createHash("sha256").update(token).digest("hex");
  const session = database.prepare(`
    SELECT sessions.expires_at AS expiresAt, users.id, users.name, users.email
    FROM sessions
    JOIN users ON users.id = sessions.user_id
    WHERE sessions.token_hash = ?
  `).get(tokenHash);
  if (!session) return null;
  if (session.expiresAt <= Date.now()) {
    database.prepare("DELETE FROM sessions WHERE token_hash = ?").run(tokenHash);
    return null;
  }
  return {
    tokenHash,
    user: { id: session.id, name: session.name, email: session.email },
    expiresAt: session.expiresAt,
  };
}

function createSession(user) {
  const token = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const expiresAt = Date.now() + sessionLifetimeSeconds * 1000;
  database.prepare(`
    INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)
  `).run(tokenHash, user.id, expiresAt);
  return token;
}

function requireSession(request) {
  const session = getSession(request);
  if (!session) throw new HttpError(401, "Please sign in to manage your shipments.");
  return session;
}

function createShipment(payload, user) {
  const quote = buildQuote(payload);
  const estimate = quote.estimates.find((option) => option.id === quote.selectedMode);
  const transitDays = estimate.transitTime.match(/\d+/g).map(Number);
  const averageTransitDays = Math.round(transitDays.reduce((sum, days) => sum + days, 0) / transitDays.length);
  const now = new Date();
  const shipment = {
    id: randomBytes(12).toString("hex"),
    trackingCode: `MM-${randomBytes(4).toString("hex").toUpperCase()}`,
    userId: user.id,
    origin: quote.shipment.origin,
    destination: quote.shipment.destination,
    weight: quote.shipment.weight,
    mode: estimate.name,
    modeId: estimate.id,
    status: "Booked",
    price: estimate.price,
    currency: quote.currency,
    transitTime: estimate.transitTime,
    createdAt: now.toISOString(),
    eta: new Date(now.getTime() + averageTransitDays * 86400000).toISOString(),
    events: [{
      status: "Booked",
      description: "Shipment booked and confirmed.",
      at: now.toISOString(),
    }],
  };
  return shipment;
}

function allowApiOrigin(request, response) {
  const originHeader = request.headers.origin;
  if (!originHeader) return;

  let origin;
  let backendOrigin;
  try {
    origin = new URL(originHeader);
    backendOrigin = new URL(
      `${request.socket.encrypted ? "https" : "http"}://${request.headers.host}`,
    );
  } catch {
    throw new HttpError(403, "Request origin is not allowed.");
  }

  const isSameOrigin = origin.origin === backendOrigin.origin;
  const isLocalLiveServerOrigin =
    origin.protocol === "http:" &&
    ["5173", "5500"].includes(origin.port) &&
    ["127.0.0.1", "localhost"].includes(origin.hostname) &&
    origin.hostname === backendOrigin.hostname;

  if (!isSameOrigin && !isLocalLiveServerOrigin) {
    throw new HttpError(403, "Request origin is not allowed.");
  }

  response.setHeader("Access-Control-Allow-Origin", origin.origin);
  response.setHeader("Access-Control-Allow-Credentials", "true");
  response.setHeader("Vary", "Origin");
}

async function registerAccount(payload, request, response) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new HttpError(400, "A JSON account request is required.");
  }

  const name = normalizeName(payload.name);
  const email = normalizeEmail(payload.email);
  const password = validatePassword(payload.password);

  if (database.prepare("SELECT 1 FROM users WHERE email = ?").get(email)) {
    throw new HttpError(409, "An account with that email already exists.");
  }

  const user = {
    id: randomBytes(12).toString("hex"),
    name,
    email,
    passwordHash: await hashPassword(password),
    createdAt: new Date().toISOString(),
  };
  try {
    database.prepare(`
      INSERT INTO users (id, name, email, password_hash, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(user.id, user.name, user.email, user.passwordHash, user.createdAt);
  } catch (error) {
    if (error.message.includes("UNIQUE constraint failed: users.email")) {
      throw new HttpError(409, "An account with that email already exists.");
    }
    throw error;
  }
  const token = createSession(user);
  sendJson(response, 201, { user: { id: user.id, name: user.name, email: user.email } }, {
    "Set-Cookie": sessionCookie(token, request),
  });
}

async function loginAccount(payload, request, response) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new HttpError(400, "A JSON login request is required.");
  }

  const email = normalizeEmail(payload.email);
  const password = validatePassword(payload.password);
  const row = database.prepare(`
    SELECT id, name, email, password_hash AS passwordHash FROM users WHERE email = ?
  `).get(email);
  const user = row && {
    id: row.id,
    name: row.name,
    email: row.email,
    passwordHash: row.passwordHash,
  };
  const passwordMatches = user ? await verifyPassword(password, user.passwordHash) : false;
  if (!passwordMatches) {
    throw new HttpError(401, "Email or password is incorrect.");
  }

  const token = createSession(user);
  sendJson(response, 200, { user: { id: user.id, name: user.name, email: user.email } }, {
    "Set-Cookie": sessionCookie(token, request),
  });
}

async function handleApi(request, response, pathname) {
  allowApiOrigin(request, response);

  if (request.method === "OPTIONS") {
    response.writeHead(204, {
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Cache-Control": "no-store",
    });
    response.end();
    return;
  }

  if (pathname === "/api/health" && request.method === "GET") {
    sendJson(response, 200, { status: "ok" });
    return;
  }

  if (pathname === "/api/quotes" && request.method === "POST") {
    const payload = await readJson(request);
    const quote = buildQuote(payload);
    const session = getSession(request);
    database.prepare(`
      INSERT INTO quotes (id, user_id, data, created_at) VALUES (?, ?, ?, ?)
    `).run(
      quote.id,
      session?.user.id || null,
      JSON.stringify(quote),
      quote.createdAt,
    );
    sendJson(response, 201, { quote });
    return;
  }

  if (pathname === "/api/shipments" && request.method === "GET") {
    const session = requireSession(request);
    const shipments = database.prepare(`
      SELECT data FROM shipments WHERE user_id = ? ORDER BY created_at DESC
    `).all(session.user.id).map((row) => JSON.parse(row.data));
    sendJson(response, 200, { shipments });
    return;
  }

  if (pathname === "/api/shipments" && request.method === "POST") {
    const session = requireSession(request);
    const payload = await readJson(request);
    const shipment = createShipment(payload, session.user);
    database.prepare(`
      INSERT INTO shipments (id, tracking_code, user_id, data, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      shipment.id,
      shipment.trackingCode,
      shipment.userId,
      JSON.stringify(shipment),
      shipment.createdAt,
    );
    sendJson(response, 201, { shipment });
    return;
  }

  if (pathname.startsWith("/api/shipments/") && request.method === "GET") {
    const session = requireSession(request);
    const shipmentId = pathname.slice("/api/shipments/".length);
    const row = database.prepare(`
      SELECT data FROM shipments WHERE id = ? AND user_id = ?
    `).get(shipmentId, session.user.id);
    const shipment = row && JSON.parse(row.data);
    if (!shipment) throw new HttpError(404, "Shipment not found.");
    sendJson(response, 200, { shipment });
    return;
  }

  if (pathname.startsWith("/api/track/") && request.method === "GET") {
    let trackingCode;
    try {
      trackingCode = decodeURIComponent(pathname.slice("/api/track/".length)).trim().toUpperCase();
    } catch {
      throw new HttpError(400, "Invalid tracking code.");
    }
    if (!trackingCode || trackingCode.length > 40) {
      throw new HttpError(400, "Enter a valid tracking code.");
    }
    const row = database.prepare(`
      SELECT data FROM shipments WHERE tracking_code = ?
    `).get(trackingCode);
    const shipment = row && JSON.parse(row.data);
    if (!shipment) throw new HttpError(404, "No shipment was found with that tracking number.");
    const { userId, ...publicShipment } = shipment;
    sendJson(response, 200, { shipment: publicShipment });
    return;
  }

  if (pathname === "/api/register" && request.method === "POST") {
    const payload = await readJson(request);
    await registerAccount(payload, request, response);
    return;
  }

  if (pathname === "/api/login" && request.method === "POST") {
    const payload = await readJson(request);
    await loginAccount(payload, request, response);
    return;
  }

  if (pathname === "/api/logout" && request.method === "POST") {
    const session = getSession(request);
    if (session) {
      database.prepare("DELETE FROM sessions WHERE token_hash = ?").run(session.tokenHash);
    }
    sendJson(response, 200, { success: true }, { "Set-Cookie": clearSessionCookie(request) });
    return;
  }

  if (pathname === "/api/me" && request.method === "GET") {
    const session = getSession(request);
    sendJson(response, 200, { user: session?.user || null });
    return;
  }

  if (pathname.startsWith("/api/")) {
    sendJson(response, 404, { error: "API endpoint not found." });
    return;
  }

  throw new HttpError(405, "Method not allowed.");
}

async function serveStatic(request, response, pathname) {
  let decodedPath;
  try {
    decodedPath = decodeURIComponent(pathname);
  } catch {
    throw new HttpError(400, "Invalid URL path.");
  }

  const buildDirectory = path.join(root, "dist");
  let staticRoot = root;
  try {
    await fs.access(path.join(buildDirectory, "index.html"));
    staticRoot = buildDirectory;
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  const relativePath = decodedPath === "/" ? "index.html" : decodedPath.replace(/^\/+/, "");
  let filePath = path.resolve(staticRoot, relativePath);
  if (!filePath.startsWith(`${staticRoot}${path.sep}`)) {
    throw new HttpError(404, "Page not found.");
  }
  let contents;
  try {
    contents = await fs.readFile(filePath);
  } catch (error) {
    if (error.code === "ENOENT" || error.code === "EISDIR") {
      if (staticRoot === buildDirectory && !path.extname(relativePath)) {
        filePath = path.join(buildDirectory, "index.html");
        contents = await fs.readFile(filePath);
      } else {
        throw new HttpError(404, "Page not found.");
      }
    } else {
      throw error;
    }
  }

  const extension = path.extname(filePath).toLowerCase();
  response.writeHead(200, {
    "Cache-Control": "no-cache",
    "Content-Length": contents.length,
    "Content-Type": contentTypes[extension] || "application/octet-stream",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "X-Frame-Options": "DENY",
  });
  if (request.method === "HEAD") {
    response.end();
    return;
  }
  response.end(contents);
}

const server = createServer(async (request, response) => {
  try {
    const requestUrl = new URL(request.url, `http://${request.headers.host || "localhost"}`);
    if (requestUrl.pathname.startsWith("/api/")) {
      await handleApi(request, response, requestUrl.pathname);
    } else if (request.method === "GET" || request.method === "HEAD") {
      await serveStatic(request, response, requestUrl.pathname);
    } else {
      throw new HttpError(405, "Method not allowed.");
    }
  } catch (error) {
    if (response.headersSent) {
      response.destroy(error);
      return;
    }
    if (error instanceof HttpError) {
      sendJson(response, error.status, { error: error.message });
      return;
    }
    console.error("Request failed:", error);
    sendJson(response, 500, { error: "The server could not complete the request." });
  }
});

server.listen(port, host, () => {
  console.log(`MoveMate server listening on http://${host}:${port}`);
});
