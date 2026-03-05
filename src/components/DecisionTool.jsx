import React from "react";

export default function DecisionTool({ selectedRegion, setDecision }) {
  if (!selectedRegion) return null;

  return (
    <section style={{ padding: "20px", textAlign: "center" }}>
      <h3>Pilot Decision Tool</h3>
      <p>
        Based on current conditions in {selectedRegion.name}:
        <strong>
          {" "}
          {selectedRegion.humidity > 80
            ? "Do Not Fly"
            : selectedRegion.humidity > 60
            ? "Fly with Caution"
            : "Safe to Fly"}
        </strong>
      </p>
      <button
        onClick={() => alert("Simulate flight for this region")}
        style={{ padding: "10px 20px", marginTop: "10px" }}
      >
        Simulate Flight
      </button>
    </section>
  );
}