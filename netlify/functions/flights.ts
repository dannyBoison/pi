import { Buffer } from "buffer";

let cachedData = null;
let lastFetch = 0;

export default async function handler(req, res) {

  const now = Date.now();

  // Serve cached data for 30 seconds
  if (cachedData && now - lastFetch < 30000) {
    return res.status(200).json(cachedData);
  }

  const username = "danny1to10";
  const password = "@4smYJRnjFzc2gx";

  const auth =
    "Basic " + Buffer.from(`${username}:${password}`).toString("base64");

  try {

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const response = await fetch("https://opensky-network.org/api/states/all", {
      headers: {
        Authorization: auth,
        "User-Agent": "Mozilla/5.0"
      },
      signal: controller.signal
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const text = await response.text();
      console.error("OpenSky error:", text);
      return res.status(response.status).json({ error: text });
    }

    const data = await response.json();

    cachedData = data;
    lastFetch = now;

    return res.status(200).json(data);

  } catch (err) {

    console.error("Function error:", err);

    return res.status(500).json({
      error: err.message
    });

  }
}
