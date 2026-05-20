import React, { useState, useEffect } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Circle,
  Polyline,
  useMap
} from "react-leaflet";

import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet-velocity";

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

const zoneColors = {
  danger: "red",
  caution: "orange",
  safe: "green"
};

// ================= ZONE ICON =================
const createZoneIcon = (weatherMain, zoneType, isSelected) => {
  const color = zoneColors[zoneType] || "green";
  const weatherUrl = weatherIconsUrls[weatherMain] || weatherIconsUrls.Default;

  return L.divIcon({
    html: `
      <div style="
        background-color:${color};
        border:${isSelected ? "3px solid yellow" : "2px solid white"};
        border-radius:50%;
        width:35px;
        height:35px;
        display:flex;
        align-items:center;
        justify-content:center;
      ">
        <img src="${weatherUrl}" style="width:20px;height:20px;" />
      </div>
    `,
    className: ""
  });
};

// ================= WIND LAYER (WINDY STYLE) =================
const WindLayer = () => {
  const map = useMap();

  useEffect(() => {
    let velocityLayer;

    fetch(
      "https://raw.githubusercontent.com/danwild/leaflet-velocity/master/demo/wind-global.json"
    )
      .then((res) => res.json())
      .then((data) => {
        velocityLayer = L.velocityLayer({
          data,
          displayValues: true,
          displayOptions: {
            velocityType: "Global Wind",
            position: "bottomleft",
            emptyString: "No wind data"
          },
          maxVelocity: 15,
          velocityScale: 0.01,
          particleAge: 90,
          lineWidth: 2,
          frameRate: 20,
          colorScale: ["#ffffff", "#a6f0ff", "#4dc3ff", "#1e90ff", "#0b3d91"]
        });

        velocityLayer.addTo(map);
      });

    return () => {
      if (velocityLayer) map.removeLayer(velocityLayer);
    };
  }, [map]);

  return null;
};

// ================= COMPONENT =================
export default function MapPanel() {
  const [zones, setZones] = useState([]);
  const [center, setCenter] = useState([5.6051, -0.1662]);
  const [radius, setRadius] = useState(150);

  const [planes, setPlanes] = useState({});
  const [planeTrails, setPlaneTrails] = useState({});

  const [selectedPlane, setSelectedPlane] = useState(null);
  const [selectedZone, setSelectedZone] = useState(null);

  const WEATHER_API = import.meta.env.VITE_WEATHER_API_KEY;

  const generateRandomPoints = (count = 8) => {
    const points = [];
    for (let i = 0; i < count; i++) {
      const lat = center[0] + (Math.random() - 0.5) * (radius / 50);
      const lng = center[1] + (Math.random() - 0.5) * (radius / 50);
      points.push({ lat, lng });
    }
    return points;
  };

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
    }

    setZones(newZones);
  };

  return (
    <div style={{ display: "flex" }}>
      {/* MAP */}
      <MapContainer center={center} zoom={6} style={{ height: "100vh", width: "100%" }}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

        {/* 🌬 WIND FLOW LAYER (NEW) */}
        <WindLayer />

        {/* AIRPORTS */}
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
            icon={createZoneIcon(z.weather.main, z.type, selectedZone?.id === z.id)}
            eventHandlers={{
              click: () => {
                setSelectedZone(z);
                setSelectedPlane(null);
              }
            }}
          >
            <Popup>
              <strong>{z.weather.main}</strong><br />
              {z.weather.description}<br />
              Wind: {z.weather.wind} m/s
            </Popup>
          </Marker>
        ))}

        {/* PLANES TRAILS */}
        {Object.entries(planeTrails).map(([icao, trail]) => (
          <Polyline key={icao} positions={trail} pathOptions={{ color: "cyan" }} />
        ))}

        <Circle center={center} radius={radius * 1000} />
      </MapContainer>
    </div>
  );
}
