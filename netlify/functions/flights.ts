import { Buffer } from "buffer";

// Cache variables
let cachedData = null;
let lastFetch = 0;

// Fetch OpenSky data and update cache
const fetchOpenSky = async () => {
  const username = "danny1to10";
  const password = "@4smYJRnjFzc2gx";

  const auth = "Basic " + Buffer.from(`${username}:${password}`).toString("base64");

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const res = await fetch("https://opensky-network.org/api/states/all", {
      headers: {
        Authorization: auth,
        "User-Agent": "Mozilla/5.0"
      },
      signal: controller.signal
    });

    clearTimeout(timeout);

    if (!res.ok) {
      const text = await res.text();
      console.error("OpenSky API error:", text);
      return; // do not update cache if error
    }

    let data;
    try {
      data = await res.json();
    } catch (err) {
      const text = await res.text();
      console.error("Invalid JSON from OpenSky:", text);
      return;
    }

    cachedData = data;
    lastFetch = Date.now();

  } catch (err) {
    console.error("OpenSky fetch error:", err);
  }
};

// Initial fetch
fetchOpenSky();

// Refresh cache every 30 seconds
setInterval(fetchOpenSky, 30000);

// Handler
export default async function handler(req, res) {
  if (!cachedData) {
    return res.status(503).json({ error: "Data not ready yet, try again in a few seconds" });
  }

  res.setHeader("Content-Type", "application/json");
  res.status(200).json(cachedData);
}
