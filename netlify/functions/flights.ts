export async function handler() {
  const username = "Danny1to10";
  const password = "@4smYJRnjFzc2gx";

  try {
    // Node fetch works fine in Netlify functions
    const res = await fetch("https://opensky-network.org/api/states/all", {
      headers: {
        Authorization: "Basic " + btoa(username + ":" + password)
      }
    });

    // Check if response is OK
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
