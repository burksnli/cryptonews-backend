const axios = require("axios");

const COINGECKO_BASE = "https://api.coingecko.com/api/v3";
const http = axios.create({
  timeout: 12000,
  headers: {
    "User-Agent": "cryptonews-backend/1.0"
  }
});

function mapMarketCoin(coin) {
  return {
    id: coin.id,
    symbol: coin.symbol,
    name: coin.name,
    image: coin.image,
    currentPrice: coin.current_price,
    marketCapRank: coin.market_cap_rank,
    priceChange24h: coin.price_change_percentage_24h,
    sparkline7d: coin.sparkline_in_7d?.price || []
  };
}

function mapCoinLoreCoin(coin) {
  return {
    id: String(coin.nameid || coin.symbol || coin.id || "").toLowerCase(),
    symbol: String(coin.symbol || ""),
    name: String(coin.name || coin.symbol || ""),
    image: null,
    currentPrice: Number(coin.price_usd || 0),
    marketCapRank: Number(coin.rank || 0) || null,
    priceChange24h: Number(coin.percent_change_24h || 0),
    sparkline7d: []
  };
}

async function fetchCoinLoreTopCoins(limit = 100) {
  const res = await http.get("https://api.coinlore.net/api/tickers/", {
    params: {
      start: 0,
      limit
    }
  });

  const items = Array.isArray(res.data?.data) ? res.data.data : [];
  return items.map(mapCoinLoreCoin);
}

async function getMarketOverview() {
  const [globalRes, coinsRes, fearRes] = await Promise.allSettled([
    http.get(`${COINGECKO_BASE}/global`),
    http.get(`${COINGECKO_BASE}/coins/markets`, {
      params: {
        vs_currency: "usd",
        order: "market_cap_desc",
        per_page: 250,
        page: 1,
        sparkline: true,
        price_change_percentage: "24h"
      }
    }),
    http.get("https://api.alternative.me/fng/")
  ]);

  const globalData = globalRes.status === "fulfilled" ? (globalRes.value.data?.data || {}) : {};
  const fear = fearRes.status === "fulfilled" ? (fearRes.value.data?.data?.[0] || null) : null;
  let coins = coinsRes.status === "fulfilled" && Array.isArray(coinsRes.value.data)
    ? coinsRes.value.data.map(mapMarketCoin)
    : [];

  if (!coins.length) {
    try {
      coins = await fetchCoinLoreTopCoins(120);
    } catch (error) {
      coins = [];
    }
  }

  return {
    updatedAt: new Date().toISOString(),
    btcDominance: globalData.market_cap_percentage?.btc || null,
    ethDominance: globalData.market_cap_percentage?.eth || null,
    totalMarketCapUsd: globalData.total_market_cap?.usd || null,
    totalVolumeUsd: globalData.total_volume?.usd || null,
    activeCryptocurrencies: globalData.active_cryptocurrencies || null,
    markets: globalData.markets || null,
    marketCapChange24h: globalData.market_cap_change_percentage_24h_usd || null,
    fearGreed: fear
      ? {
          value: Number(fear.value),
          label: fear.value_classification,
          timestamp: fear.timestamp
        }
      : null,
    coins
  };
}

async function searchMarketCoins(query) {
  const normalized = String(query || "").trim();
  if (!normalized) {
    return [];
  }

  const searchRes = await axios.get(`${COINGECKO_BASE}/search`, {
    params: {
      query: normalized
    }
  });

  const ids = (searchRes.data?.coins || []).slice(0, 20).map((coin) => coin.id).filter(Boolean);
  if (!ids.length) {
    return [];
  }

  const marketsRes = await axios.get(`${COINGECKO_BASE}/coins/markets`, {
    params: {
      vs_currency: "usd",
      ids: ids.join(","),
      order: "market_cap_desc",
      sparkline: true,
      price_change_percentage: "24h"
    }
  });

  const byId = new Map(marketsRes.data.map((coin) => [coin.id, mapMarketCoin(coin)]));
  return ids.map((id) => byId.get(id)).filter(Boolean);
}

async function getCoinDetail(coinId) {
  const res = await axios.get(`${COINGECKO_BASE}/coins/${coinId}`, {
    params: {
      localization: false,
      tickers: false,
      market_data: true,
      community_data: true,
      developer_data: false
    }
  });

  const coin = res.data;

  return {
    id: coin.id,
    symbol: coin.symbol,
    name: coin.name,
    image: coin.image?.large,
    description: coin.description?.en || "Description is not available.",
    categories: coin.categories || [],
    homepage: coin.links?.homepage?.[0] || null,
    currentPrice: coin.market_data?.current_price?.usd || null,
    marketCapRank: coin.market_cap_rank,
    marketCap: coin.market_data?.market_cap?.usd || null,
    high24h: coin.market_data?.high_24h?.usd || null,
    low24h: coin.market_data?.low_24h?.usd || null,
    circulatingSupply: coin.market_data?.circulating_supply || null,
    ath: coin.market_data?.ath?.usd || null,
    atl: coin.market_data?.atl?.usd || null,
    genesisDate: coin.genesis_date || null,
    twitterFollowers: coin.community_data?.twitter_followers || null,
    redditSubscribers: coin.community_data?.reddit_subscribers || null
  };
}

module.exports = {
  getMarketOverview,
  getCoinDetail,
  searchMarketCoins
};
