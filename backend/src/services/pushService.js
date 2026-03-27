const { Expo } = require("expo-server-sdk");

const expo = new Expo();

async function sendNewsPush(newsItem, tokens) {
  const validTokens = tokens.filter((token) => Expo.isExpoPushToken(token));
  if (!validTokens.length) {
    return { sent: 0, skipped: tokens.length };
  }

  const messages = validTokens.map((token) => ({
    to: token,
    sound: "default",
    title: `Son Dakika: ${newsItem.title}`,
    body: newsItem.body,
    data: {
      type: "breaking-news",
      newsId: newsItem.id
    }
  }));

  const chunks = expo.chunkPushNotifications(messages);
  const tickets = [];

  for (const chunk of chunks) {
    const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
    tickets.push(...ticketChunk);
  }

  return { sent: tickets.length, skipped: tokens.length - validTokens.length };
}

module.exports = {
  sendNewsPush
};
