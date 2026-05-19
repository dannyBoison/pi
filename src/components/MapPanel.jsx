import React, { useState, useEffect, useMemo } from "react";
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

// ================= PLANE ICON =================
const planeIcon = (heading) =>
  L.divIcon({
    html: `
      <img
        src="https://cdn-icons-png.flaticon.com/128/6221/6221851.png"
        style="width:30px;height:30px;transform:rotate(${heading || 0}deg);"
      />
    `,
    className: ""
  });

// ================= WEATHER ICONS =================
const weatherIconsUrls = {
  Clear: "https://cdn-icons-png.flaticon.com/512/869/869869.png",
  Clouds: "https://cdn-icons-png.flaticon.com/512/414/414825.png",
  Rain: "https://cdn-icons-png.flaticon.com/512/1163/1163624.png",
  Snow: "https://cdn-icons-png.flaticon.com/512/642/642102.png",
  Wind: "https://cdn-icons-png.flaticon.com/512/3081/3081637.png",
  Default: "https://cdn-icons-png.flaticon.com/512/252/252035.png"
};

// ================= ZONE COLORS (Windy-like feel) =================
const zoneColors = {
  danger: "#ff3b30",
  caution: "#ff9500",
  safe: "#34c759",
  calm: "#00c7ff"
};

// ================= ZONE ICON =================
const createZoneIcon = (weatherMain, zoneType, windDeg) => {
  const color = zoneColors[zoneType] || "#00c7ff";
  const icon = weatherIconsUrls[weatherMain] || weatherIconsUrls.Default;

  return L.divIcon({
    html: `
      <div style="
        background:${color};
        border:2px solid white;
        border-radius:50%;
        width:46px;
        height:46px;
        display:flex;
        align-items:center;
        justify-content:center;
        box-shadow:0 0 18px ${color};
      ">
        <img src="${icon}" style="width:22px;height:22px;" />
      </div>

      <div style="
        position:absolute;
        top:-8px;
        left:18px;
        transform:rotate(${windDeg || 0}deg);
        font-size:14px;
      ">↑</div>
    `,
    className: ""
  });
};

// ================= GRID WEATHER (Windy-style instead of random chaos) =================
const generateGridPoints = (center, radiusKm, step = 0.6) => {
  const points = [];

  for (let latOffset = -radiusKm / 20; latOffset <= radiusKm / 20; latOffset += step) {
    for (let lngOffset = -radiusKm / 20; lngOffset <= radiusKm / 20; lngOffset += step) {
      points.push({
        lat: center[0] + latOffset,
        lng: center[1] + lngOffset
      });
    }
  }

  return points;
};

