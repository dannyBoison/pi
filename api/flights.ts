export default async function handler(req: any, res: any) {
  try {
    const response = await fetch(
      "https://opensky-network.org/api/states/all?lamin=-40&lomin=-20&lamax=38&lomax=55"
    );

    // 🔥 CHECK RESPONSE STATUS
    if (!response.ok) {
      const text = await response.text();

      console.error("OpenSky Error:", response.status, text);

      return res.status(500).json({
        error: "OpenSky API failed",
        status: response.status,
        details: text
      });
    }

    const data = await response.json();

    res.setHeader("Access-Control-Allow-Origin", "*");

    return res.status(200).json(data);

  } catch (error: any) {
    console.error("SERVER ERROR:", error);

    return res.status(500).json({
      error: "Server crashed",
      message: error.message
    });
  }
}
