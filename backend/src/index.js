require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

const apiRoutes = require("./routes/apiRoutes");
const webhookRoutes = require("./routes/webhookRoutes");
const path = require("path");

const app = express();

// Required when running behind proxies/tunnels (Render, ngrok, pinggy, etc.)
app.set("trust proxy", 1);

app.use(cors({ origin: process.env.CORS_ORIGIN || "*" }));
app.use(helmet());
app.use(
  rateLimit({
    windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 60000),
    max: Number(process.env.RATE_LIMIT_MAX || 240),
    standardHeaders: true,
    legacyHeaders: false
  })
);
app.use(express.json({ limit: "1mb" }));

app.get("/health", (req, res) => {
  res.json({ ok: true, timestamp: new Date().toISOString() });
});

app.use("/api", apiRoutes);
app.use("/webhook", webhookRoutes);
// Admin panel — served at /admin
app.use("/admin", helmet.contentSecurityPolicy({
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", "'unsafe-inline'"],
    scriptSrcAttr: ["'unsafe-inline'"],
    styleSrc: ["'self'", "'unsafe-inline'"],
    imgSrc: ["'self'", "data:"],
    connectSrc: ["'self'"]
  }
}), express.static(path.join(__dirname, "admin")));

const port = Number(process.env.PORT || 4000);
app.listen(port, () => {
  console.log(`API running on http://localhost:${port}`);
});
