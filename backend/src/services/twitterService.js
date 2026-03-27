const { TwitterApi } = require("twitter-api-v2");

let client;

function getClient() {
  if (client) {
    return client;
  }

  const {
    TWITTER_APP_KEY,
    TWITTER_APP_SECRET,
    TWITTER_ACCESS_TOKEN,
    TWITTER_ACCESS_SECRET
  } = process.env;

  if (!TWITTER_APP_KEY || !TWITTER_APP_SECRET || !TWITTER_ACCESS_TOKEN || !TWITTER_ACCESS_SECRET) {
    return null;
  }

  client = new TwitterApi({
    appKey: TWITTER_APP_KEY,
    appSecret: TWITTER_APP_SECRET,
    accessToken: TWITTER_ACCESS_TOKEN,
    accessSecret: TWITTER_ACCESS_SECRET
  });

  return client;
}

function buildTweet(newsItem) {
  const hashtagText = (newsItem.tags || [])
    .map((tag) => (tag.startsWith("#") ? tag : `#${tag}`))
    .join(" ");

  const base = `${newsItem.title}\n\n${newsItem.body}`.trim();
  const fullText = `${base}\n\n${hashtagText}`.trim();

  return fullText.length > 280 ? `${fullText.slice(0, 277)}...` : fullText;
}

async function postNewsToTwitter(newsItem) {
  const twitterClient = getClient();
  if (!twitterClient) {
    return { skipped: true, reason: "Twitter env missing" };
  }

  const text = buildTweet(newsItem);
  await twitterClient.v2.tweet(text);
  return { skipped: false };
}

module.exports = {
  postNewsToTwitter
};
