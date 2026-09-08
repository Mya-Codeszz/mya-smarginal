import express from "express";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const { Pool } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = Number(process.env.PORT || 8787);
const IS_PROD = process.env.NODE_ENV === "production";
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "marginal.json");
const SESSION_DAYS = 30;

app.use(express.json({ limit: "1mb" }));

const DEFAULT_TRAITS = {
  formality: 50,
  sentenceVariety: 50,
  vocabularyComplexity: 50,
  warmth: 50,
  directness: 50,
};

function makeDefaultProfile() {
  return {
    styleProfile: null,
    weights: { ...DEFAULT_TRAITS },
    samples: [],
    extraVoices: [],
    drafts: [],
    accepted: [],
    rejected: [],
    settings: {
      accentColor: "#7567F8",
      autocomplete: true,
      explainSuggestions: true,
      autoSave: true,
      suggestionLength: "medium",
    },
  };
}

function normalizeProfile(profile) {
  const base = makeDefaultProfile();
  const p = profile && typeof profile === "object" ? profile : {};
  return {
    ...base,
    ...p,
    weights: { ...base.weights, ...(p.weights || {}) },
    samples: Array.isArray(p.samples) ? p.samples : [],
    extraVoices: Array.isArray(p.extraVoices) ? p.extraVoices : [],
    drafts: Array.isArray(p.drafts) ? p.drafts : [],
    accepted: Array.isArray(p.accepted) ? p.accepted : [],
    rejected: Array.isArray(p.rejected) ? p.rejected : [],
    settings: { ...base.settings, ...(p.settings || {}) },
  };
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const derived = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derived}`;
}

function verifyPassword(password, stored) {
  try {
    const [salt, expected] = String(stored).split(":");
    if (!salt || !expected) return false;
    const actual = crypto.scryptSync(password, salt, 64).toString("hex");
    return crypto.timingSafeEqual(Buffer.from(actual, "hex"), Buffer.from(expected, "hex"));
  } catch {
    return false;
  }
}

function makeToken() {
  return crypto.randomBytes(32).toString("base64url");
}

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function cleanUsername(value) {
  return String(value || "").trim().toLowerCase();
}

function validUsername(username) {
  return /^[a-z0-9_]{3,30}$/.test(username);
}

function validPassword(password) {
  return typeof password === "string" && password.length >= 6 && password.length <= 200;
}

let pool = null;
let localStore = { users: [], sessions: [] };

async function initStore() {
  if (process.env.DATABASE_URL) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_SSL === "false" ? false : { rejectUnauthorized: false },
      max: 5,
    });
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id BIGSERIAL PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        profile JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS sessions (
        token_hash TEXT PRIMARY KEY,
        user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        expires_at TIMESTAMPTZ NOT NULL
      );
      CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id);
    `);
    console.log("Marginal storage: PostgreSQL");
    return;
  }

  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    localStore = JSON.parse(await fs.readFile(DATA_FILE, "utf8"));
  } catch {
    localStore = { users: [], sessions: [] };
    await saveLocal();
  }
  console.warn("Marginal storage: local JSON fallback. Set DATABASE_URL for persistent production storage.");
}

