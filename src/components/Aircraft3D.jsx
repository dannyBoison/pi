import React, { useRef, useState, useEffect, Suspense } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Sky, useGLTF } from "@react-three/drei";
import * as THREE from "three";

// ================= GLOBAL BULLETS =================
const bullets = [];

// ================= PLANE =================
function Plane({ speed, setStats }) {
  const planeRef = useRef();
  const { camera, scene } = useThree();
  const { scene: model } = useGLTF("/models/product.glb");

  const velocity = useRef(new THREE.Vector3(0, 0, -speed));
  const rotation = useRef({ pitch: 0, yaw: 0, roll: 0 });
  const keys = useRef({});

  // KEYBOARD
  useEffect(() => {
    const down = (e) => {
      keys.current[e.key.toLowerCase()] = true;

      // SHOOT
      if (e.code === "Space") shoot();
    };

    const up = (e) => (keys.current[e.key.toLowerCase()] = false);

    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);

    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  const shoot = () => {
    if (!planeRef.current) return;

    const bullet = {
      position: planeRef.current.position.clone(),
      direction: new THREE.Vector3(0, 0, -1).applyEuler(
        planeRef.current.rotation
      ),
    };

    bullets.push(bullet);
  };

  useFrame(() => {
    const p = planeRef.current;
    if (!p) return;

    // CONTROLS
    if (keys.current["w"]) rotation.current.pitch += 0.008;
    if (keys.current["s"]) rotation.current.pitch -= 0.008;
    if (keys.current["a"]) rotation.current.yaw += 0.01;
    if (keys.current["d"]) rotation.current.yaw -= 0.01;

    // ROLL
    if (keys.current["a"]) rotation.current.roll = 0.4;
    else if (keys.current["d"]) rotation.current.roll = -0.4;
    else rotation.current.roll *= 0.92;

    p.rotation.x = rotation.current.pitch;
    p.rotation.y = rotation.current.yaw;
    p.rotation.z = rotation.current.roll;

    const forward = new THREE.Vector3(0, 0, -1).applyEuler(p.rotation);

    let currentSpeed = speed;
    if (keys.current["shift"]) currentSpeed *= 2.5;

    forward.multiplyScalar(currentSpeed);
    velocity.current.lerp(forward, 0.03);

    // PHYSICS
    velocity.current.y += rotation.current.pitch * 0.02;
    velocity.current.y -= 0.0015;

    p.position.add(velocity.current);

    if (p.position.y < 3) p.position.y = 3;

    // WORLD MOVE
    scene.children.forEach((obj) => {
      if (obj.name === "world") {
        obj.position.z += currentSpeed * 25;
      }
    });

    // CAMERA
    const camOffset = new THREE.Vector3(0, 4, 12);
    camOffset.applyEuler(p.rotation);

    camera.position.lerp(p.position.clone().add(camOffset), 0.08);
    camera.lookAt(p.position);

    // UPDATE HUD
    setStats({
      speed: currentSpeed.toFixed(2),
      altitude: p.position.y.toFixed(1),
    });
  });

  return (
    <primitive ref={planeRef} object={model} scale={1.5} position={[0, 5, 0]} />
  );
}

// ================= BULLETS =================
function Bullets({ targets, setHits }) {
  const groupRef = useRef();

  useFrame(() => {
    bullets.forEach((b, i) => {
      b.position.add(b.direction.clone().multiplyScalar(2));

      // HIT DETECTION
      targets.current.forEach((t, ti) => {
        if (b.position.distanceTo(t.position) < 2) {
          targets.current.splice(ti, 1);
          bullets.splice(i, 1);
          setHits((h) => h + 1);
        }
      });
    });

    if (groupRef.current) {
      groupRef.current.children.forEach((mesh, i) => {
        if (bullets[i]) {
          mesh.position.copy(bullets[i].position);
        }
      });
    }
  });

  return (
    <group ref={groupRef}>
      {bullets.map((b, i) => (
        <mesh key={i} position={b.position}>
          <sphereGeometry args={[0.3, 8, 8]} />
          <meshStandardMaterial color="red" />
        </mesh>
      ))}
    </group>
  );
}

// ================= TARGETS =================
function Targets({ targets }) {
  useEffect(() => {
    targets.current = [...Array(10)].map(() => ({
      position: new THREE.Vector3(
        Math.random() * 200 - 100,
        Math.random() * 50 + 10,
        Math.random() * -200
      ),
    }));
  }, []);

  return (
    <>
      {targets.current.map((t, i) => (
        <mesh key={i} position={t.position}>
          <boxGeometry args={[2, 2, 2]} />
          <meshStandardMaterial color="red" />
        </mesh>
      ))}
    </>
  );
}

// ================= CLOUDS =================
function Clouds() {
  const clouds = useRef(
    [...Array(80)].map(() => ({
      position: [
        Math.random() * 800 - 400,
        Math.random() * 60 + 20,
        Math.random() * 800 - 400,
      ],
    }))
  );

  return (
    <>
      {clouds.current.map((c, i) => (
        <mesh key={i} position={c.position}>
          <sphereGeometry args={[2, 16, 16]} />
          <meshStandardMaterial color="white" opacity={0.8} transparent />
        </mesh>
      ))}
    </>
  );
}

// ================= UI =================
function HUD({ stats, hits }) {
  return (
    <div
      style={{
        position: "absolute",
        top: 20,
        left: 20,
        color: "lime",
        fontFamily: "monospace",
        background: "rgba(0,0,0,0.5)",
        padding: 15,
        borderRadius: 10,
      }}
    >
      <h3>✈ HUD</h3>
      <p>Speed: {stats.speed}</p>
      <p>Altitude: {stats.altitude}</p>
      <p>Hits: {hits}</p>
      <p>SPACE → Shoot</p>
    </div>
  );
}

// ================= MAIN =================
export default function FlightSimulation() {
  const [speed] = useState(0.12);
  const [stats, setStats] = useState({ speed: 0, altitude: 0 });
  const [hits, setHits] = useState(0);

  const targets = useRef([]);

  return (
    <div style={{ width: "100vw", height: "100vh" }}>
      <HUD stats={stats} hits={hits} />

      <Canvas shadows camera={{ position: [0, 5, 12] }}>
        <color attach="background" args={["#87CEEB"]} />
        <fog attach="fog" args={["#87CEEB", 20, 600]} />

        <ambientLight intensity={0.3} />
        <directionalLight position={[100, 100, 50]} intensity={1.5} />

        <Sky sunPosition={[100, 20, 100]} />

        <group name="world">
          <Clouds />
          <Targets targets={targets} />
        </group>

        <Suspense fallback={null}>
          <Plane speed={speed} setStats={setStats} />
        </Suspense>

        <Bullets targets={targets} setHits={setHits} />
      </Canvas>
    </div>
  );
}
