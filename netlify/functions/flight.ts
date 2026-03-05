export async function handler() {

  const username = "Danny1to10";
  const password = "@4smYJRnjFzc2gx";

  try {
    const res = await fetch("https://opensky-network.org/api/states/all", {
      headers: {
        Authorization:
          "Basic " + Buffer.from(username + ":" + password).toString("base64")
      }
    });

    const data = await res.json();

    return {
      statusCode: 200,
      body: JSON.stringify(data)
    };

  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Failed to fetch aircraft data" })
    };
  }
}