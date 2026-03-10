import { Buffer } from "buffer";

// Cache variables
let cachedData = null;
let lastFetch = 0;

export async function handler() {

  const now = Date.now();

  // Return cached data if less than 30 seconds old
  if (cachedData && now - lastFetch < 30000) {
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cachedData)
    };
  }

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

      return {
        statusCode: res.status,
        body: JSON.stringify({
          error: "OpenSky API error",
          message: text
        })
      };
    }

    const data = await res.json();

    // Save to cache
    cachedData = data;
    lastFetch = now;

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    };

  } catch (err) {

    console.error("Function error:", err);

    return {
      statusCode: 500,
      body: JSON.stringify({
        error: err.message,
        stack: err.stack
      })
    };

  }

}
✅ What Changed:

Added:

let cachedData = null;
let lastFetch = 0;

Before fetching, it checks if cached data is less than 30 seconds old:

if (cachedData && now - lastFetch < 30000) { ... }

If yes, it returns cached data immediately, reducing OpenSky API calls and Netlify usage.

If you want, I can also add an optional interval cache refresh so Netlify fetches in the background every 30s, instead of waiting for the first request. This makes the front-end even smoother.

Do you want me to do that?
