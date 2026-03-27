const crypto = require("crypto");

const TOKEN_SECRET = process.env.AUTH_TOKEN_SECRET || "cryptonews-dev-secret-change-me";
const TOKEN_TTL_MS = 1000 * 60 * 60 * 24 * 30;

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const derivedKey = crypto.scryptSync(String(password), salt, 64).toString("hex");
  return `${salt}:${derivedKey}`;
}

function verifyPassword(password, hashedPassword) {
  const [salt, savedHash] = String(hashedPassword || "").split(":");
  if (!salt || !savedHash) {
    return false;
  }

  const nextHash = crypto.scryptSync(String(password), salt, 64).toString("hex");
  const savedBuffer = Buffer.from(savedHash, "hex");
  const nextBuffer = Buffer.from(nextHash, "hex");

  if (savedBuffer.length !== nextBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(savedBuffer, nextBuffer);
}

function createToken(payload) {
  const body = {
    ...payload,
    exp: Date.now() + TOKEN_TTL_MS
  };

  const encoded = Buffer.from(JSON.stringify(body)).toString("base64url");
  const signature = crypto.createHmac("sha256", TOKEN_SECRET).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
}

function verifyToken(token) {
  const [encoded, signature] = String(token || "").split(".");
  if (!encoded || !signature) {
    return null;
  }

  const expected = crypto.createHmac("sha256", TOKEN_SECRET).update(encoded).digest("base64url");
  if (expected !== signature) {
    return null;
  }

  const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
  if (!payload.exp || payload.exp < Date.now()) {
    return null;
  }

  return payload;
}

function sanitizeUser(user) {
  if (!user) {
    return null;
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    createdAt: user.createdAt,
    preferences: user.preferences || {}
  };
}

module.exports = {
  hashPassword,
  verifyPassword,
  createToken,
  verifyToken,
  sanitizeUser
};
