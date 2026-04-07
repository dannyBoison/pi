import React, { useRef, useState, useEffect, Suspense } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Sky, useGLTF } from "@react-three/drei";
import * as THREE from "three";

// ================= PLANE (GLB MODEL) =================
function Plane({ speed }) {
  const planeRef = useRef();
  const { camera, scene } = useThree();

  const { scene: model } = useGLTF("/models/product.glb");

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
    if (keys.current["w"]) rotation.current.pitch += 0.008;
    if (keys.current["s"]) rotation.current.pitch -= 0.008;
    if (keys.current["a"]) rotation.current.yaw += 0.01;
    if (keys.current["d"]) rotation.current.yaw -= 0.01;

    // ROLL (smooth)
    if (keys.current["a"]) rotation.current.roll = 0.4;
    else if (keys.current["d"]) rotation.current.roll = -0.4;
    else rotation.current.roll *= 0.92;

    // APPLY ROTATION
    p.rotation.x = rotation.current.pitch;
    p.rotation.y = rotation.current.yaw;
    p.rotation.z = rotation.current.roll;

    // FORWARD VECTOR
    const forward = new THREE.Vector3(0, 0, -1);
    forward.applyEuler(p.rotation);

    let currentSpeed = speed;
    if (keys.current["shift"]) currentSpeed *= 2.5;

    // SMOOTH VELOCITY (feels like air resistance)
    forward.multiplyScalar(currentSpeed);
    velocity.current.lerp(forward, 0.03);

    // GRAVITY + LIFT (more realistic)
    velocity.current.y += rotation.current.pitch * 0.02; // lift
    velocity.current.y -= 0.0015; // gravity

    // APPLY MOVEMENT
    p.position.add(velocity.current);

    // GROUND LIMIT
    if (p.position.y < 3) p.position.y = 3;

    // WORLD MOVEMENT (infinite illusion)
    scene.children.forEach((obj) => {
      if (obj.name === "world") {
        obj.position.z += currentSpeed * 25;
      }
    });

    // CAMERA (cinematic follow)
    const camOffset = new THREE.Vector3(0, 4, 12);
    camOffset.applyEuler(p.rotation);

    const target = p.position.clone().add(camOffset);

    camera.position.lerp(target, 0.08);
    camera.lookAt(p.position);
  });

  return (
    <primitive
      ref={planeRef}
      object={model}
      scale={1.5}
      position={[0, 5, 0]}
    />
  );
}

// ================= GROUND =================
function Ground() {
  const ref = useRef();

  useFrame(() => {
    if (ref.current) {
      ref.current.position.z += 0.2;
      if (ref.current.position.z > 500) ref.current.position.z = 0;
    }
  });

  return (
    <mesh
      ref={ref}
      rotation={[-Math.PI / 2, 0, 0]}
      receiveShadow
    >
      <planeGeometry args={[3000, 3000]} />
      <meshStandardMaterial color="#0f172a" roughness={1} />
    </mesh>
  );
}

// ================= CLOUDS =================
function Clouds() {
  const groupRef = useRef();

  const clouds = useRef(
    [...Array(80)].map(() => ({
      position: [
        Math.random() * 800 - 400,
        Math.random() * 60 + 20,
        Math.random() * 800 - 400
      ],
      scale: Math.random() * 3 + 1
    }))
  );

  useFrame(() => {
    if (groupRef.current) {
      groupRef.current.rotation.y += 0.0003;
    }
  });

  return (
    <group ref={groupRef}>
      {clouds.current.map((c, i) => (
        <mesh key={i} position={c.position} scale={c.scale}>
          <sphereGeometry args={[2, 16, 16]} />
          <meshStandardMaterial color="white" transparent opacity={0.85} />
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
        background: "rgba(15,23,42,0.7)",
        backdropFilter: "blur(12px)",
        color: "white",
        padding: 15,
        borderRadius: 14,
        fontFamily: "sans-serif",
        boxShadow: "0 10px 40px rgba(0,0,0,0.6)"
      }}
    >
      <h3>✈ Flight HUD</h3>
      <p>W/S → Pitch</p>
      <p>A/D → Turn</p>
      <p>Shift → Boost</p>

      <div style={{ marginTop: 10 }}>
        <label>Speed</label>
        <input
          type="range"
          min="0.05"
          max="0.6"
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
  const [speed, setSpeed] = useState(0.12);

  return (
    <div style={{ width: "100vw", height: "100vh", position: "relative" }}>
      <ControlsUI speed={speed} setSpeed={setSpeed} />

      <Canvas
        shadows
        camera={{ position: [0, 5, 12], fov: 75 }}
      >
        {/* REALISTIC RENDERING */}
        <color attach="background" args={["#87CEEB"]} />
        <fog attach="fog" args={["#87CEEB", 20, 600]} />

        {/* LIGHTING */}
        <ambientLight intensity={0.25} />
        <directionalLight
          position={[100, 100, 50]}
          intensity={1.5}
          castShadow
        />

        {/* SKY */}
        <Sky sunPosition={[100, 20, 100]} turbidity={8} />

        {/* WORLD */}
        <group name="world">
          <Ground />
          <Clouds />
        </group>

        {/* PLANE */}
        <Suspense fallback={null}>
          <Plane speed={speed} />
        </Suspense>
      </Canvas>
    </div>
  );
}


And I’ll turn this into a full flight game project you can show in interviews or even monetize 💰
