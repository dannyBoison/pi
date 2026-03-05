import { Buffer } from "buffer"; // <-- must import Buffer

export async function handler() {
  const username = "Danny1to10";
  const password = "@4smYJRnjFzc2gx";

  const auth = "Basic " + Buffer.from(`${username}:${password}`).toString("base64");

  try {
    const res = await fetch("https://opensky-network.org/api/states/all", {
      headers: {
        Authorization: auth
      }
    });

    if (!res.ok) {
      return {
        statusCode: res.status,
        body: JSON.stringify({ error: `OpenSky returned ${res.status}` })
      };
    }

    const data = await res.json();

    return {
      statusCode: 200,
      body: JSON.stringify(data)
    };

  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
}
