function splitLines(text = "") {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function normalizeTag(tag) {
  const cleaned = tag.trim().replace(/^#+/, "").replace(/\s+/g, "");
  if (!cleaned) {
    return null;
  }
  return `#${cleaned.toUpperCase()}`;
}

function parseStructured(lines) {
  const structured = {};

  for (const line of lines) {
    const sepIdx = line.indexOf(":");
    if (sepIdx <= 0) {
      continue;
    }

    const key = line.slice(0, sepIdx).trim().toLowerCase();
    const value = line.slice(sepIdx + 1).trim();
    if (!value) {
      continue;
    }

    structured[key] = value;
  }

  if (!Object.keys(structured).length) {
    return null;
  }

  const title = structured.baslik || structured.title;
  const body = structured.metin || structured.body;
  const priority = (structured.onem || structured.priority || "normal").toLowerCase();

  const tagsRaw = structured.etiket || structured.tags || "";
  const coinRaw = structured.coin || structured.coins || "";

  const tags = tagsRaw
    .split(/[ ,]+/)
    .map(normalizeTag)
    .filter(Boolean);

  const coins = coinRaw
    .split(/[ ,]+/)
    .map((coin) => coin.trim().toUpperCase())
    .filter(Boolean);

  if (!title) {
    return null;
  }

  return {
    title,
    body: body || title,
    priority,
    coins,
    tags
  };
}

function parseFallback(lines) {
  if (!lines.length) {
    return null;
  }

  const title = lines[0];
  const tags = [];
  const coins = [];
  const bodyLines = [];

  for (const line of lines.slice(1)) {
    if (line.startsWith("#")) {
      const tag = normalizeTag(line);
      if (tag) {
        tags.push(tag);
      }
      continue;
    }

    if (line.startsWith("$") && line.length > 1) {
      coins.push(line.slice(1).toUpperCase());
      continue;
    }

    bodyLines.push(line);
  }

  return {
    title,
    body: bodyLines.join(" ").trim() || title,
    priority: "normal",
    coins,
    tags
  };
}

function parseTelegramNews(text = "") {
  const lines = splitLines(text);
  if (!lines.length) {
    return null;
  }

  return parseStructured(lines) || parseFallback(lines);
}

module.exports = {
  parseTelegramNews
};
