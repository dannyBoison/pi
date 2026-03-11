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
  iconUrl: "https://cdn-icons-png.flaticon.com/128/10844/10844777.png",
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
  caution: "yellow",
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
        box-shadow:0 0 5px rgba(0,0,0,0.5);
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
  const [radius, setRadius] = useState(150);

  const [city, setCity] = useState("");
  const [cityName, setCityName] = useState("");
  const [loading, setLoading] = useState(false);

  const [livePlanes, setLivePlanes] = useState([]);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [startTracking, setStartTracking] = useState(false);

  const [selectedPlane, setSelectedPlane] = useState(null);
  const [selectedZone, setSelectedZone] = useState(null);

  const [planeTrails, setPlaneTrails] = useState({});

  // ================= API KEYS =================
  const WEATHER_API = import.meta.env.VITE_WEATHER_API_KEY;

  // >>>>> ADD YOUR AVIATIONSTACK KEY HERE
  const AVIATION_API = import.meta.env.VITE_AVIATIONSTACK_API_KEY;



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

    if (!city) return alert("Enter a city name");

    try {

      setLoading(true);

      const res = await fetch(
        `https://api.openweathermap.org/geo/1.0/direct?q=${city}&limit=1&appid=${WEATHER_API}`
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



  // ================= WEATHER ZONES =================
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



  // ================= OPENSKY FLIGHTS =================
  const fetchFlights = async () => {

    const res = await fetch(
      "https://opensky-network.org/api/states/all"
    );

    const data = await res.json();

    const planes = data.states
      .filter(p => p[5] && p[6])
      .slice(0, 200)
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

    // ======= TRACK TRAILS =======
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



  // ================= AVIATIONSTACK FETCH =================
  // CALL THIS WHEN PLANE CLICKED
  const fetchFlightRoute = async (callsign) => {

    if (!AVIATION_API) return;

    try {

      const res = await fetch(
        `http://api.aviationstack.com/v1/flights?access_key=${AVIATION_API}&flight_iata=${callsign}`
      );

      const data = await res.json();

      if (data.data && data.data.length > 0) {

        const flight = data.data[0];

        setSelectedPlane(prev => ({
          ...prev,
          departure: flight.departure?.airport,
          arrival: flight.arrival?.airport,
          airline: flight.airline?.name
        }));
      }

    } catch (err) {
      console.error(err);
    }
  };



  return (

    <div style={{ display: "flex", fontFamily: "sans-serif" }}>



      {/* ================= SIDEBAR ================= */}
      <div style={{
        width: "30%",
        padding: 20,
        background: "#1a1a1a",
        color: "white",
        height: "100vh",
        overflowY: "auto"
      }}>

        <h2>✈ Smart Flight System</h2>


        <input
          placeholder="Enter city"
          value={city}
          onChange={(e) => setCity(e.target.value)}
          style={{ width: "100%", padding: 10 }}
        />

        <button onClick={searchCityAndSetCenter}>
          Set Center
        </button>

        <button onClick={generateZonesFromWeather}>
          Generate Weather
        </button>

        <button onClick={() => setStartTracking(true)}>
          Start Tracking
        </button>


        <p>Planes: {livePlanes.length}</p>
        <p>Updated: {lastUpdated}</p>



        {/* ======== SELECTED DETAILS ======== */}

        {selectedPlane && (

          <div style={{
            background: "#2a2a2a",
            padding: 15,
            borderRadius: 8,
            marginTop: 20
          }}>

            <h3>✈ Aircraft</h3>

            <p><b>Callsign:</b> {selectedPlane.callsign}</p>
            <p><b>Altitude:</b> {selectedPlane.altitude}</p>
            <p><b>Speed:</b> {selectedPlane.velocity}</p>
            <p><b>Heading:</b> {selectedPlane.heading}</p>

            <p><b>From:</b> {selectedPlane.departure || "Unknown"}</p>
            <p><b>To:</b> {selectedPlane.arrival || "Unknown"}</p>

            <p><b>Airline:</b> {selectedPlane.airline || "Unknown"}</p>

          </div>
        )}



        {selectedZone && (

          <div style={{
            background: "#2a2a2a",
            padding: 15,
            borderRadius: 8,
            marginTop: 20
          }}>

            <h3>🌦 Weather Zone</h3>

            <p><b>Type:</b> {selectedZone.type}</p>
            <p><b>Description:</b> {selectedZone.weather.description}</p>
            <p><b>Temp:</b> {selectedZone.weather.temp}°C</p>
            <p><b>Wind:</b> {selectedZone.weather.wind} m/s</p>

          </div>
        )}

      </div>



      {/* ================= MAP ================= */}
      <MapContainer center={center} zoom={6} style={{ height: "100vh", width: "70%" }}>

        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />



        {/* AIRPORTS */}
        {airports.map((a, i) => (
          <Marker key={i} position={a.coords} icon={airportIcon}>
            <Popup>{a.name}</Popup>
          </Marker>
        ))}



        {/* WEATHER ZONES */}
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



        {/* PLANES */}
        {livePlanes.map((plane, i) => (

          <Marker
            key={i}
            position={[plane.lat, plane.lng]}
            icon={planeIcon}

            eventHandlers={{
              click: () => {

                setSelectedPlane(plane);
                setSelectedZone(null);

                fetchFlightRoute(plane.callsign);
              }
            }}

          >

            <Popup>
              {plane.callsign}
            </Popup>

          </Marker>

        ))}



        {/* TRAILS */}
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
          pathOptions={{ color: "#007bff", fillOpacity: 0.1 }}
        />

      </MapContainer>

    </div>
  );
}
