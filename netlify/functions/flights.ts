import { Buffer } from "buffer";

export async function handler() {

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

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(data)
    };

  } catch (err) {

    console.error("Function error:", err);

    return {
      statusCode: 500,
      body: JSON.stringify({
        error: err.message
      })
    };

  }

}
