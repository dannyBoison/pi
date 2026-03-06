import { Buffer } from "buffer";

export async function handler(event, context) {

  const username = "danny1to10";
  const password = "@4smYJRnjFzc2gx";

  const auth = "Basic " + Buffer.from(`${username}:${password}`).toString("base64");

  try {

    const response = await fetch("https://opensky-network.org/api/states/all", {
      method: "GET",
      headers: {
        Authorization: auth,
        "Content-Type": "application/json"
      }
    });

    if (!response.ok) {
      const text = await response.text();
      return {
        statusCode: response.status,
        body: JSON.stringify({
          error: "OpenSky API error",
          status: response.status,
          message: text
        })
      };
    }

    const data = await response.json();

    return {
      statusCode: 200,
      body: JSON.stringify(data)
    };

  } catch (error) {

    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "fetch failed",
        message: error.message
      })
    };

  }
}
