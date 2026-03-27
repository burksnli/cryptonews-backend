const { postNewsToTwitter } = require("./twitterService");
const { sendNewsPush } = require("./pushService");
const { getPushTokens } = require("../store");

const queue = [];
let processing = false;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runWithRetry(task, retries = 2, delayMs = 1200) {
  let lastError = null;
  for (let i = 0; i <= retries; i += 1) {
    try {
      return await task();
    } catch (error) {
      lastError = error;
      if (i < retries) {
        await sleep(delayMs * (i + 1));
      }
    }
  }
  throw lastError;
}

async function processItem(item) {
  const tokens = getPushTokens();

  const [twitterResult, pushResult] = await Promise.allSettled([
    runWithRetry(() => postNewsToTwitter(item.newsItem)),
    runWithRetry(() => sendNewsPush(item.newsItem, tokens))
  ]);

  item.resolve({
    twitter: twitterResult.status === "fulfilled" ? twitterResult.value : { error: twitterResult.reason?.message },
    push: pushResult.status === "fulfilled" ? pushResult.value : { error: pushResult.reason?.message }
  });
}

async function processQueue() {
  if (processing) {
    return;
  }

  processing = true;
  while (queue.length) {
    const item = queue.shift();
    try {
      await processItem(item);
    } catch (error) {
      item.reject(error);
    }
  }
  processing = false;
}

function enqueueBroadcast(newsItem) {
  return new Promise((resolve, reject) => {
    queue.push({ newsItem, resolve, reject });
    processQueue().catch(reject);
  });
}

function getQueueStats() {
  return {
    pending: queue.length,
    processing
  };
}

module.exports = {
  enqueueBroadcast,
  getQueueStats
};
