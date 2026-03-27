const express = require("express");
const crypto = require("crypto");

const {
  getNews, addPushToken, addNewsItem, findUserByEmail, findUserById, addUser, updateUser,
  getNewsById, updateNewsItem, deleteNewsItem,
  getUsers, deleteUser, touchUserSeen,
  getAppSetting, setAppSetting, getAllAppSettings,
  pingSession, getOnlineCount, getStats
} = require("../store");
const { getMarketOverview, getCoinDetail, searchMarketCoins } = require("../services/marketService");
const { enqueueBroadcast, getQueueStats } = require("../services/broadcastQueue");
const { isDuplicateNews } = require("../services/newsQuality");
const { createToken, hashPassword, sanitizeUser, verifyPassword, verifyToken } = require("../services/authService");

const router = express.Router();

function assertAdmin(req, res, next) {
  const adminKey = process.env.ADMIN_API_KEY;
  if (!adminKey) {
    return res.status(503).json({ error: "ADMIN_API_KEY is not configured" });
  }

  const provided = req.get("x-admin-key");
  if (provided !== adminKey) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  return next();
}

function requireAuth(req, res, next) {
  const header = req.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  const payload = verifyToken(token);

  if (!payload?.sub) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const user = findUserById(payload.sub);
  if (!user) {
    return res.status(401).json({ error: "User not found" });
  }

  req.user = user;
  return next();
}

function touchSeen(req, res, next) {
  if (req.user && req.user.id) touchUserSeen(req.user.id);
  return next();
}

router.post("/auth/register", (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  const password = String(req.body?.password || "");
  const name = String(req.body?.name || "").trim();

  if (!email || !password || password.length < 6) {
    return res.status(400).json({ error: "email and password (min 6) are required" });
  }

  if (findUserByEmail(email)) {
    return res.status(409).json({ error: "User already exists" });
  }

  const user = addUser({
    id: crypto.randomUUID(),
    email,
    name: name || email.split("@")[0],
    passwordHash: hashPassword(password),
    createdAt: new Date().toISOString(),
    preferences: {
      watchlist: [],
      alerts: [],
      settings: {
        disclaimerAccepted: false
      }
    }
  });

  const token = createToken({ sub: user.id, email: user.email });
  return res.json({ token, user: sanitizeUser(user) });
});

router.post("/auth/login", (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  const password = String(req.body?.password || "");
  const user = findUserByEmail(email);

  if (!user || !verifyPassword(password, user.passwordHash)) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const token = createToken({ sub: user.id, email: user.email });
  return res.json({ token, user: sanitizeUser(user) });
});

router.get("/auth/me", requireAuth, touchSeen, (req, res) => {
  return res.json({ user: sanitizeUser(req.user) });
});

router.put("/auth/preferences", requireAuth, touchSeen, (req, res) => {
  const preferences = req.body?.preferences;
  if (!preferences || typeof preferences !== "object") {
    return res.status(400).json({ error: "preferences object is required" });
  }

  const nextUser = updateUser(req.user.id, (current) => ({
    ...current,
    preferences: {
      ...(current.preferences || {}),
      ...preferences,
      settings: {
        ...(current.preferences?.settings || {}),
        ...(preferences.settings || {})
      }
    }
  }));

  return res.json({ user: sanitizeUser(nextUser) });
});

router.get("/news", (req, res) => {
  const limit = Number(req.query.limit || 50);
  res.json({ items: getNews(limit) });
});

router.get("/news/latest", (req, res) => {
  const latest = getNews(1)[0] || null;
  res.json({ item: latest });
});

router.get("/app/config", (req, res) => {
  res.json(getAllAppSettings());
});

router.post("/news/publish", assertAdmin, async (req, res) => {
  const title = String(req.body?.title || "").trim();
  const body = String(req.body?.body || "").trim() || title;
  const priority = String(req.body?.priority || "normal").toLowerCase();
  const tags = Array.isArray(req.body?.tags) ? req.body.tags.filter(Boolean) : [];
  const coins = Array.isArray(req.body?.coins)
    ? req.body.coins.map((coin) => String(coin).toUpperCase()).filter(Boolean)
    : [];

  if (!title) {
    return res.status(400).json({ error: "title is required" });
  }

  const newsItem = {
    id: crypto.randomUUID(),
    source: "admin",
    title,
    body,
    priority,
    tags,
    coins,
    createdAt: new Date().toISOString()
  };

  if (isDuplicateNews(getNews(120), newsItem)) {
    return res.status(409).json({ error: "Duplicate news detected in recent window" });
  }

  addNewsItem(newsItem);
  const broadcast = await enqueueBroadcast(newsItem);

  return res.json({ ok: true, newsItem, broadcast });
});

