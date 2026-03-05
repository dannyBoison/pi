import React, { useState, useEffect, useRef } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Circle,
  Polyline
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Airports
const airports = [
  { name: "Accra Intl Airport", coords: [5.6051, -0.1662] },
  { name: "Tamale Airport", coords: [9.5573, -0.8631] },
  { name: "Takoradi Airport", coords: [4.8962, -1.7554] },
  { name: "Kumasi Airport", coords: [6.7148, -1.5670] }
];

// 🔐 HARDCODE YOUR OPENSKY LOGIN HERE
const OPENSKY_USERNAME = "Danny1to10";
const OPENSKY_PASSWORD = "";

// Icons
const airportIcon = L.icon({
  iconUrl: "https://cdn-icons-png.flaticon.com/512/684/684908.png",
  iconSize: [30, 30]
});

const planeIcon = L.icon({
  iconUrl: "https://cdn-icons-png.flaticon.com/128/870/870194.png",
  iconSize: [40, 40]
});

// Weather icons
const weatherIconsUrls = {
  Clear: "https://cdn-icons-png.flaticon.com/512/869/869869.png",
  Clouds: "https://cdn-icons-png.flaticon.com/512/414/414825.png",
  Rain: "https://cdn-icons-png.flaticon.com/512/1163/1163624.png",
  Snow: "https://cdn-icons-png.flaticon.com/512/642/642102.png",
  Wind: "https://cdn-icons-png.flaticon.com/512/3081/3081637.png",
  Default: "https://cdn-icons-png.flaticon.com/512/252/252035.png"
};

// Zone colors
const zoneColors = {
  danger: "red",
  caution: "yellow",
  safe: "green"
};

const createZoneIcon = (weatherMain, zoneType) => {
  const color = zoneColors[zoneType] || "green";
  const weatherUrl = weatherIconsUrls[weatherMain] || weatherIconsUrls.Default;

  return L.divIcon({
    html: `<div style="background-color:${color};border-radius:50%;width:35px;height:35px;display:flex;align-items:center;justify-content:center;">
             <img src="${weatherUrl}" style="width:20px;height:20px;" />
           </div>`,
    className: ""
  });
};

