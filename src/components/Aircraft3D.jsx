import React, { useRef, useState, useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Sky } from "@react-three/drei";
import * as THREE from "three";

// ================= PLANE =================
function Plane({ speed }) {
  const planeRef = useRef();
  const { camera, scene } = useThree();

  const velocity = useRef(new THREE.Vector3(0, 0, -speed));
  const rotation = useRef({ pitch: 0, yaw: 0, roll: 0 });
  const keys = useRef({});

  // KEYBOARD
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

  useFrame(() => {
    const p = planeRef.current;
    if (!p) return;

    // CONTROLS
    if (keys.current["w"]) rotation.current.pitch += 0.01;
    if (keys.current["s"]) rotation.current.pitch -= 0.01;
    if (keys.current["a"]) rotation.current.yaw += 0.01;
    if (keys.current["d"]) rotation.current.yaw -= 0.01;

    // roll effect
    if (keys.current["a"]) rotation.current.roll = 0.3;
    else if (keys.current["d"]) rotation.current.roll = -0.3;
    else rotation.current.roll *= 0.9;

    // APPLY ROTATION
    p.rotation.x = rotation.current.pitch + Math.PI / 2;
    p.rotation.y = rotation.current.yaw;
    p.rotation.z = rotation.current.roll;

    // FORWARD
    const forward = new THREE.Vector3(0, 0, -1);
    forward.applyEuler(p.rotation);

    let currentSpeed = speed;
    if (keys.current["shift"]) currentSpeed *= 2;

    forward.multiplyScalar(currentSpeed);
    velocity.current.lerp(forward, 0.05);

    // GRAVITY
    velocity.current.y -= 0.002;

    // MOVE PLANE
    p.position.add(velocity.current);

    // GROUND LIMIT
    if (p.position.y < 2) p.position.y = 2;

    // MOVE WORLD (illusion of speed)
    scene.children.forEach((obj) => {
      if (obj.name === "world") {
        obj.position.z += currentSpeed * 20;
      }
    });

    // CAMERA FOLLOW (smooth)
    const camOffset = new THREE.Vector3(0, 3, 10);
    camOffset.applyEuler(p.rotation);

    const targetPos = p.position.clone().add(camOffset);
    camera.position.lerp(targetPos, 0.1);
    camera.lookAt(p.position);
  });

  return (
    <mesh ref={planeRef}>
      {/* Better plane shape */}
      <coneGeometry args={[0.5, 2, 16]} />
      <meshStandardMaterial color="orange" />
    </mesh>
  );
}

// ================= GROUND =================
function Ground() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -2, 0]}>
      <planeGeometry args={[2000, 2000]} />
      <meshStandardMaterial color="#1e293b" />
    </mesh>
  );
}

// ================= CLOUDS =================
function Clouds() {
  const groupRef = useRef();

  const clouds = useRef(
    [...Array(50)].map(() => ({
      position: [
        Math.random() * 500 - 250,
        Math.random() * 40 + 10,
        Math.random() * 500 - 250
      ]
    }))
  );

  useFrame(() => {
    if (groupRef.current) {
      groupRef.current.rotation.y += 0.0005;
    }
  });

  return (
    <group ref={groupRef}>
      {clouds.current.map((c, i) => (
        <mesh key={i} position={c.position}>
          <sphereGeometry args={[2, 12, 12]} />
          <meshStandardMaterial color="white" />
        </mesh>
      ))}
    </group>
  );
}

// ================= UI =================
function ControlsUI({ speed, setSpeed }) {
  return (
    <div
      style={{
        position: "absolute",
        top: 20,
        left: 20,
        background: "rgba(15, 23, 42, 0.8)",
        backdropFilter: "blur(10px)",
        color: "white",
        padding: 15,
        borderRadius: 12,
        fontFamily: "sans-serif",
        boxShadow: "0 10px 30px rgba(0,0,0,0.5)"
      }}
    >
      <h3>✈ Flight Controls</h3>
      <p>W/S → Pitch</p>
      <p>A/D → Turn</p>
      <p>Shift → Boost</p>

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
    <div style={{ width: "100vw", height: "100vh", position: "relative" }}>
      <ControlsUI speed={speed} setSpeed={setSpeed} />

      <Canvas camera={{ position: [0, 3, 10], fov: 75 }}>
        {/* FOG */}
        <fog attach="fog" args={["#87CEEB", 10, 300]} />

        {/* LIGHT */}
        <ambientLight intensity={0.3} />
        <directionalLight position={[50, 50, 25]} intensity={1.5} />

        {/* SKY */}
        <Sky sunPosition={[100, 20, 100]} />

        {/* WORLD */}
        <group name="world">
          <Ground />
          <Clouds />
        </group>

        {/* PLANE */}
        <Plane speed={speed} />
      </Canvas>
    </div>
  );
}