router.post("/push/register", (req, res) => {
  const token = req.body?.token;
  if (!token) {
    return res.status(400).json({ error: "token is required" });
  }

  addPushToken(token);
  return res.json({ ok: true });
});

router.get("/market/overview", async (req, res) => {
  try {
    const data = await getMarketOverview();
    return res.json(data);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.get("/market/search", async (req, res) => {
  try {
    const items = await searchMarketCoins(req.query.q);
    return res.json({ items });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.get("/coins/:id", async (req, res) => {
  try {
    const data = await getCoinDetail(req.params.id);
    return res.json(data);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.get("/ops/queue", assertAdmin, (req, res) => {
  res.json(getQueueStats());
});

// ─── ADMIN: STATS ────────────────────────────────────────────────────────────
router.get("/admin/stats", assertAdmin, (req, res) => {
  res.json(getStats());
});

// ─── ADMIN: USERS ────────────────────────────────────────────────────────────
router.get("/admin/users", assertAdmin, (req, res) => {
  const page = Number(req.query.page || 1);
  const limit = Math.min(Number(req.query.limit || 50), 200);
  const { users, total } = getUsers({ page, limit });
  res.json({ users: users.map((u) => ({ ...u, passwordHash: undefined })), total, page, limit });
});

router.put("/admin/users/:id", assertAdmin, (req, res) => {
  const user = findUserById(req.params.id);
  if (!user) return res.status(404).json({ error: "User not found" });

  const allowed = ["name", "role"];
  const patch = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) patch[key] = req.body[key];
  }

  const updated = updateUser(req.params.id, (u) => ({ ...u, ...patch }));
  res.json({ user: { ...updated, passwordHash: undefined } });
});

router.delete("/admin/users/:id", assertAdmin, (req, res) => {
  const user = findUserById(req.params.id);
  if (!user) return res.status(404).json({ error: "User not found" });
  deleteUser(req.params.id);
  res.json({ ok: true });
});

// ─── ADMIN: NEWS ─────────────────────────────────────────────────────────────
router.get("/admin/news", assertAdmin, (req, res) => {
  const limit = Math.min(Number(req.query.limit || 100), 500);
  res.json({ items: getNews(limit) });
});

router.get("/admin/news/:id", assertAdmin, (req, res) => {
  const item = getNewsById(req.params.id);
  if (!item) return res.status(404).json({ error: "Not found" });
  res.json(item);
});

router.put("/admin/news/:id", assertAdmin, (req, res) => {
  const item = getNewsById(req.params.id);
  if (!item) return res.status(404).json({ error: "Not found" });
  const patch = {};
  for (const key of ["title", "body", "priority", "tags", "coins"]) {
    if (req.body[key] !== undefined) patch[key] = req.body[key];
  }
  res.json(updateNewsItem(req.params.id, patch));
});

router.delete("/admin/news/:id", assertAdmin, (req, res) => {
  const item = getNewsById(req.params.id);
  if (!item) return res.status(404).json({ error: "Not found" });
  deleteNewsItem(req.params.id);
  res.json({ ok: true });
});

// ─── ADMIN: APP SETTINGS ─────────────────────────────────────────────────────
router.get("/admin/settings", assertAdmin, (req, res) => {
  res.json(getAllAppSettings());
});

router.put("/admin/settings", assertAdmin, (req, res) => {
  const patch = req.body;
  if (!patch || typeof patch !== "object") return res.status(400).json({ error: "body must be an object" });
  for (const [key, value] of Object.entries(patch)) {
    setAppSetting(key, value);
  }
  res.json(getAllAppSettings());
});

// ─── ONLINE PING (from mobile) ───────────────────────────────────────────────
// Mobile calls this periodically so admin panel can show live user count
router.post("/ping", (req, res) => {
  const sessionId = req.body?.sessionId || req.get("x-session-id");
  if (!sessionId) return res.status(400).json({ error: "sessionId required" });

  const userId = req.body?.userId || null;
  const ip = req.ip || "";
  const userAgent = req.get("user-agent") || "";
  pingSession(sessionId, { userId, ip, userAgent });

  if (userId) touchUserSeen(userId);
  res.json({ ok: true, onlineCount: getOnlineCount() });
});

module.exports = router;