export default function MapPanel() {
  const [zones, setZones] = useState([]);
  const [selectedZone, setSelectedZone] = useState(null);
  const [center, setCenter] = useState([5.6, -0.16]);
  const [radius, setRadius] = useState(150);

  const [route, setRoute] = useState([]);
  const [planePos, setPlanePos] = useState(airports[0].coords);

  const [city, setCity] = useState("");
  const [cityName, setCityName] = useState("");
  const [loading, setLoading] = useState(false);

  // LIVE AIRCRAFT
  const [livePlanes, setLivePlanes] = useState([]);

  // Button control
  const [startTracking, setStartTracking] = useState(false);

  const stepRef = useRef(0);
  const API_KEY = import.meta.env.VITE_WEATHER_API_KEY;

  const generateRandomPoints = (count = 8) => {
    const points = [];
    for (let i = 0; i < count; i++) {
      const lat = center[0] + (Math.random() - 0.5) * (radius / 50);
      const lng = center[1] + (Math.random() - 0.5) * (radius / 50);
      points.push({ lat, lng });
    }
    return points;
  };

  const searchCityAndSetCenter = async () => {
    if (!city) return alert("Enter a city name");

    try {
      setLoading(true);
      const res = await fetch(
        `https://api.openweathermap.org/geo/1.0/direct?q=${city}&limit=1&appid=${API_KEY}`
      );
      const data = await res.json();

      if (!data.length) {
        alert("City not found");
        setLoading(false);
        return;
      }

      const { lat, lon, name } = data[0];
      setCenter([lat, lon]);
      setCityName(name);
      setLoading(false);
    } catch (err) {
      console.error("City search error", err);
      setLoading(false);
    }
  };

  const generateZonesFromWeather = async () => {
    const randomPoints = generateRandomPoints(8);
    const newZones = [];

    for (let p of randomPoints) {
      try {
        const res = await fetch(
          `https://api.openweathermap.org/data/2.5/weather?lat=${p.lat}&lon=${p.lng}&appid=${API_KEY}&units=metric`
        );
        const data = await res.json();

        const wind = data.wind?.speed || 0;
        const temp = data.main?.temp || 0;
        const weatherMain = data.weather?.[0]?.main || "Default";

        let type = "safe";
        if (wind > 15 || weatherMain === "Rain") type = "danger";
        else if (wind > 8 || weatherMain === "Clouds") type = "caution";

        newZones.push({
          ...p,
          type,
          weather: {
            temp,
            wind,
            description: data.weather[0]?.description || "",
            main: weatherMain
          }
        });
      } catch (err) {
        console.error("Weather API error", err);
      }
    }

    setZones(newZones);
    if (newZones.length > 0) setSelectedZone(newZones[0]);
  };

  // LIVE AIRCRAFT (only after button click)
  useEffect(() => {
    if (!startTracking) return;

    const fetchLiveAircraft = async () => {
  try {
    const res = await fetch("/.netlify/functions/flights");
    const data = await res.json();

    if (!data.states) return;

    const planes = data.states
      .filter(p => p[5] && p[6])
      .filter(p => p[6] > 4 && p[6] < 11 && p[5] > -4 && p[5] < 2) // Ghana area
      .slice(0, 50)
      .map(p => ({
        icao: p[0],
        callsign: p[1],
        lng: p[5],
        lat: p[6],
        altitude: p[7],
        velocity: p[9],
        heading: p[10]
      }));

    setLivePlanes(planes);

  } catch (err) {
    console.error("Flight fetch error:", err);
  }
};

    fetchLiveAircraft();
    const interval = setInterval(fetchLiveAircraft, 5000);

    return () => clearInterval(interval);
  }, [startTracking]);

  return (
    <div style={{ display: "flex" }}>
      {/* Sidebar */}
      <div style={{ width: "30%", padding: 20, background: "#111", color: "white", height: "100vh", overflowY: "scroll" }}>
        <h2>✈️ Smart Flight System V7 (Live Tracking)</h2>

        <input
          type="text"
          placeholder="Enter city (eg. Accra)"
          value={city}
          onChange={(e) => setCity(e.target.value)}
          style={{ width: "100%", padding: 8, marginBottom: 8 }}
        />
        <button onClick={searchCityAndSetCenter}>📍 Set Center</button>
        <p>Selected City: <strong>{cityName || "None"}</strong></p>

        <label>Radius (km)</label>
        <input type="number" value={radius} onChange={e => setRadius(+e.target.value)} />

        <br /><br />
        <button onClick={generateZonesFromWeather}>
          {loading ? "Scanning Weather..." : "🌦 Generate Zones"}
        </button>

        <hr />

        {/* NEW BUTTON ONLY */}
        <button
          onClick={() => setStartTracking(true)}
          style={{ width: "100%", padding: 12, background: "green", color: "white" }}
        >
          ✈️ Start Live Aircraft Tracking
        </button>

        <p>✈️ Live Aircraft: {livePlanes.length}</p>
      </div>

      {/* Map */}
      <MapContainer center={center} zoom={6} style={{ height: "100vh", width: "70%" }}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

        {airports.map((a, i) => (
          <Marker key={i} position={a.coords} icon={airportIcon}>
            <Popup>{a.name}</Popup>
          </Marker>
        ))}

        {zones.map((z, i) => (
          <Marker key={i} position={[z.lat, z.lng]} icon={createZoneIcon(z.weather.main, z.type)}>
            <Popup>
              <strong>{z.type.toUpperCase()}</strong><br />
              {z.weather.description}<br />
              Temp: {z.weather.temp}°C<br />
              Wind: {z.weather.wind} m/s
            </Popup>
          </Marker>
        ))}

        {livePlanes.map((plane, i) => (
          <Marker key={i} position={[plane.lat, plane.lng]} icon={planeIcon}>
            <Popup>
              ✈️ {plane.callsign || "Unknown"}<br />
              Altitude: {plane.altitude || "N/A"} m<br />
              Speed: {plane.velocity || "N/A"} m/s<br />
              Heading: {plane.heading || "N/A"}°
            </Popup>
          </Marker>
        ))}

        <Circle center={center} radius={radius * 1000} />
      </MapContainer>
    </div>
  );
}