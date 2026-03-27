const express = require("express");
const crypto = require("crypto");

const { addNewsItem, getNews } = require("../store");
const { parseTelegramNews } = require("../services/newsParser");
const { enqueueBroadcast } = require("../services/broadcastQueue");
const { isDuplicateNews } = require("../services/newsQuality");

const router = express.Router();

router.post("/telegram/news", async (req, res) => {
  const secretHeader = req.get("x-telegram-bot-api-secret-token");
  const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  const allowedChatId = process.env.TELEGRAM_ALLOWED_CHAT_ID;

  if (expectedSecret && secretHeader !== expectedSecret) {
    return res.status(401).json({ error: "Unauthorized webhook secret" });
  }

  const message = req.body?.channel_post || req.body?.message;
  const chatId = String(message?.chat?.id || "");

  if (allowedChatId && chatId !== allowedChatId) {
    return res.status(403).json({ error: "Chat is not allowed" });
  }

  const text = message?.text || message?.caption || "";
  const parsed = parseTelegramNews(text);

  if (!parsed) {
    return res.status(400).json({ error: "Message is empty" });
  }

  const newsItem = {
    id: crypto.randomUUID(),
    source: "telegram",
    title: parsed.title,
    body: parsed.body,
    priority: parsed.priority || "normal",
    coins: parsed.coins || [],
    tags: parsed.tags,
    createdAt: new Date().toISOString()
  };

  if (isDuplicateNews(getNews(120), newsItem)) {
    return res.status(409).json({ error: "Duplicate news detected in recent window" });
  }

  addNewsItem(newsItem);
  const broadcast = await enqueueBroadcast(newsItem);

  return res.json({ ok: true, newsItem, broadcast });
});

module.exports = router;
