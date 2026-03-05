import React from "react";

export default function FlightStatus({ selectedRegion }) {
  if (!selectedRegion) return null;

  return (
    <section style={{ padding: "20px", textAlign: "center" }}>
      <h3>Flight Status for {selectedRegion.name}</h3>
      <p>Speed: 540 km/h</p>
      <p>Altitude: 12,000 ft</p>
      <p>Fuel: 75%</p>
      <p>Engine Status: Normal</p>
      <p>Humidity: {selectedRegion.humidity}%</p>
    </section>
  );
}