async function saveLocal() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const tmp = `${DATA_FILE}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(localStore, null, 2), "utf8");
  await fs.rename(tmp, DATA_FILE);
}

async function findUserByUsername(username) {
  if (pool) {
    const { rows } = await pool.query("SELECT * FROM users WHERE username = $1", [username]);
    return rows[0] || null;
  }
  return localStore.users.find((u) => u.username === username) || null;
}

async function findUserById(id) {
  if (pool) {
    const { rows } = await pool.query("SELECT * FROM users WHERE id = $1", [id]);
    return rows[0] || null;
  }
  return localStore.users.find((u) => String(u.id) === String(id)) || null;
}

async function createUser(username, password) {
  const profile = makeDefaultProfile();
  const passwordHash = hashPassword(password);
  if (pool) {
    const { rows } = await pool.query(
      "INSERT INTO users (username, password_hash, profile) VALUES ($1, $2, $3) RETURNING *",
      [username, passwordHash, JSON.stringify(profile)]
    );
    return rows[0];
  }
  const user = {
    id: crypto.randomUUID(),
    username,
    password_hash: passwordHash,
    profile,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  localStore.users.push(user);
  await saveLocal();
  return user;
}

async function saveProfile(userId, profile) {
  const normalized = normalizeProfile(profile);
  if (pool) {
    const { rows } = await pool.query(
      "UPDATE users SET profile = $1, updated_at = NOW() WHERE id = $2 RETURNING profile",
      [JSON.stringify(normalized), userId]
    );
    return rows[0]?.profile || normalized;
  }
  const user = localStore.users.find((u) => String(u.id) === String(userId));
  if (!user) throw new Error("User not found");
  user.profile = normalized;
  user.updated_at = new Date().toISOString();
  await saveLocal();
  return normalized;
}

async function createSession(userId) {
  const token = makeToken();
  const tokenHash = hashToken(token);
  const expires = new Date(Date.now() + SESSION_DAYS * 86400000);
  if (pool) {
    await pool.query("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, $3)", [tokenHash, userId, expires]);
  } else {
    localStore.sessions = localStore.sessions.filter((s) => new Date(s.expires_at) > new Date());
    localStore.sessions.push({ token_hash: tokenHash, user_id: userId, expires_at: expires.toISOString() });
    await saveLocal();
  }
  return token;
}

async function userFromToken(token) {
  if (!token) return null;
  const tokenHash = hashToken(token);
  if (pool) {
    const { rows } = await pool.query(
      `SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = $1 AND s.expires_at > NOW()`,
      [tokenHash]
    );
    return rows[0] || null;
  }
  const session = localStore.sessions.find((s) => s.token_hash === tokenHash && new Date(s.expires_at) > new Date());
  return session ? findUserById(session.user_id) : null;
}

async function auth(req, res, next) {
  try {
    const header = req.get("authorization") || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    const user = await userFromToken(token);
    if (!user) return res.status(401).json({ error: "Your session has expired. Please log in again." });
    req.user = user;
    req.token = token;
    next();
  } catch (err) {
    next(err);
  }
}

function publicAuth(user, token) {
  return {
    token,
    username: user.username,
    profile: normalizeProfile(user.profile),
  };
}

app.get("/api/health", (req, res) => {
  res.json({ ok: true, storage: pool ? "postgres" : "local" });
});

app.post("/api/signup", async (req, res, next) => {
  try {
    const username = cleanUsername(req.body?.username);
    const password = req.body?.password;
    if (!validUsername(username)) return res.status(400).json({ error: "Username must be 3–30 characters using letters, numbers, or underscores." });
    if (!validPassword(password)) return res.status(400).json({ error: "Password must be at least 6 characters." });
    if (await findUserByUsername(username)) return res.status(409).json({ error: "That username is already taken." });
    const user = await createUser(username, password);
    const token = await createSession(user.id);
    res.status(201).json(publicAuth(user, token));
  } catch (err) {
    if (err?.code === "23505") return res.status(409).json({ error: "That username is already taken." });
    next(err);
  }
});

app.post("/api/login", async (req, res, next) => {
  try {
    const username = cleanUsername(req.body?.username);
    const password = req.body?.password;
    const user = await findUserByUsername(username);
    if (!user || !verifyPassword(password, user.password_hash)) {
      return res.status(401).json({ error: "Incorrect username or password." });
    }
    const token = await createSession(user.id);
    res.json(publicAuth(user, token));
  } catch (err) {
    next(err);
  }
});

app.get("/api/profile", auth, async (req, res) => {
  res.json({ profile: normalizeProfile(req.user.profile), username: req.user.username });
});

app.put("/api/profile", auth, async (req, res, next) => {
  try {
    const profile = await saveProfile(req.user.id, req.body?.profile);
    res.json({ profile });
  } catch (err) {
    next(err);
  }
});

app.post("/api/logout", auth, async (req, res, next) => {
  try {
    const tokenHash = hashToken(req.token);
    if (pool) await pool.query("DELETE FROM sessions WHERE token_hash = $1", [tokenHash]);
    else {
      localStore.sessions = localStore.sessions.filter((s) => s.token_hash !== tokenHash);
      await saveLocal();
    }
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

app.post("/api/gemini", auth, async (req, res, next) => {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(503).json({ error: "Gemini is not configured on the server yet. Add GEMINI_API_KEY in Render." });

    const system = String(req.body?.system || "");
    const jsonMode = req.body?.json === true;
    const messages = Array.isArray(req.body?.messages) ? req.body.messages : [];
    const contents = messages
      .filter((m) => m && typeof m.content === "string" && m.content.trim())
      .map((m) => ({
        role: m.role === "assistant" || m.role === "model" ? "model" : "user",
        parts: [{ text: m.content }],
      }));
    if (!contents.length) return res.status(400).json({ error: "No message supplied." });

    const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        systemInstruction: system ? { parts: [{ text: system }] } : undefined,
        contents,
        generationConfig: { temperature: jsonMode ? 0.2 : 0.7, ...(jsonMode ? { responseMimeType: "application/json" } : {}) },
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      console.error("Gemini error:", JSON.stringify(data));
      return res.status(response.status).json({ error: data?.error?.message || "Gemini request failed." });
    }

    const text = (data.candidates || [])
      .flatMap((c) => c?.content?.parts || [])
      .map((p) => p?.text || "")
      .join("");
    res.json({ content: text ? [{ type: "text", text }] : [] });
  } catch (err) {
    next(err);
  }
});

// Serve the built React application from the same Render web service.
const distDir = path.join(__dirname, "dist");
app.use(express.static(distDir));
app.use((req, res, next) => {
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({ error: "API route not found." });
  }
  res.sendFile(path.join(distDir, "index.html"), (err) => {
    if (err) next(err);
  });
});

app.use((err, req, res, next) => {
  console.error(err);
  if (res.headersSent) return next(err);
  res.status(500).json({ error: IS_PROD ? "Server error." : String(err?.message || err) });
});

await initStore();
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Marginal server listening on 0.0.0.0:${PORT}`);
});
