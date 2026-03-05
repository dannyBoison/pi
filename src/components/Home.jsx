import React from "react";

export default function Home() {
  return (
    <section style={{ padding: "50px", textAlign: "center" }}>
      <h2>Welcome Pilot</h2>
      <p>
        This system demonstrates how computer science can support pilots in
        making safe flight decisions using weather and terrain data.
      </p>
      <button style={{ padding: "10px 20px", marginTop: "20px" }}>
        Start Flight System
      </button>
    </section>
  );
}