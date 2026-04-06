import React, { useRef, useState, useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Sky } from "@react-three/drei";
import * as THREE from "three";

// ================= PLANE =================
function Plane({ speed }) {
  const planeRef = useRef();
  const { camera } = useThree();

  const velocity = useRef(new THREE.Vector3(0, 0, -speed));
  const rotation = useRef({ pitch: 0, yaw: 0, roll: 0 });

  const keys = useRef({});

  // ================= KEYBOARD =================
  useEffect(() => {
    const down = (e) => (keys.current[e.key.toLowerCase()] = true);
    const up = (e) => (keys.current[e.key.toLowerCase()] = false);

    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);

    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  // ================= GAME LOOP =================
  useFrame(() => {
    const p = planeRef.current;
    if (!p) return;

    // ===== CONTROLS =====
    if (keys.current["w"]) rotation.current.pitch += 0.01;
    if (keys.current["s"]) rotation.current.pitch -= 0.01;
    if (keys.current["a"]) rotation.current.yaw += 0.01;
    if (keys.current["d"]) rotation.current.yaw -= 0.01;

    // roll effect (visual)
    if (keys.current["a"]) rotation.current.roll = 0.3;
    else if (keys.current["d"]) rotation.current.roll = -0.3;
    else rotation.current.roll *= 0.9;

    // ===== APPLY ROTATION =====
    p.rotation.x = rotation.current.pitch;
    p.rotation.y = rotation.current.yaw;
    p.rotation.z = rotation.current.roll;

    // ===== FORWARD MOVEMENT =====
    const forward = new THREE.Vector3(0, 0, -1);
    forward.applyEuler(p.rotation);
    forward.multiplyScalar(speed);

    velocity.current.lerp(forward, 0.05);
    p.position.add(velocity.current);

    // ===== CAMERA FOLLOW =====
    const camOffset = new THREE.Vector3(0, 2, 6);
    camOffset.applyEuler(p.rotation);

    camera.position.copy(p.position.clone().add(camOffset));
    camera.lookAt(p.position);
  });

  return (
    <mesh ref={planeRef}>
      {/* SIMPLE PLANE SHAPE */}
      <boxGeometry args={[1, 0.3, 2]} />
      <meshStandardMaterial color="orange" />
    </mesh>
  );
}

// ================= GROUND =================
function Ground() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -2, 0]}>
      <planeGeometry args={[500, 500]} />
      <meshStandardMaterial color="#1e293b" />
    </mesh>
  );
}

// ================= CLOUDS =================
function Clouds() {
  const cloudRef = useRef();

  useFrame(() => {
    if (cloudRef.current) {
      cloudRef.current.rotation.y += 0.0005;
    }
  });

  return (
    <group ref={cloudRef}>
      {[...Array(20)].map((_, i) => (
        <mesh
          key={i}
          position={[
            Math.random() * 200 - 100,
            Math.random() * 20 + 5,
            Math.random() * 200 - 100
          ]}
        >
          <sphereGeometry args={[1.5, 8, 8]} />
          <meshStandardMaterial color="white" />
        </mesh>
      ))}
    </group>
  );
}

// ================= UI CONTROLS =================
function ControlsUI({ speed, setSpeed }) {
  return (
    <div
      style={{
        position: "absolute",
        top: 20,
        left: 20,
        background: "#0f172a",
        color: "white",
        padding: 15,
        borderRadius: 10
      }}
    >
      <h3>✈ Flight Controls</h3>
      <p>W/S → Pitch</p>
      <p>A/D → Turn</p>

      <div style={{ marginTop: 10 }}>
        <label>Speed</label>
        <input
          type="range"
          min="0.05"
          max="0.5"
          step="0.01"
          value={speed}
          onChange={(e) => setSpeed(parseFloat(e.target.value))}
        />
      </div>
    </div>
  );
}

// ================= MAIN =================
export default function FlightSimulation() {
  const [speed, setSpeed] = useState(0.1);

  return (
    <>
      <ControlsUI speed={speed} setSpeed={setSpeed} />

      <Canvas camera={{ position: [0, 2, 6], fov: 75 }}>
        {/* LIGHTING */}
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 5]} intensity={1} />

        {/* SKY */}
        <Sky sunPosition={[100, 20, 100]} />

        {/* WORLD */}
        <Ground />
        <Clouds />

        {/* PLANE */}
        <Plane speed={speed} />
      </Canvas>
    </>
  );
}
