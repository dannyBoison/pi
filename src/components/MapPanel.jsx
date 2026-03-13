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
  Wind: "https://cdn-icons-png.flaticon.com/512/3081/3081637.png",
  Default: "https://cdn-icons-png.flaticon.com/512/252/252035.png"
};


// ================= ZONE COLORS =================
const zoneColors = {
  danger: "red",
  caution: "orange",
  safe: "green"
};


// ================= WEATHER ICON GENERATOR =================
const createZoneIcon = (weatherMain, zoneType) => {

  const color = zoneColors[zoneType] || "green";
  const weatherUrl = weatherIconsUrls[weatherMain] || weatherIconsUrls.Default;

  return L.divIcon({
    html: `
      <div style="
        background-color:${color};
        border:2px solid white;
        border-radius:50%;
        width:35px;
        height:35px;
        display:flex;
        align-items:center;
        justify-content:center;
        box-shadow:0 0 6px rgba(0,0,0,0.4);
      ">
        <img src="${weatherUrl}" style="width:20px;height:20px;" />
      </div>
    `,
    className: ""
  });
};



// ================= COMPONENT =================
export default function MapPanel() {

  const [zones, setZones] = useState([]);
  const [center, setCenter] = useState([5.6051, -0.1662]);
  const [radius] = useState(150);

  const [city, setCity] = useState("");
  const [cityName, setCityName] = useState("");

  const [livePlanes, setLivePlanes] = useState([]);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [startTracking, setStartTracking] = useState(false);

  const [selectedPlane, setSelectedPlane] = useState(null);
  const [selectedZone, setSelectedZone] = useState(null);

  const [planeTrails, setPlaneTrails] = useState({});

  const WEATHER_API = import.meta.env.VITE_WEATHER_API_KEY;



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



  // ================= CITY SEARCH =================
  const searchCityAndSetCenter = async () => {

    if (!city) return alert("Enter a city");

    const res = await fetch(
      `https://api.openweathermap.org/geo/1.0/direct?q=${city}&limit=1&appid=${WEATHER_API}`
    );

    const data = await res.json();

    if (!data.length) return alert("City not found");

    setCenter([data[0].lat, data[0].lon]);
    setCityName(data[0].name);
  };



  // ================= WEATHER ZONES =================
  const generateZonesFromWeather = async () => {

    const randomPoints = generateRandomPoints(8);
    const newZones = [];

    for (let p of randomPoints) {

      const res = await fetch(
        `https://api.openweathermap.org/data/2.5/weather?lat=${p.lat}&lon=${p.lng}&appid=${WEATHER_API}&units=metric`
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
          description: data.weather?.[0]?.description,
          main: weatherMain
        }
      });
    }

    setZones(newZones);
  };



  // ================= OPENSKY FLIGHTS (AFRICA FILTER) =================
  const fetchFlights = async () => {

    const res = await fetch(
      "https://opensky-network.org/api/states/all?lamin=-40&lomin=-20&lamax=38&lomax=55"
    );

    const data = await res.json();

    const planes = data.states
      ?.filter(p => p[5] && p[6])
      .map(p => ({
        icao: p[0],
        callsign: p[1],
        lng: p[5],
        lat: p[6],
        altitude: p[7],
        velocity: p[9],
        heading: p[10]
      })) || [];

    setLivePlanes(planes);


    // ======= TRAILS =======
    setPlaneTrails(prev => {

      const updated = { ...prev };

      planes.forEach(p => {

        if (!updated[p.icao]) updated[p.icao] = [];

        updated[p.icao].push([p.lat, p.lng]);

        if (updated[p.icao].length > 20) {
          updated[p.icao].shift();
        }

      });

      return updated;
    });

    setLastUpdated(new Date().toLocaleTimeString());
  };



  useEffect(() => {

    if (!startTracking) return;

    fetchFlights();

    const interval = setInterval(fetchFlights, 10000);

    return () => clearInterval(interval);

  }, [startTracking]);



  return (

    <div style={{ display: "flex", fontFamily: "Segoe UI, sans-serif" }}>



      {/* ================= SIDEBAR ================= */}
      <div style={{
        width: "320px",
        background: "#0f172a",
        color: "white",
        padding: "25px",
        display: "flex",
        flexDirection: "column",
        gap: "15px"
      }}>

        <h2 style={{ marginBottom: 10 }}>
          ✈ Smart Flight System
        </h2>

        <input
          placeholder="Search city..."
          value={city}
          onChange={(e) => setCity(e.target.value)}
          style={{
            padding: 10,
            borderRadius: 6,
            border: "none"
          }}
        />

        <button onClick={searchCityAndSetCenter} style={btn}>
          Set Center
        </button>

        <button onClick={generateZonesFromWeather} style={btn}>
          Generate Weather
        </button>

        <button onClick={() => setStartTracking(true)} style={btnPrimary}>
          Start Tracking
        </button>

        <div style={card}>
          <p>✈ Planes: {livePlanes.length}</p>
          <p>⏱ Updated: {lastUpdated}</p>
        
        </div>



        {selectedPlane && (

          <div style={card}>

            <h3>Aircraft</h3>

            <p>Callsign: {selectedPlane.callsign}</p>
            <p>Altitude: {selectedPlane.altitude}</p>
            <p>Speed: {selectedPlane.velocity}</p>
            <p>Heading: {selectedPlane.heading}</p>

          </div>

        )}



        {selectedZone && (

          <div style={card}>

            <h3>Weather Zone</h3>

            <p>Type: {selectedZone.type}</p>
            <p>{selectedZone.weather.description}</p>
            <p>Temp: {selectedZone.weather.temp}°C</p>
            <p>Wind: {selectedZone.weather.wind} m/s</p>

          </div>

        )}

      </div>



      {/* ================= MAP ================= */}
      <MapContainer center={center} zoom={6} style={{ height: "100vh", width: "100%" }}>

        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />


        {airports.map((a, i) => (
          <Marker key={i} position={a.coords} icon={airportIcon}>
            <Popup>{a.name}</Popup>
          </Marker>
        ))}


        {zones.map((z, i) => (

          <Marker
            key={i}
            position={[z.lat, z.lng]}
            icon={createZoneIcon(z.weather.main, z.type)}
            eventHandlers={{
              click: () => {
                setSelectedZone(z);
                setSelectedPlane(null);
              }
            }}
          />

        ))}


        {livePlanes.map((plane, i) => (

          <Marker
            key={i}
            position={[plane.lat, plane.lng]}
            icon={planeIcon}
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


        {Object.entries(planeTrails).map(([icao, trail]) => (

          <Polyline
            key={icao}
            positions={trail}
            pathOptions={{ color: "cyan", weight: 2 }}
          />

        ))}


        <Circle
          center={center}
          radius={radius * 1000}
          pathOptions={{ color: "#3b82f6", fillOpacity: 0.1 }}
        />

      </MapContainer>

    </div>
  );
}



// ================= UI STYLES =================
const btn = {
  padding: 10,
  borderRadius: 6,
  border: "none",
  cursor: "pointer"
};

const btnPrimary = {
  ...btn,
  background: "#2563eb",
  color: "white",
  fontWeight: "bold"
};

const card = {
  background: "#1e293b",
  padding: 15,
  borderRadius: 8,
  marginTop: 10
};
