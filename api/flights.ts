// api/flights.ts
import { Buffer } from "buffer";

// Cache variables
let cachedData: any = null;
let lastFetch: number = 0;

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
      return null; // Do not update cache if error
    }

    let data;
    try {
      data = await res.json();
    } catch (err) {
      const text = await res.text();
      console.error("Invalid JSON from OpenSky:", text);
      return null;
    }

    cachedData = {
      timestamp: new Date().toISOString(),
      data
    };
    lastFetch = Date.now();
    return cachedData;

  } catch (err) {
    console.error("OpenSky fetch error:", err);
    return null;
  }
};

// Initial fetch immediately
(async () => {
  await fetchOpenSky();
})();

// Refresh cache every 3 seconds
setInterval(fetchOpenSky, 3000);

// Default handler
export default async function handler(req: any, res: any) {
  // If cache is empty, fetch once before responding
  if (!cachedData) {
    const result = await fetchOpenSky();
    if (!result) {
      return res.status(503).json({ error: "Data not ready yet, try again in a few seconds" });
    }
  }

  // Return cached data
  res.setHeader("Content-Type", "application/json");
  res.status(200).json(cachedData);
}
