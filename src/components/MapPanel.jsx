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


// ================= COMPONENT =================
export default function MapPanel() {

  const [center, setCenter] = useState([5.6051, -0.1662]);
  const [radius] = useState(150);

  const [planes, setPlanes] = useState({});
  const [lastUpdated, setLastUpdated] = useState(null);
  const [startTracking, setStartTracking] = useState(false);

  const [selectedPlane, setSelectedPlane] = useState(null);
  const [planeTrails, setPlaneTrails] = useState({});


  // ================= FETCH FLIGHTS =================
  const fetchFlights = async () => {
    try {
      const res = await fetch("/api/flights");
      const data = await res.json();

      const incoming = data.states
        ?.filter(p => p[5] && p[6])
        .map(p => ({
          icao: p[0],
          callsign: p[1],
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

      // trails
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
      console.error("Fetch error:", err);
    }
  };


  // ================= SMOOTH ANIMATION =================
  useEffect(() => {
    const interval = setInterval(() => {
      setPlanes(prev => {
        const updated = { ...prev };

        Object.values(updated).forEach(p => {
          if (!p.targetLat) return;

          // smooth interpolation
          p.lat += (p.targetLat - p.lat) * 0.02;
          p.lng += (p.targetLng - p.lng) * 0.02;
        });

        return { ...updated };
      });
    }, 50); // smooth (20fps)

    return () => clearInterval(interval);
  }, []);


  // ================= FETCH INTERVAL =================
  useEffect(() => {

    if (!startTracking) return;

    fetchFlights();

    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        fetchFlights();
      }
    }, 180000); // ✅ 3 minutes

    return () => clearInterval(interval);

  }, [startTracking]);


  return (
    <div style={{ display: "flex", fontFamily: "Segoe UI, sans-serif" }}>

      {/* ================= SIDEBAR ================= */}
      <div style={{
        width: "320px",
        background: "#0f172a",
        color: "white",
        padding: "25px"
      }}>

        <h2>✈ Smart Flight System</h2>

        <button onClick={() => setStartTracking(true)} style={btnPrimary}>
          Start Tracking
        </button>

        <div style={card}>
          <p>✈ Planes: {Object.keys(planes).length}</p>
          <p>⏱ Updated: {lastUpdated}</p>
        </div>

        {selectedPlane && (
          <div style={card}>
            <h3>Aircraft</h3>
            <p>{selectedPlane.callsign}</p>
            <p>Altitude: {selectedPlane.altitude}</p>
            <p>Speed: {selectedPlane.velocity}</p>
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

        {/* ================= PLANES ================= */}
        {Object.values(planes).map((plane, i) => (
          <Marker
            key={plane.icao}
            position={[plane.lat, plane.lng]}
            icon={planeIcon}
            eventHandlers={{
              click: () => setSelectedPlane(plane)
            }}
          >
            <Popup>{plane.callsign}</Popup>
          </Marker>
        ))}

        {/* ================= TRAILS ================= */}
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


// ================= STYLES =================
const btnPrimary = {
  padding: 10,
  borderRadius: 6,
  border: "none",
  background: "#2563eb",
  color: "white",
  fontWeight: "bold",
  cursor: "pointer"
};

const card = {
  background: "#1e293b",
  padding: 15,
  borderRadius: 8,
  marginTop: 10
};
