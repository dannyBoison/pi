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

    camera.position.x = plane.position.x;
    camera.position.y = plane.position.y + 3;
    camera.position.z = plane.position.z + 8;

    camera.lookAt(
      plane.position.x,
      plane.position.y,
      plane.position.z
    );

  });

  return null;
}



// ================= PLANE =================
function PlaneModel({ controls, planeRef }) {

  const gltf = useGLTF("/models/product.glb");

  useFrame(() => {

    if (!planeRef.current) return;

    const plane = planeRef.current;

    plane.translateZ(-controls.speed);

    if (controls.left) {
      plane.rotation.y += 0.02;
      plane.rotation.z = 0.25;
    }

    if (controls.right) {
      plane.rotation.y -= 0.02;
      plane.rotation.z = -0.25;
    }

    if (!controls.left && !controls.right) {
      plane.rotation.z *= 0.9;
    }

    if (controls.climb) {
      plane.position.y += 0.05;
      plane.rotation.x = -0.2;
    }

    if (controls.descend && plane.position.y > -1) {
      plane.position.y -= 0.05;
      plane.rotation.x = 0.2;
    }

    if (!controls.climb && !controls.descend) {
      plane.rotation.x *= 0.9;
    }

  });

  return <primitive ref={planeRef} object={gltf.scene} scale={0.5} />;
}



// ================= MAIN SIM =================
export default function Aircraft3D({ selectedRegion, decision }) {

  const planeRef = useRef();

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



  useEffect(() => {
    controls.current.speed = speed;
  }, [speed]);



  // ================= CONTROL FUNCTIONS =================

  const turnLeft = () => {
    controls.current.left = true;
    setHeading(h => h - 5);
  };

  const stopLeft = () => {
    controls.current.left = false;
  };

  const turnRight = () => {
    controls.current.right = true;
    setHeading(h => h + 5);
  };

  const stopRight = () => {
    controls.current.right = false;
  };

  const climb = () => {
    controls.current.climb = true;
    setAltitude(a => a + 100);
  };

  const stopClimb = () => {
    controls.current.climb = false;
  };

  const descend = () => {
    controls.current.descend = true;
    setAltitude(a => a - 100);
  };

  const stopDescend = () => {
    controls.current.descend = false;
  };



  return (

    <section
      style={{
        width: "95%",
        margin: "20px auto",
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
          borderRadius: "8px"
        }}
      >

        <div>Speed: {(speed * 1000).toFixed(0)} km/h</div>
        <div>Altitude: {altitude} ft</div>
        <div>Heading: {heading}°</div>

      </div>



      {/* SIMULATION */}
      <div style={{ height: "520px", marginTop: "10px" }}>

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

          <OrbitControls />

        </Canvas>

      </div>



      {/* CONTROL PANEL */}
      <div
        style={{
          marginTop: "15px",
          padding: "15px",
          background: "#111827",
          borderRadius: "10px",
          color: "white"
        }}
      >

        <h3>Flight Control Panel</h3>

        <div style={{ marginBottom: "10px" }}>
          Throttle
          <input
            type="range"
            min="0.01"
            max="0.2"
            step="0.005"
            value={speed}
            onChange={(e) => setSpeed(Number(e.target.value))}
            style={{ width: "100%" }}
          />
        </div>

        <div style={{ display: "flex", gap: "10px" }}>

          <button
            onMouseDown={turnLeft}
            onMouseUp={stopLeft}
          >
            Turn Left
          </button>

          <button
            onMouseDown={turnRight}
            onMouseUp={stopRight}
          >
            Turn Right
          </button>

          <button
            onMouseDown={climb}
            onMouseUp={stopClimb}
          >
            Climb
          </button>

          <button
            onMouseDown={descend}
            onMouseUp={stopDescend}
          >
            Descend
          </button>

        </div>

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
