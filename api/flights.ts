export default async function handler(req: any, res: any) {
  try {
    const response = await fetch(
      "https://opensky-network.org/api/states/all?lamin=-40&lomin=-20&lamax=38&lomax=55"
    );

    if (!response.ok) {
      return res.status(500).json({ error: "OpenSky API failed" });
    }

    const data = await response.json();

    res.setHeader("Access-Control-Allow-Origin", "*");

    return res.status(200).json(data);

  } catch (error) {
    console.error("SERVER ERROR:", error);

    return res.status(500).json({
      error: "Failed to fetch flights",
      details: error.message
    });
  }
}

