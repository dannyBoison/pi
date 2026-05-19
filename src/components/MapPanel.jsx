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

// ================= ROTATING PLANE ICON =================
const planeIcon = heading =>
  L.divIcon({
    html: `
      <img
        src="https://cdn-icons-png.flaticon.com/128/6221/6221851.png"
        style="
          width:30px;
          height:30px;
          transform:rotate(${heading || 0}deg);
        "
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

// ================= ZONE COLORS =================
const zoneColors = {
  danger: "#ff0000",
  caution: "#ff9900",
  safe: "#00ff88"
};

// ================= WEATHER ICON =================
const createZoneIcon = (weatherMain, zoneType, isSelected) => {
  const color = zoneColors[zoneType] || "#00ff88";
  const weatherUrl = weatherIconsUrls[weatherMain] || weatherIconsUrls.Default;

  return L.divIcon({
    html: `
      <div style="
        background:${color};
        border:${isSelected ? "3px solid yellow" : "2px solid white"};
        border-radius:50%;
        width:45px;
        height:45px;
        display:flex;
        align-items:center;
        justify-content:center;
        box-shadow:0 0 20px ${color};
        animation:pulse 2s infinite;
      ">
        <img src="${weatherUrl}" style="width:24px;height:24px;" />
      </div>

      <style>
        @keyframes pulse{
          0%{transform:scale(1);}
          50%{transform:scale(1.1);}
          100%{transform:scale(1);}
        }
      </style>
    `,
    className: ""
  });
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

  // ================= RANDOM WEATHER POINTS =================
  const generateRandomPoints = (count = 8) => {
    const points = [];

    for (let i = 0; i < count; i++) {
      const lat = center[0] + (Math.random() - 0.5) * (radius / 50);
      const lng = center[1] + (Math.random() - 0.5) * (radius / 50);

      points.push({ lat, lng });
    }

    return points;
  };

  // ================= WEATHER =================
  const generateZonesFromWeather = async () => {
    const randomPoints = generateRandomPoints(8);

    const newZones = [];

    for (let p of randomPoints) {
      try {
        const res = await fetch(
          `https://api.openweathermap.org/data/2.5/weather?lat=${p.lat}&lon=${p.lng}&appid=${WEATHER_API}&units=metric`
        );

        const data = await res.json();

        const wind = data.wind?.speed || 0;
        const windDeg = data.wind?.deg || 0;

        const temp = data.main?.temp || 0;

        const weatherMain = data.weather?.[0]?.main || "Default";

        let type = "safe";

        if (wind > 20 || weatherMain === "Rain") {
          type = "danger";
        } else if (wind > 10 || weatherMain === "Clouds") {
          type = "caution";
        }

        newZones.push({
          id: Math.random(),
          ...p,
          type,
          weather: {
            temp,
            wind,
            windDeg,
            description: data.weather?.[0]?.description,
            main: weatherMain
          }
        });
      } catch (err) {
        console.error("Weather fetch error:", err);
      }
    }

    setZones(newZones);
    setSelectedZone(null);
  };

  // ================= AUTO WEATHER REFRESH =================
  useEffect(() => {
    generateZonesFromWeather();

    const interval = setInterval(() => {
      generateZonesFromWeather();
    }, 300000);

    return () => clearInterval(interval);
  }, [center]);

  // ================= CITY SEARCH =================
  const updateCenter = async () => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${cityInput}`
      );

      const data = await res.json();

      if (data[0]) {
        setCenter([
          parseFloat(data[0].lat),
          parseFloat(data[0].lon)
        ]);

        setRadius(Number(radiusInput));
      } else {
        alert("City not found!");
      }
    } catch (err) {
      console.error(err);
      alert("Error fetching city coordinates");
    }
  };

  // ================= FETCH FLIGHTS =================
  const fetchFlights = async () => {
    try {
      const res = await fetch("/api/flights");

      const data = await res.json();

      const incoming =
        data.states
          ?.filter(p => p[5] && p[6])
          .map(p => ({
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
            updated[p.icao] = {
              ...p,
              targetLat: p.lat,
              targetLng: p.lng
            };
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

          if (updated[p.icao].length > 20) {
            updated[p.icao].shift();
          }
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

  // ================= FETCH LOOP =================
  useEffect(() => {
    if (!startTracking) return;

    fetchFlights();

    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        fetchFlights();
      }
    }, 90000);

    return () => clearInterval(interval);
  }, [startTracking]);

  return (
    <div style={{ display: "flex" }}>
      {/* SIDEBAR */}
      <div
        style={{
          width: "320px",
          background: "rgba(15,23,42,0.95)",
          color: "white",
          padding: "20px",
          backdropFilter: "blur(10px)",
          borderRight: "1px solid rgba(255,255,255,0.1)"
        }}
      >
        <h2>✈ Smart Flight System</h2>

        <div style={{ marginTop: 10 }}>
          <input
            type="text"
            value={cityInput}
            onChange={e => setCityInput(e.target.value)}
            placeholder="Enter city"
            style={{
              width: "60%",
              padding: 8,
              borderRadius: 6
            }}
          />

          <input
            type="number"
            value={radiusInput}
            onChange={e => setRadiusInput(e.target.value)}
            placeholder="Radius"
            style={{
              width: "35%",
              marginLeft: "5%",
              padding: 8,
              borderRadius: 6
            }}
          />

          <button
            onClick={updateCenter}
            style={{ ...btn, marginTop: 10 }}
          >
            Set City
          </button>
        </div>

        <button
          onClick={() => setStartTracking(true)}
          style={btnPrimary}
        >
          Start Tracking
        </button>

        <button
          onClick={generateZonesFromWeather}
          style={btn}
        >
          Generate Weather
        </button>

        <div style={card}>
          <p>Planes: {Object.keys(planes).length}</p>
          <p>Updated: {lastUpdated}</p>
        </div>

        {/* WEATHER DETAILS */}
        {selectedZone && selectedZone.weather && (
          <div style={card}>
            <h3>🌦 Weather Detail</h3>

            <p>
              <strong>Main:</strong>{" "}
              {selectedZone.weather.main}
            </p>

            <p>
              <strong>Description:</strong>{" "}
              {selectedZone.weather.description}
            </p>

            <p>
              <strong>Temperature:</strong>{" "}
              {selectedZone.weather.temp} °C
            </p>

            <p>
              <strong>Wind Speed:</strong>{" "}
              {selectedZone.weather.wind} m/s
            </p>

            <div
              style={{
                fontSize: "30px",
                transform: `rotate(${selectedZone.weather.windDeg}deg)`
              }}
            >
              ↑
            </div>

            <p>
              <strong>Zone Type:</strong>{" "}
              {selectedZone.type}
            </p>
          </div>
        )}

        {/* PLANE DETAILS */}
        {selectedPlane && (
          <div style={card}>
            <h3>✈ Plane Detail</h3>

            <p>
              <strong>Callsign:</strong>{" "}
              {selectedPlane.callsign}
            </p>

            <p>
              <strong>Altitude:</strong>{" "}
              {selectedPlane.altitude} m
            </p>

            <p>
              <strong>Speed:</strong>{" "}
              {selectedPlane.velocity} m/s
            </p>

            <p>
              <strong>Heading:</strong>{" "}
              {selectedPlane.heading}°
            </p>
          </div>
        )}
      </div>

      {/* MAP */}
      <MapContainer
        center={center}
        zoom={6}
        style={{
          height: "100vh",
          width: "100%"
        }}
      >
        {/* DARK MAP */}
        <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />

        {/* WIND OVERLAY */}
        <TileLayer
          url={`https://tile.openweathermap.org/map/wind_new/{z}/{x}/{y}.png?appid=${WEATHER_API}`}
          opacity={0.5}
        />

        {/* CLOUD OVERLAY */}
        <TileLayer
          url={`https://tile.openweathermap.org/map/clouds_new/{z}/{x}/{y}.png?appid=${WEATHER_API}`}
          opacity={0.4}
        />

        {/* RAIN OVERLAY */}
        <TileLayer
          url={`https://tile.openweathermap.org/map/precipitation_new/{z}/{x}/{y}.png?appid=${WEATHER_API}`}
          opacity={0.5}
        />

        {/* AIRPORTS */}
        {airports.map((a, i) => (
          <Marker
            key={i}
            position={a.coords}
            icon={airportIcon}
          >
            <Popup>{a.name}</Popup>
          </Marker>
        ))}

        {/* WEATHER */}
        {zones.map(z => (
          <Marker
            key={z.id}
            position={[z.lat, z.lng]}
            icon={createZoneIcon(
              z.weather.main,
              z.type,
              selectedZone?.id === z.id
            )}
            eventHandlers={{
              click: () => {
                setSelectedZone(z);
                setSelectedPlane(null);
              }
            }}
          >
            <Popup>
              <strong>{z.weather.main}</strong>

              <br />

              {z.weather.description}

              <br />

              Temp: {z.weather.temp} °C

              <br />

              Wind: {z.weather.wind} m/s
            </Popup>
          </Marker>
        ))}

        {/* PLANES */}
        {Object.values(planes).map(plane => (
          <Marker
            key={plane.icao}
            position={[plane.lat, plane.lng]}
            icon={planeIcon(plane.heading)}
            eventHandlers={{
              click: () => {
                setSelectedPlane(plane);
                setSelectedZone(null);
              }
            }}
          >
            <Popup>{plane.callsign}</Popup>
          </Marker>
        ))}

        {/* TRAILS */}
        {Object.entries(planeTrails).map(([icao, trail]) => (
          <Polyline
            key={icao}
            positions={trail}
            pathOptions={{
              color: "cyan",
              weight: 2
            }}
          />
        ))}

        {/* RADAR CIRCLE */}
        <Circle
          center={center}
          radius={radius * 1000}
          pathOptions={{
            color: "#00ffff",
            fillColor: "#00ffff",
            fillOpacity: 0.05
          }}
        />
      </MapContainer>
    </div>
  );
}

// ================= STYLES =================
const btn = {
  padding: 10,
  borderRadius: 8,
  border: "none",
  marginTop: 10,
  width: "100%",
  cursor: "pointer",
  background: "#334155",
  color: "white"
};

const btnPrimary = {
  ...btn,
  background: "#2563eb"
};

const card = {
  background: "rgba(30,41,59,0.8)",
  padding: 15,
  borderRadius: 12,
  marginTop: 15,
  backdropFilter: "blur(12px)",
  boxShadow: "0 0 20px rgba(0,0,0,0.3)"
};
