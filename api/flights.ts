export default async function handler(req, res) {
  try {

    const username = "Danny1to10";
    const password = "@4smYJRnjFzc2gx";

    const auth = btoa(`${username}:${password}`);

    const response = await fetch("https://opensky-network.org/api/states/all", {
      headers: {
        Authorization: `Basic ${auth}`
      }
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("OpenSky error:", text);

      return res.status(500).json({
        error: "OpenSky request failed",
        details: text
      });
    }

    const data = await response.json();

    return res.status(200).json({
      timestamp: new Date().toISOString(),
      data
    });

  } catch (err) {

    console.error("Server error:", err);

    return res.status(500).json({
      error: "Flight data fetch failed",
      message: err.message
    });

  }
}
