export default async function handler(req: any, res: any) {
  try {
    const username = process.env.OPENSKY_USERNAME;
    const password = process.env.OPENSKY_PASSWORD;

    const auth = Buffer.from(`${username}:${password}`).toString("base64");

    const response = await fetch(
      "https://opensky-network.org/api/states/all?lamin=-40&lomin=-20&lamax=38&lomax=55",
      {
        method: "GET",
        headers: {
          Authorization: `Basic ${auth}`,
          "User-Agent": "Mozilla/5.0"
        }
      }
    );

    if (!response.ok) {
      const text = await response.text();

      return res.status(500).json({
        error: "OpenSky API failed",
        status: response.status,
        details: text
      });
    }

    const data = await response.json();

    return res.status(200).json(data);

  } catch (error: any) {
    console.error("FULL ERROR:", error);

    return res.status(200).json({
      states: [] // 🔥 fallback so your frontend NEVER crashes
    });
  }
}
