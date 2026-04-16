import React, { useState } from "react";
import Header from "./components/Header";
import Home from "./components/Home";

import MapPanel from "./components/MapPanel";
import FlightStatus from "./components/FlightStatus";
import DecisionTool from "./components/DecisionTool";
import Aircraft3D from "./components/Aircraft3D";

function App() {
  const [selectedRegion, setSelectedRegion] = useState(null);
  const [decision, setDecision] = useState("");

  return (
    <div>
      <Header />
      <Home />
      <MapPanel
        setSelectedRegion={setSelectedRegion}
        setDecision={setDecision}
      />
      <FlightStatus selectedRegion={selectedRegion} />
      <DecisionTool selectedRegion={selectedRegion} setDecision={setDecision} />
      <Aircraft3D selectedRegion={selectedRegion} decision={decision} />
    </div>
  );
}

export default App;
