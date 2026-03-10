import React, { useState, useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, Circle } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Airports
const airports = [
  { name: "Accra Intl Airport", coords: [5.6051, -0.1662] },
  { name: "Tamale Airport", coords: [9.5573, -0.8631] },
  { name: "Takoradi Airport", coords: [4.8962, -1.7554] },
  { name: "Kumasi Airport", coords: [6.7148, -1.567] }
];

// Airport icon
const airportIcon = L.icon({
  iconUrl: "https://cdn-icons-png.flaticon.com/512/684/684908.png",
  iconSize: [30, 30]
});

// Plane icon
const planeIconUrl = "https://cdn-icons-png.flaticon.com/512/747/747310.png";
const planeIcon = L.icon({
  iconUrl: planeIconUrl,
  iconSize: [35, 35],
  iconAnchor: [17, 17]
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
const zoneColors = { danger: "red", caution: "yellow", safe: "green" };

// Weather zone icon
const createZoneIcon = (weatherMain, zoneType) => {
  const color = zoneColors[zoneType] || "green";
  const weatherUrl = weatherIconsUrls[weatherMain] || weatherIconsUrls.Default;
  return L.divIcon({
    html: `
      <div style="
        background-color:${color};
        border: 2px solid #fff;
        border-radius:50%;
        width:35px;
        height:35px;
        display:flex;
        align-items:center;
        justify-content:center;
        box-shadow:0 0 5px rgba(0,0,0,0.5);
        transition: transform 0.5s;
      ">
        <img src="${weatherUrl}" style="width:20px;height:20px;" />
      </div>`,
    className: ""
  });
};

export default function MapPanel() {
  const [zones, setZones] = useState([]);
  const [center, setCenter] = useState([5.6051, -0.1662]); // Accra
  const [radius, setRadius] = useState(150);
  const [city, setCity] = useState("");
  const [cityName, setCityName] = useState("");
  const [loading, setLoading] = useState(false);
  const [livePlanes, setLivePlanes] = useState([]);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [startTracking, setStartTracking] = useState(false);
  const [selectedPlane, setSelectedPlane] = useState(null);
  const [selectedZone, setSelectedZone] = useState(null);

  const API_KEY = import.meta.env.VITE_WEATHER_API_KEY;
  const planeRef = useRef([]);

  // Generate random points for zones
  const generateRandomPoints = (count = 8) => {
    const points = [];
    for (let i = 0; i < count; i++) {
      const lat = center[0] + (Math.random() - 0.5) * (radius / 50);
      const lng = center[1] + (Math.random() - 0.5) * (radius / 50);
      points.push({ lat, lng });
    }
    return points;
  };

  // Search city
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
      console.error(err);
      setLoading(false);
    }
  };

  // Generate weather zones
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
            description: data.weather?.[0]?.description || "",
            main: weatherMain
          }
        });
      } catch (err) {
        console.error(err);
      }
    }
    setZones(newZones);
  };

  // Fetch flights with retry
  const fetchFlightsWithRetry = async (retryDelay = 2000) => {
    let data = null;
    while (!data) {
      try {
        const res = await fetch(
          "https://opensky-network.org/api/states/all?lamin=-35&lomin=-20&lamax=37&lomax=52"
        );
        if (!res.ok) {
          await new Promise(r => setTimeout(r, retryDelay));
          continue;
        }
        data = await res.json();
        if (!data.states) {
          data = null;
          await new Promise(r => setTimeout(r, retryDelay));
        }
      } catch (err) {
        await new Promise(r => setTimeout(r, retryDelay));
      }
    }
    return data;
  };

  // Live aircraft tracking + smooth movement
  useEffect(() => {
    if (!startTracking) return;
    const fetchLiveAircraft = async () => {
      try {
        const data = await fetchFlightsWithRetry(1000);
        if (!data || !data.states) return;
        const planes = data.states
          .filter(p => p[5] && p[6])
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
        planeRef.current = planes;
        setLastUpdated(new Date().toLocaleTimeString());
      } catch (err) {
        console.error(err);
      }
    };
    fetchLiveAircraft();
    const interval = setInterval(() => {
      fetchLiveAircraft();
      // simulate smooth movement
      setLivePlanes(prev =>
        prev.map(p => ({
          ...p,
          lat: p.lat + (Math.random() - 0.5) * 0.01,
          lng: p.lng + (Math.random() - 0.5) * 0.01
        }))
      );
    }, 5000);
    return () => clearInterval(interval);
  }, [startTracking]);

  return (
    <div style={{ display: "flex", fontFamily: "sans-serif" }}>

      {/* Sidebar */}
      <div style={{ width: "30%", padding: 20, background: "#1a1a1a", color: "white", height: "100vh", overflowY: "auto", boxShadow: "2px 0 10px rgba(0,0,0,0.5)" }}>
        <h2>✈️ Smart Flight System V10</h2>

        {/* City & Controls */}
        <input type="text" placeholder="Enter city (eg. Accra)" value={city} onChange={e => setCity(e.target.value)} style={{ width: "100%", padding: 10, marginBottom: 10, borderRadius: 6, border: "none" }} />
        <button onClick={searchCityAndSetCenter} style={{ width: "100%", padding: 10, borderRadius: 6, background: "#007bff", color: "white", marginBottom: 15 }}>📍 Set Center</button>
        <p>Selected City: <strong>{cityName || "Accra"}</strong></p>

        <label>Radius (km)</label>
        <input type="number" value={radius} onChange={e => setRadius(+e.target.value)} style={{ width: "100%", padding: 10, marginBottom: 15, borderRadius: 6, border: "none" }} />

        <button onClick={generateZonesFromWeather} style={{ width: "100%", padding: 10, borderRadius: 6, background: "#ffc107", color: "black", marginBottom: 15 }}>
          {loading ? "Scanning Weather..." : "🌦 Generate Zones"}
        </button>

        <button onClick={() => setStartTracking(true)} style={{ width: "100%", padding: 12, borderRadius: 6, background: "#28a745", color: "white", fontWeight: "bold" }}>
          ✈️ Start Live Aircraft Tracking
        </button>

        <p style={{ marginTop: 10 }}>✈️ Live Aircraft: {livePlanes.length}</p>
        {lastUpdated && <p>🕒 Last Updated: {lastUpdated}</p>}

        {/* Selected plane details */}
        {selectedPlane && (
          <div style={{ marginTop: 20, border: "1px solid #333", borderRadius: 6, padding: 10 }}>
            <h3>✈️ {selectedPlane.callsign || "Unknown"}</h3>
            <img src={planeIconUrl} alt="plane" style={{ width: 50 }} />
            <p>Altitude: {selectedPlane.altitude ?? "N/A"} m</p>
            <p>Speed: {selectedPlane.velocity ?? "N/A"} m/s</p>
            <p>Heading: {selectedPlane.heading ?? "N/A"}°</p>
          </div>
        )}

        {/* Selected weather zone */}
        {selectedZone && (
          <div style={{ marginTop: 20, border: "1px solid #333", borderRadius: 6, padding: 10 }}>
            <h3>🌦 Weather Zone ({selectedZone.type.toUpperCase()})</h3>
            <img src={weatherIconsUrls[selectedZone.weather.main] || weatherIconsUrls.Default} alt="weather" style={{ width: 40 }} />
            <p>{selectedZone.weather.description}</p>
            <p>Temp: {selectedZone.weather.temp}°C</p>
            <p>Wind: {selectedZone.weather.wind} m/s</p>
          </div>
        )}

      </div>

      {/* Map */}
      <MapContainer center={center} zoom={6} style={{ height: "100vh", width: "70%" }}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"} />

        {/* Airports */}
        {airports.map((a, i) => (
          <Marker key={i} position={a.coords} icon={airportIcon} />
        ))}

        {/* Weather Zones */}
        {zones.map((z, i) => (
          <Marker
            key={i}
            position={[z.lat, z.lng]}
            icon={createZoneIcon(z.weather.main, z.type)}
            eventHandlers={{ click: () => setSelectedZone(z) }}
          />
        ))}

        {/* Live Planes */}
        {livePlanes.map((plane, i) => (
          <Marker
            key={i}
            position={[plane.lat, plane.lng]}
            icon={planeIcon}
            rotationAngle={plane.heading || 0}
            eventHandlers={{ click: () => setSelectedPlane(plane) }}
          />
        ))}

        {/* Radius */}
        <Circle center={center} radius={radius * 1000} pathOptions={{ color: "#007bff", fillOpacity: 0.1 }} />
      </MapContainer>
    </div>
  );
}
