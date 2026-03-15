import React, { useState, useEffect, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Sky, Cloud, useGLTF } from "@react-three/drei";


// ================= GROUND =================
function Ground() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -2, 0]}>
      <planeGeometry args={[500, 500]} />
      <meshStandardMaterial color="#1f7a1f" />
    </mesh>
  );
}



// ================= CAMERA FOLLOW =================
function FollowCamera({ target }) {

  const { camera } = useThree();

  useFrame(() => {

    if (!target.current) return;

    const plane = target.current;

    const offset = [0, 3, 8];

    camera.position.x = plane.position.x + offset[0];
    camera.position.y = plane.position.y + offset[1];
    camera.position.z = plane.position.z + offset[2];

    camera.lookAt(
      plane.position.x,
      plane.position.y,
      plane.position.z
    );

  });

  return null;
}



// ================= PLANE MODEL =================
function PlaneModel({ controls, planeRef }) {

  const gltf = useGLTF("/models/product.glb");

  useFrame(() => {

    if (!planeRef.current) return;

    const plane = planeRef.current;

    plane.translateZ(-controls.speed);

    // turn left
    if (controls.left) {
      plane.rotation.y += 0.02;
      plane.rotation.z = 0.25;
    }

    // turn right
    if (controls.right) {
      plane.rotation.y -= 0.02;
      plane.rotation.z = -0.25;
    }

    if (!controls.left && !controls.right) {
      plane.rotation.z *= 0.9;
    }

    // climb
    if (controls.climb) {
      plane.position.y += 0.05;
      plane.rotation.x = -0.2;
    }

    // descend
    if (controls.descend && plane.position.y > -1) {
      plane.position.y -= 0.05;
      plane.rotation.x = 0.2;
    }

    if (!controls.climb && !controls.descend) {
      plane.rotation.x *= 0.9;
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

  const planeRef = useRef();

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



  // sync speed
  useEffect(() => {
    controls.current.speed = speed;
  }, [speed]);



  // ================= KEYBOARD =================
  useEffect(() => {

    const keyDown = (e) => {

      if (!controlMode) return;

      switch (e.key) {

        case "ArrowUp":
          setSpeed(s => s + 0.002);
          break;

        case "ArrowDown":
          setSpeed(s => Math.max(0.01, s - 0.002));
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

      }

    };



    window.addEventListener("keydown", keyDown);
    window.addEventListener("keyup", keyUp);

    return () => {
      window.removeEventListener("keydown", keyDown);
      window.removeEventListener("keyup", keyUp);
    };

  }, [controlMode]);



  // ================= START SIM =================
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



      {/* SIMULATION */}
      <div
        onClick={startSimulation}
        style={{
          height: "520px",
          border: "3px solid #0ea5e9",
          borderRadius: "10px",
          cursor: "pointer"
        }}
      >

        <Canvas>

          <ambientLight intensity={0.6} />
          <directionalLight position={[10, 10, 5]} />

          <Sky sunPosition={[100, 20, 100]} />

          <Cloud position={[10, 20, -20]} speed={0.2} />
          <Cloud position={[-20, 25, -40]} speed={0.3} />

          <Ground />

          <PlaneModel
            controls={controls.current}
            planeRef={planeRef}
          />

          <FollowCamera target={planeRef} />

          {!controlMode && <OrbitControls />}

        </Canvas>

      </div>



      {/* STATUS */}
      {selectedRegion && (
        <p style={{ textAlign: "center", marginTop: "10px" }}>
          Aircraft approaching {selectedRegion.name} → Status: {decision}
        </p>
      )}

    </section>
  );
}