// ================= COMPONENT =================
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

  const [cityWeather, setCityWeather] = useState(null);

  // ================= CITY WEATHER (NEW WINDY-LIKE PANEL) =================
  useEffect(() => {
    const fetchCityWeather = async () => {
      try {
        const res = await fetch(
          `https://api.openweathermap.org/data/2.5/weather?q=${cityInput}&appid=${WEATHER_API}&units=metric`
        );
        const data = await res.json();
        setCityWeather(data);
      } catch (e) {
        console.log(e);
      }
    };

    fetchCityWeather();
  }, [cityInput]);

  // ================= WEATHER GRID =================
  const generateZonesFromWeather = async () => {
    const points = generateGridPoints(center, radius);

    const newZones = [];

    for (let p of points.slice(0, 20)) {
      try {
        const res = await fetch(
          `https://api.openweathermap.org/data/2.5/weather?lat=${p.lat}&lon=${p.lng}&appid=${WEATHER_API}&units=metric`
        );

        const data = await res.json();

        const wind = data.wind?.speed || 0;
        const windDeg = data.wind?.deg || 0;
        const weatherMain = data.weather?.[0]?.main || "Default";

        let type = "safe";
        if (wind > 20 || weatherMain === "Rain") type = "danger";
        else if (wind > 10 || weatherMain === "Clouds") type = "caution";
        else type = "calm";

        newZones.push({
          id: Math.random(),
          ...p,
          type,
          windDeg,
          weather: {
            temp: data.main?.temp,
            wind,
            main: weatherMain,
            description: data.weather?.[0]?.description
          }
        });
      } catch (err) {
        console.log(err);
      }
    }

    setZones(newZones);
  };

  // ================= AUTO REFRESH =================
  useEffect(() => {
    generateZonesFromWeather();
    const interval = setInterval(generateZonesFromWeather, 240000);
    return () => clearInterval(interval);
  }, [center]);

  // ================= CITY SEARCH =================
  const updateCenter = async () => {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${cityInput}`
    );
    const data = await res.json();

    if (data[0]) {
      setCenter([parseFloat(data[0].lat), parseFloat(data[0].lon)]);
      setRadius(Number(radiusInput));
    }
  };

  // ================= FLIGHTS (UNCHANGED) =================
  const fetchFlights = async () => {
    const res = await fetch("/api/flights");
    const data = await res.json();

    const incoming =
      data.states?.map((p) => ({
        icao: p[0],
        callsign: p[1] || "N/A",
        lat: p[6],
        lng: p[5],
        altitude: p[7],
        velocity: p[9],
        heading: p[10]
      })) || [];

    setPlanes((prev) => {
      const updated = { ...prev };
      incoming.forEach((p) => {
        updated[p.icao] = {
          ...p,
          targetLat: p.lat,
          targetLng: p.lng
        };
      });
      return updated;
    });

    setPlaneTrails((prev) => {
      const updated = { ...prev };
      incoming.forEach((p) => {
        if (!updated[p.icao]) updated[p.icao] = [];
        updated[p.icao].push([p.lat, p.lng]);
        if (updated[p.icao].length > 25) updated[p.icao].shift();
      });
      return updated;
    });

    setLastUpdated(new Date().toLocaleTimeString());
  };

  // ================= SMOOTH MOVE =================
  useEffect(() => {
    const interval = setInterval(() => {
      setPlanes((prev) => {
        const updated = { ...prev };
        Object.values(updated).forEach((p) => {
          if (!p.targetLat) return;
          p.lat += (p.targetLat - p.lat) * 0.03;
          p.lng += (p.targetLng - p.lng) * 0.03;
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
    const interval = setInterval(fetchFlights, 80000);
    return () => clearInterval(interval);
  }, [startTracking]);

  // ================= UI =================
  return (
    <div style={{ display: "flex" }}>
      {/* SIDEBAR */}
      <div style={styles.sidebar}>
        <h2>✈ Windy Flight System</h2>

        {/* CITY WEATHER PANEL (NEW) */}
        {cityWeather && (
          <div style={styles.card}>
            <h3>🌍 {cityWeather.name}</h3>
            <p>Temp: {cityWeather.main?.temp}°C</p>
            <p>Wind: {cityWeather.wind?.speed} m/s</p>
            <p>{cityWeather.weather?.[0]?.description}</p>
          </div>
        )}

        <input value={cityInput} onChange={(e) => setCityInput(e.target.value)} />
        <input value={radiusInput} onChange={(e) => setRadiusInput(e.target.value)} />

        <button onClick={updateCenter} style={styles.btn}>Set City</button>
        <button onClick={() => setStartTracking(true)} style={styles.primary}>Start Tracking</button>
        <button onClick={generateZonesFromWeather} style={styles.btn}>Refresh Weather</button>

        <div style={styles.card}>
          <p>Planes: {Object.keys(planes).length}</p>
          <p>Updated: {lastUpdated}</p>
        </div>

        {/* LEGEND */}
        <div style={styles.card}>
          <p>🟢 Safe</p>
          <p>🟡 Caution</p>
          <p>🔴 Danger</p>
        </div>
      </div>

      {/* MAP */}
      <MapContainer center={center} zoom={6} style={{ height: "100vh", width: "100%" }}>
        <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />

        {/* WIND LAYER (FIXED VISIBILITY) */}
        <TileLayer
          url={`https://tile.openweathermap.org/map/wind_new/{z}/{x}/{y}.png?appid=${WEATHER_API}`}
          opacity={0.6}
        />

        {airports.map((a, i) => (
          <Marker key={i} position={a.coords} icon={airportIcon}>
            <Popup>{a.name}</Popup>
          </Marker>
        ))}

        {/* WEATHER ZONES */}
        {zones.map((z) => (
          <Marker
            key={z.id}
            position={[z.lat, z.lng]}
            icon={createZoneIcon(z.weather.main, z.type, z.windDeg)}
            eventHandlers={{
              click: () => {
                setSelectedZone(z);
                setSelectedPlane(null);
              }
            }}
          />
        ))}

        {/* PLANES (UNCHANGED) */}
        {Object.values(planes).map((p) => (
          <Marker
            key={p.icao}
            position={[p.lat, p.lng]}
            icon={planeIcon(p.heading)}
          />
        ))}

        {/* TRAILS */}
        {Object.entries(planeTrails).map(([icao, trail]) => (
          <Polyline key={icao} positions={trail} pathOptions={{ color: "cyan" }} />
        ))}

        <Circle center={center} radius={radius * 1000} pathOptions={{ color: "#00c7ff" }} />
      </MapContainer>
    </div>
  );
}

// ================= STYLES =================
const styles = {
  sidebar: {
    width: 320,
    background: "#0f172a",
    color: "white",
    padding: 15
  },
  card: {
    background: "#1e293b",
    padding: 10,
    marginTop: 10,
    borderRadius: 10
  },
  btn: {
    width: "100%",
    marginTop: 10,
    padding: 10,
    background: "#334155",
    color: "white",
    border: "none"
  },
  primary: {
    width: "100%",
    marginTop: 10,
    padding: 10,
    background: "#2563eb",
    color: "white",
    border: "none"
  }
};
