let cachedData = null;
let lastFetch = 0;

const FETCH_INTERVAL = 30000; // 30 seconds

export default async function handler(req, res) {
  try {

    const now = Date.now();

    // If cache expired or empty → fetch fresh
    if (!cachedData || now - lastFetch > FETCH_INTERVAL) {

      const username = process.env.OPENSKY_USERNAME;
      const password = process.env.OPENSKY_PASSWORD;

      const auth = Buffer.from(`${username}:${password}`).toString("base64");

      const response = await fetch("https://opensky-network.org/api/states/all", {
        headers: {
          Authorization: `Basic ${auth}`
        }
      });

      const data = await response.json();

      cachedData = data;
      lastFetch = now;
    }

    return res.status(200).json({
      timestamp: lastFetch,
      data: cachedData
    });

  } catch (err) {

    console.error("OpenSky fetch error:", err);

    return res.status(500).json({
      error: "Flight data fetch failed"
    });

  }
}
