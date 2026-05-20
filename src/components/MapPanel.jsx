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

const zoneColors = {
  danger: "#ff3b30",
  caution: "#ff9500",
  safe: "#00ff88"
};

// ================= WEATHER ICON =================
const createZoneIcon = (weatherMain, zoneType, isSelected) => {
  const color = zoneColors[zoneType] || "green";
  const weatherUrl = weatherIconsUrls[weatherMain] || weatherIconsUrls.Default;

  return L.divIcon({
    html: `
      <div style="
        background:${color};
        border:${isSelected ? "3px solid yellow" : "2px solid white"};
        border-radius:50%;
        width:36px;
        height:36px;
        display:flex;
        align-items:center;
        justify-content:center;
        box-shadow:0 0 12px rgba(0,0,0,0.5);
      ">
        <img src="${weatherUrl}" style="width:20px;height:20px;" />
      </div>
    `,
    className: ""
  });
};

// ================= MAP PANEL =================
export default function MapPanel() {
  const [zones, setZones] = useState([]);
  const [center, setCenter] = useState([5.6051, -0.1662]);
  const [radius, setRadius] = useState(150);

  const [planes, setPlanes] = useState({});
  const [planeTrails, setPlaneTrails] = useState({});
  const [lastUpdated, setLastUpdated] = useState(null);
  const [startTracking, setStartTracking] = useState(false);

  const [selectedPlane, setSelectedPlane] = useState(null);
  const [selectedZone, setSelectedZone] = useState(null);

  const WEATHER_API = import.meta.env.VITE_WEATHER_API_KEY;

  const [cityInput, setCityInput] = useState("Accra");
  const [radiusInput, setRadiusInput] = useState(radius);

  // ================= RANDOM WEATHER POINTS =================
  const generateRandomPoints = (count = 10) => {
    return Array.from({ length: count }, () => ({
      lat: center[0] + (Math.random() - 0.5) * (radius / 50),
      lng: center[1] + (Math.random() - 0.5) * (radius / 50)
    }));
  };

  // ================= WEATHER ZONES =================
  const generateZonesFromWeather = async () => {
    const points = generateRandomPoints(10);
    const newZones = [];

    for (let p of points) {
      try {
        const res = await fetch(
          `https://api.openweathermap.org/data/2.5/weather?lat=${p.lat}&lon=${p.lng}&appid=${WEATHER_API}&units=metric`
        );

        const data = await res.json();

        const wind = data.wind?.speed || 0;
        const temp = data.main?.temp || 0;
        const weatherMain = data.weather?.[0]?.main || "Clear";

        let type = "safe";
        if (wind > 15 || weatherMain === "Rain") type = "danger";
        else if (wind > 8 || weatherMain === "Clouds") type = "caution";

        newZones.push({
          id: Math.random(),
          ...p,
          type,
          weather: {
            temp,
            wind,
            description: data.weather?.[0]?.description,
            main: weatherMain
          }
        });
      } catch (err) {
        console.error(err);
      }
    }

    setZones(newZones);
    setSelectedZone(null);
  };

  // ================= CITY SEARCH =================
  const updateCenter = async () => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${cityInput}`
      );
      const data = await res.json();

      if (data[0]) {
        setCenter([parseFloat(data[0].lat), parseFloat(data[0].lon)]);
        setRadius(Number(radiusInput));
      } else alert("City not found");
    } catch (err) {
      console.error(err);
    }
  };

  // ================= FLIGHTS =================
  const fetchFlights = async () => {
    try {
      const res = await fetch("/api/flights");
      const data = await res.json();

      const incoming =
        data.states?.filter(p => p[5] && p[6]).map(p => ({
          icao: p[0],
          callsign: p[1] || "N/A",
          lat: p[6],
          lng: p[5],
          altitude: p[7],
          velocity: p[9],
          heading: p[10]
        })) || [];

      setPlanes(prev => {
        const updated = { ...prev };
        incoming.forEach(p => {
          if (!updated[p.icao]) {
            updated[p.icao] = { ...p, targetLat: p.lat, targetLng: p.lng };
          } else {
            updated[p.icao].targetLat = p.lat;
            updated[p.icao].targetLng = p.lng;
          }
        });
        return updated;
      });

      setPlaneTrails(prev => {
        const updated = { ...prev };
        incoming.forEach(p => {
          if (!updated[p.icao]) updated[p.icao] = [];
          updated[p.icao].push([p.lat, p.lng]);
          if (updated[p.icao].length > 25) updated[p.icao].shift();
        });
        return updated;
      });

      setLastUpdated(new Date().toLocaleTimeString());
    } catch (err) {
      console.error(err);
    }
  };

  // ================= SMOOTH MOVEMENT =================
  useEffect(() => {
    const interval = setInterval(() => {
      setPlanes(prev => {
        const updated = { ...prev };
        Object.values(updated).forEach(p => {
          if (!p.targetLat) return;
          p.lat += (p.targetLat - p.lat) * 0.02;
          p.lng += (p.targetLng - p.lng) * 0.02;
        });
        return { ...updated };
      });
    }, 50);

    return () => clearInterval(interval);
  }, []);

  // ================= TRACKING LOOP =================
  useEffect(() => {
    if (!startTracking) return;

    fetchFlights();
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") fetchFlights();
    }, 90000);

    return () => clearInterval(interval);
  }, [startTracking]);

  return (
    <div style={{ display: "flex" }}>

      {/* SIDEBAR */}
      <div style={{ width: 300, background: "#0f172a", color: "white", padding: 20 }}>
        <h2>✈ Aviation Weather</h2>

        <input value={cityInput} onChange={e => setCityInput(e.target.value)} />
        <input value={radiusInput} onChange={e => setRadiusInput(e.target.value)} />

        <button onClick={updateCenter}>Set City</button>
        <button onClick={() => setStartTracking(true)}>Start Tracking</button>
        <button onClick={generateZonesFromWeather}>Generate Weather</button>

        <p>Planes: {Object.keys(planes).length}</p>
        <p>Updated: {lastUpdated}</p>

        {selectedZone && (
          <div>
            <h3>Weather</h3>
            <p>{selectedZone.weather.main}</p>
            <p>{selectedZone.weather.temp}°C</p>
          </div>
        )}
      </div>

      {/* MAP */}
      <MapContainer center={center} zoom={6} style={{ height: "100vh", width: "100%" }}>

        {/* BASE MAP */}
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

        {/* 🌍 WINDY-LIKE WEATHER LAYERS (NO PLUGINS) */}
        <TileLayer
          url={`https://tile.openweathermap.org/map/clouds_new/{z}/{x}/{y}.png?appid=${WEATHER_API}`}
          opacity={0.4}
        />

        <TileLayer
          url={`https://tile.openweathermap.org/map/wind_new/{z}/{x}/{y}.png?appid=${WEATHER_API}`}
          opacity={0.5}
        />

        <TileLayer
          url={`https://tile.openweathermap.org/map/precipitation_new/{z}/{x}/{y}.png?appid=${WEATHER_API}`}
          opacity={0.4}
        />

        <TileLayer
          url={`https://tile.openweathermap.org/map/temp_new/{z}/{x}/{y}.png?appid=${WEATHER_API}`}
          opacity={0.35}
        />

        {/* AIRPORTS */}
        {airports.map((a, i) => (
          <Marker key={i} position={a.coords} icon={airportIcon}>
            <Popup>{a.name}</Popup>
          </Marker>
        ))}

        {/* WEATHER ZONES */}
        {zones.map(z => (
          <Marker
            key={z.id}
            position={[z.lat, z.lng]}
            icon={createZoneIcon(z.weather.main, z.type, selectedZone?.id === z.id)}
            eventHandlers={{
              click: () => {
                setSelectedZone(z);
                setSelectedPlane(null);
              }
            }}
          />
        ))}

        {/* PLANES */}
        {Object.values(planes).map(p => (
          <Marker
            key={p.icao}
            position={[p.lat, p.lng]}
            icon={planeIcon}
          />
        ))}

        {/* TRAILS */}
        {Object.entries(planeTrails).map(([k, t]) => (
          <Polyline key={k} positions={t} color="cyan" />
        ))}

        <Circle center={center} radius={radius * 1000} />
      </MapContainer>
    </div>
  );
}
