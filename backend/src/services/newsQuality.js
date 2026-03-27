function normalize(text = "") {
  return String(text).trim().toLowerCase().replace(/\s+/g, " ");
}

function isDuplicateNews(existingNews, incomingItem, windowMinutes = 45) {
  if (!incomingItem?.title) {
    return false;
  }

  const incomingKey = `${normalize(incomingItem.title)}|${normalize(incomingItem.body || "")}`;
  const nowMs = Date.now();

  return existingNews.some((item) => {
    const itemMs = Date.parse(item.createdAt || 0);
    if (!itemMs || nowMs - itemMs > windowMinutes * 60 * 1000) {
      return false;
    }

    const itemKey = `${normalize(item.title)}|${normalize(item.body || "")}`;
    return itemKey === incomingKey;
  });
}

module.exports = {
  isDuplicateNews
};
