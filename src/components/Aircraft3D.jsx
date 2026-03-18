import React, { useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, useGLTF } from "@react-three/drei";


// ================= PLANE MODEL ===============
function PlaneModel({ heading, pitch }) {

const gltf = useGLTF("/models/product.glb");

return (
<primitive
object={gltf.scene}
scale={0.5}
rotation={[pitch, heading, 0]}
/>
);
}



// ================= MAIN SIMULATOR =================
export default function Aircraft3D({ selectedRegion, decision }) {

const [throttle, setThrottle] = useState(40);
const [altitude, setAltitude] = useState(12000);
const [heading, setHeading] = useState(0);
const [pitch, setPitch] = useState(0);



return (
<section
style={{
width: "90%",
margin: "40px auto",
fontFamily: "sans-serif"
}}
>

{/* ================= HUD ================= */}
<div
style={{
background: "#0f172a",
color: "white",
padding: "15px",
borderRadius: "10px",
marginBottom: "20px",
display: "flex",
justifyContent: "space-around"
}}
>

<div>
<h4>Throttle</h4>
<p>{throttle}%</p>
</div>

<div>
<h4>Altitude</h4>
<p>{altitude} ft</p>
</div>

<div>
<h4>Heading</h4>
<p>{heading}°</p>
</div>

<div>
<h4>Pitch</h4>
<p>{pitch.toFixed(2)}</p>
</div>

</div>



{/* ================= 3D VIEW ================= */}
<div style={{ height: "420px", width: "100%" }}>

<Canvas camera={{ position: [0, 2, 6] }}>

<ambientLight intensity={0.5} />
<directionalLight position={[10, 10, 5]} intensity={1} />

<PlaneModel heading={heading} pitch={pitch} />

<OrbitControls />

</Canvas>

</div>



{/* ================= FLIGHT CONTROLS ================= */}
<div
style={{
marginTop: "25px",
background: "#e5e7eb",
padding: "20px",
borderRadius: "10px"
}}
>

<h3>Flight Controls</h3>

{/* Throttle */}
<label>Throttle</label>
<input
type="range"
min="0"
max="100"
value={throttle}
onChange={(e) => setThrottle(Number(e.target.value))}
style={{ width: "100%" }}
/>



{/* Altitude */}
<label>Altitude</label>
<input
type="range"
min="1000"
max="40000"
step="500"
value={altitude}
onChange={(e) => setAltitude(Number(e.target.value))}
style={{ width: "100%" }}
/>



{/* Heading */}
<label>Heading</label>
<input
type="range"
min="0"
max="360"
value={heading}
onChange={(e) => setHeading(Number(e.target.value))}
style={{ width: "100%" }}
/>



{/* Pitch */}
<label>Pitch</label>
<input
type="range"
min="-0.5"
max="0.5"
step="0.01"
value={pitch}
onChange={(e) => setPitch(Number(e.target.value))}
style={{ width: "100%" }}
/>

</div>



{/* ================= REGION STATUS ================= */}
{selectedRegion && (

<div
style={{
marginTop: "20px",
textAlign: "center",
background: "#1e293b",
color: "white",
padding: "15px",
borderRadius: "8px"
}}
>

Aircraft approaching <b>{selectedRegion.name}</b>

<br />

Status: <b>{decision}</b>

</div>

)}

</section>
);
}
