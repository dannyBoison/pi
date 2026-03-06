export async function handler() {
  try {

    const res = await fetch(
      "https://Danny1to10:@4smYJRnjFzc2gx@opensky-network.org/api/states/all"
    );

    if (!res.ok) {
      return {
        statusCode: res.status,
        body: JSON.stringify({
          error: "OpenSky API error",
          status: res.status
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
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: err.message
      })
    };
  }
}
