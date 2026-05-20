import React, { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;

// Airports
const airports = [
  { name: "Accra Intl Airport", coords: [ -0.1662, 5.6051 ] },
  { name: "Tamale Airport", coords: [ -0.8631, 9.5573 ] },
  { name: "Takoradi Airport", coords: [ -1.7554, 4.8962 ] },
  { name: "Kumasi Airport", coords: [ -1.567, 6.7148 ] }
];

export default function WindyStyleMap() {
  const mapRef = useRef(null);
  const mapContainer = useRef(null);

  const [center, setCenter] = useState([-0.1662, 5.6051]); // Accra
  const [windLayerVisible, setWindLayerVisible] = useState(true);

  // ================= INIT MAP =================
  useEffect(() => {
    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center,
      zoom: 5,
      projection: "globe"
    });

    mapRef.current = map;

    // 🌍 Smooth atmosphere like Windy
    map.on("style.load", () => {
      map.setFog({
        color: "rgb(10, 10, 25)",
        "high-color": "rgb(36, 92, 223)",
        "horizon-blend": 0.3
      });

      // ================= WEATHER HEATMAP LAYERS =================
      // Cloud layer
      map.addSource("clouds", {
        type: "raster",
        tiles: [
          `https://tile.openweathermap.org/map/clouds_new/{z}/{x}/{y}.png?appid=${import.meta.env.VITE_WEATHER_API_KEY}`
        ],
        tileSize: 256
      });

      map.addLayer({
        id: "cloud-layer",
        type: "raster",
        source: "clouds",
        paint: { "raster-opacity": 0.5 }
      });

      // Rain / precipitation
      map.addSource("precip", {
        type: "raster",
        tiles: [
          `https://tile.openweathermap.org/map/precipitation_new/{z}/{x}/{y}.png?appid=${import.meta.env.VITE_WEATHER_API_KEY}`
        ],
        tileSize: 256
      });

      map.addLayer({
        id: "rain-layer",
        type: "raster",
        source: "precip",
        paint: { "raster-opacity": 0.45 }
      });

      // Temperature gradient (heatmap feel)
      map.addSource("temp", {
        type: "raster",
        tiles: [
          `https://tile.openweathermap.org/map/temp_new/{z}/{x}/{y}.png?appid=${import.meta.env.VITE_WEATHER_API_KEY}`
        ],
        tileSize: 256
      });

      map.addLayer({
        id: "temp-layer",
        type: "raster",
        source: "temp",
        paint: { "raster-opacity": 0.35 }
      });

      // ================= WIND PARTICLES (Windy-style effect) =================
      // NOTE: This is a simplified GPU-like wind flow overlay
      map.addSource("wind", {
        type: "raster",
        tiles: [
          `https://tile.openweathermap.org/map/wind_new/{z}/{x}/{y}.png?appid=${import.meta.env.VITE_WEATHER_API_KEY}`
        ],
        tileSize: 256
      });

      map.addLayer({
        id: "wind-layer",
        type: "raster",
        source: "wind",
        paint: {
          "raster-opacity": 0.6,
          "raster-fade-duration": 0
        },
        layout: {
          visibility: "visible"
        }
      });

      // ================= AIRPORT MARKERS =================
      airports.forEach(a => {
        new mapboxgl.Marker({ color: "#00ffcc" })
          .setLngLat(a.coords)
          .setPopup(new mapboxgl.Popup().setText(a.name))
          .addTo(map);
      });
    });

    return () => map.remove();
  }, []);

  // ================= TOGGLE WIND =================
  const toggleWind = () => {
    const map = mapRef.current;
    if (!map) return;

    const visibility = map.getLayoutProperty("wind-layer", "visibility");
    map.setLayoutProperty(
      "wind-layer",
      "visibility",
      visibility === "visible" ? "none" : "visible"
    );

    setWindLayerVisible(v => !v);
  };

  // ================= UI =================
  return (
    <div style={{ display: "flex" }}>

      {/* SIDEBAR */}
      <div style={{
        width: 300,
        background: "#0f172a",
        color: "white",
        padding: 20
      }}>
        <h2>🌍 Windy Style Weather</h2>

        <button onClick={toggleWind} style={btnPrimary}>
          Toggle Wind Flow
        </button>

        <p style={{ marginTop: 10 }}>
          ✔ Heatmaps (Temp, Rain, Clouds)<br />
          ✔ Wind Direction Layer<br />
          ✔ Continuous Grid Tiles<br />
          ✔ GPU-style raster rendering
        </p>
      </div>

      {/* MAP */}
      <div ref={mapContainer} style={{ width: "100%", height: "100vh" }} />
    </div>
  );
}

// ================= STYLES =================
const btnPrimary = {
  padding: 10,
  marginTop: 10,
  borderRadius: 8,
  background: "#2563eb",
  color: "white",
  border: "none",
  cursor: "pointer"
};
