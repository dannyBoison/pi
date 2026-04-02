// server.js
import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
app.use(cors());

app.get("/api/flights", async (req, res) => {
  try {
    const response = await fetch(
      "https://opensky-network.org/api/states/all?lamin=-40&lomin=-20&lamax=38&lomax=55"
    );

    const data = await response.json();
    res.json(data);

  } catch (err) {
    res.status(500).json({ error: "Failed to fetch flights" });
  }
});

app.listen(5000, () => console.log("Server running"));
