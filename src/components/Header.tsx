import React from "react";

export default function Header() {
  return (
    <header style={{ padding: "20px", background: "#1a202c", color: "white" }}>
      <h1>Pilot Weather & Terrain Safety Advisor</h1>
      <nav>
        <button>Home</button>
        <button>Map</button>
        <button>Flight Status</button>
        <button>Training</button>
      </nav>
    </header>
  );
}