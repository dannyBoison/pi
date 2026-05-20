
import React, { useState, useEffect } from "react";
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

// ================= AIRPORTS =================
const airports = [
  { name: "Accra Intl Airport", coords: [5.6051, -0.1662] },
  { name: "Tamale Airport", coords: [9.5573, -0.8631] },
  { name: "Takoradi Airport", coords: [4.8962, -1.7554] },
  { name: "Kumasi Airport", coords: [6.7148, -1.567] }
];

// ================= ICONS =================
const airportIcon = L.icon({
  iconUrl: "https://cdn-icons-png.flaticon.com/512/684/684908.png",
  iconSize: [30, 30]
});

const planeIcon = L.icon({
  iconUrl: "https://cdn-icons-png.flaticon.com/128/6221/6221851.png",
  iconSize: [30, 30],
  iconAnchor: [15, 15]
});

// ================= WEATHER ICONS =================
const weatherIconsUrls = {
  Clear: "https://cdn-icons-png.flaticon.com/512/869/869869.png",
  Clouds: "https://cdn-icons-png.flaticon.com/512/414/414825.png",
  Rain: "https://cdn-icons-png.flaticon.com/512/1163/1163624.png",
  Snow: "https://cdn-icons-png.flaticon.com/512/642/642102.png",
  Default: "https://cdn-icons-png.flaticon.com/512/252/252035.png"
};

// ================= WIND COLOR GRADIENT =================
const getWindColor = (wind) => {
  if (wind < 5) return "#00ff88";
  if (wind < 10) return "#a3ff00";
  if (wind < 15) return "#ffcc00";
  if (wind < 20) return "#ff8800";
  return "#ff3b30";
};

// ================= WIND VECTOR =================
const createWindArrow = (lat, lng, speed, deg) => {
  const length = Math.min(speed * 500, 40000);

  const rad = (deg * Math.PI) / 180;
  const endLat = lat + (Math.cos(rad) * length) / 111320;
  const endLng = lng + (Math.sin(rad) * length) / (111320 * Math.cos(lat * Math.PI / 180));

  return [[lat, lng], [endLat, endLng]];
};

// ================= ZONE ICON =================
const createZoneIcon = (weatherMain) => {
  const icon = weatherIconsUrls[weatherMain] || weatherIconsUrls.Default;

  return L.divIcon({
    html: `
      <div style="
        background:rgba(0,0,0,0.4);
        border:2px solid white;
        border-radius:50%;
        width:34px;
        height:34px;
        display:flex;
        align-items:center;
        justify-content:center;
        backdrop-filter:blur(6px);
      ">
        <img src="${icon}" style="width:20px;height:20px;" />
      </div>
    `,
    className: ""
  });
};

// ================= MAP =================
export default function MapPanel() {
  const [zones, setZones] = useState([]);
  const [windVectors, setWindVectors] = useState([]);

  const [center, setCenter] = useState([5.6051, -0.1662]);
  const [radius, setRadius] = useState(150);

  const [planes, setPlanes] = useState({});
  const [planeTrails, setPlaneTrails] = useState({});
  const [selectedZone, setSelectedZone] = useState(null);

  const WEATHER_API = import.meta.env.VITE_WEATHER_API_KEY;

  // ================= RANDOM POINTS =================
  const generatePoints = () => {
    return Array.from({ length: 10 }, () => ({
      lat: center[0] + (Math.random() - 0.5) * 2,
      lng: center[1] + (Math.random() - 0.5) * 2
    }));
  };

  // ================= WEATHER =================
  const generateWeather = async () => {
    const points = generatePoints();
    const newZones = [];
    const windLines = [];

    for (let p of points) {
      const res = await fetch(
        `https://api.openweathermap.org/data/2.5/weather?lat=${p.lat}&lon=${p.lng}&appid=${WEATHER_API}&units=metric`
      );

      const data = await res.json();

      const wind = data.wind?.speed || 0;
      const deg = data.wind?.deg || 0;
      const main = data.weather?.[0]?.main || "Clear";

      newZones.push({
        ...p,
        wind,
        main
      });

      windLines.push(createWindArrow(p.lat, p.lng, wind, deg));
    }

    setZones(newZones);
    setWindVectors(windLines);
  };

  // ================= FLIGHTS =================
  const fetchFlights = async () => {
    const res = await fetch("/api/flights");
    const data = await res.json();

    const incoming =
      data.states?.filter(p => p[5] && p[6]).map(p => ({
        icao: p[0],
        callsign: p[1],
        lat: p[6],
        lng: p[5]
      })) || [];

    setPlanes(prev => {
      const updated = { ...prev };
      incoming.forEach(p => (updated[p.icao] = p));
      return updated;
    });
  };

  return (
    <div style={{ display: "flex" }}>

      {/* SIDEBAR */}
      <div style={{ width: 300, padding: 20, background: "#0f172a", color: "white" }}>
        <h2>🌍 Windy Style Map</h2>

        <button onClick={generateWeather} style={{ marginTop: 10 }}>
          Generate Wind Zones
        </button>

        <button onClick={fetchFlights} style={{ marginTop: 10 }}>
          Load Flights
        </button>
      </div>

      {/* MAP */}
      <MapContainer center={center} zoom={6} style={{ height: "100vh", width: "100%" }}>

        {/* BASE */}
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

        {/* WEATHER LAYERS */}
        <TileLayer
          url={`https://tile.openweathermap.org/map/clouds_new/{z}/{x}/{y}.png?appid=${WEATHER_API}`}
          opacity={0.4}
        />
        <TileLayer
          url={`https://tile.openweathermap.org/map/wind_new/{z}/{x}/{y}.png?appid=${WEATHER_API}`}
          opacity={0.5}
        />

        {/* 🌈 WINDY STYLE ZONES (GRADIENT RADIAL) */}
        {zones.map((z, i) => (
          <Circle
            key={i}
            center={[z.lat, z.lng]}
            radius={30000}
            pathOptions={{
              color: getWindColor(z.wind),
              fillColor: getWindColor(z.wind),
              fillOpacity: 0.25,
              weight: 2
            }}
          >
            <Popup>
              Wind: {z.wind} m/s
              <br />
              {z.main}
            </Popup>
          </Circle>
        ))}

        {/* 🌪 WIND DIRECTION ARROWS */}
        {windVectors.map((line, i) => (
          <Polyline
            key={i}
            positions={line}
            pathOptions={{
              color: "#00e5ff",
              weight: 2,
              opacity: 0.8,
              dashArray: "6 6"
            }}
          />
        ))}

        {/* AIRPORTS */}
        {airports.map((a, i) => (
          <Marker key={i} position={a.coords} icon={airportIcon}>
            <Popup>{a.name}</Popup>
          </Marker>
        ))}

        {/* PLANES */}
        {Object.values(planes).map((p, i) => (
          <Marker key={i} position={[p.lat, p.lng]} icon={planeIcon}>
            <Popup>{p.callsign}</Popup>
          </Marker>
        ))}

      </MapContainer>
    </div>
  );
}
