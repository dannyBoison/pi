import React, { useState, useEffect, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, useGLTF } from "@react-three/drei";


// ================= PLANE MODEL =================
function PlaneModel({ controls }) {

  const gltf = useGLTF("/models/product.glb");
  const planeRef = useRef();

  useFrame(() => {

    if (!planeRef.current) return;

    // always move forward
    planeRef.current.translateZ(-controls.speed);

    // turn left
    if (controls.left) {
      planeRef.current.rotation.y += 0.02;
      planeRef.current.rotation.z = 0.25;
    }

    // turn right
    if (controls.right) {
      planeRef.current.rotation.y -= 0.02;
      planeRef.current.rotation.z = -0.25;
    }

    // level wings
    if (!controls.left && !controls.right) {
      planeRef.current.rotation.z *= 0.9;
    }

    // climb
    if (controls.climb) {
      planeRef.current.position.y += 0.05;
      planeRef.current.rotation.x = -0.2;
    }

    // descend
    if (controls.descend) {
      planeRef.current.position.y -= 0.05;
      planeRef.current.rotation.x = 0.2;
    }

    if (!controls.climb && !controls.descend) {
      planeRef.current.rotation.x *= 0.9;
    }

  });

  return (
    <primitive
      ref={planeRef}
      object={gltf.scene}
      scale={0.5}
    />
  );
}



// ================= MAIN SIM =================
export default function Aircraft3D({ selectedRegion, decision }) {

  const [controlMode, setControlMode] = useState(false);
  const [speed, setSpeed] = useState(0.05);
  const [altitude, setAltitude] = useState(0);
  const [heading, setHeading] = useState(0);

  const controls = useRef({
    left: false,
    right: false,
    climb: false,
    descend: false,
    speed: 0.05
  });



  // ================= KEYBOARD =================
  useEffect(() => {

    const keyDown = (e) => {

      if (!controlMode) return;

      switch (e.key) {

        case "ArrowUp":
          controls.current.speed += 0.002;
          setSpeed(controls.current.speed);
          break;

        case "ArrowDown":
          controls.current.speed -= 0.002;
          if (controls.current.speed < 0.01) controls.current.speed = 0.01;
          setSpeed(controls.current.speed);
          break;

        case "ArrowLeft":
          controls.current.left = true;
          setHeading(h => h - 2);
          break;

        case "ArrowRight":
          controls.current.right = true;
          setHeading(h => h + 2);
          break;

        case "z":
          controls.current.climb = true;
          setAltitude(a => a + 100);
          break;

        case "x":
          controls.current.descend = true;
          setAltitude(a => a - 100);
          break;

        case "Escape":
          setControlMode(false);
          alert("Exited Simulation");
          break;

        default:
          break;
      }

    };



    const keyUp = (e) => {

      switch (e.key) {

        case "ArrowLeft":
          controls.current.left = false;
          break;

        case "ArrowRight":
          controls.current.right = false;
          break;

        case "z":
          controls.current.climb = false;
          break;

        case "x":
          controls.current.descend = false;
          break;

        default:
          break;
      }

    };



    window.addEventListener("keydown", keyDown);
    window.addEventListener("keyup", keyUp);

    return () => {
      window.removeEventListener("keydown", keyDown);
      window.removeEventListener("keyup", keyUp);
    };

  }, [controlMode]);



  // ================= ENTER SIM =================
  const startSimulation = () => {

    alert(
`FLIGHT CONTROL MODE

⬆ Arrow Up → Increase Speed
⬇ Arrow Down → Reduce Speed
⬅ Arrow Left → Turn Left
➡ Arrow Right → Turn Right
Z → Climb
X → Descend

ESC → Exit Simulation`
    );

    setControlMode(true);

  };



  return (

    <section
      style={{
        width: "90%",
        margin: "40px auto",
        fontFamily: "sans-serif"
      }}
    >


      {/* HUD */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-around",
          background: "#0f172a",
          color: "white",
          padding: "12px",
          borderRadius: "8px",
          marginBottom: "10px"
        }}
      >

        <div>Speed: {(speed * 1000).toFixed(0)} km/h</div>
        <div>Altitude: {altitude} ft</div>
        <div>Heading: {heading}°</div>

      </div>



      {/* 3D SIM */}
      <div
        onClick={startSimulation}
        style={{
          height: "500px",
          border: "3px solid #0ea5e9",
          borderRadius: "10px",
          cursor: "pointer"
        }}
      >

        <Canvas camera={{ position: [0, 2, 8] }}>

          <ambientLight intensity={0.6} />
          <directionalLight position={[10, 10, 5]} intensity={1} />

          <PlaneModel controls={controls.current} />

          {!controlMode && <OrbitControls />}

        </Canvas>

      </div>



      {/* REGION STATUS */}
      {selectedRegion && (
        <p style={{ textAlign: "center", marginTop: "10px" }}>
          Aircraft approaching {selectedRegion.name} → Status: {decision}
        </p>
      )}

    </section>
  );
}
