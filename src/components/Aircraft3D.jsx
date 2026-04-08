import React, { useRef, useState, useEffect, Suspense } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Sky, useGLTF } from "@react-three/drei";
import * as THREE from "three";

// ================= GLOBAL =================
const bullets = [];
const missiles = [];
const explosions = [];

// ================= PLANE =================
function Plane({ speed, setStats }) {
  const planeRef = useRef();
  const { camera, scene } = useThree();
  const { scene: model } = useGLTF("/models/product.glb");

  const velocity = useRef(new THREE.Vector3(0, 0, -speed));
  const rotation = useRef({ pitch: 0, yaw: 0, roll: 0 });
  const keys = useRef({});
  const [cockpit, setCockpit] = useState(false);

  // 🔥 FIX MODEL SIZE (BIG)
  useEffect(() => {
    if (model) {
      model.traverse((c) => {
        if (c.isMesh) {
          c.castShadow = true;
          c.receiveShadow = true;
        }
      });

      model.scale.set(2.5, 2.5, 2.5); // 🔥 BIG FIX
      model.rotation.y = Math.PI;
    }
  }, [model]);

  // INPUTS
  useEffect(() => {
    const down = (e) => {
      keys.current[e.key.toLowerCase()] = true;
      if (e.code === "Space") shoot();
      if (e.key.toLowerCase() === "m") shootMissile();
      if (e.key.toLowerCase() === "c") setCockpit((v) => !v);
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
    bullets.push({
      position: planeRef.current.position.clone(),
      direction: new THREE.Vector3(0, 0, -1).applyEuler(planeRef.current.rotation),
    });
  };

  const shootMissile = () => {
    if (!planeRef.current) return;
    missiles.push({
      position: planeRef.current.position.clone(),
      direction: new THREE.Vector3(0, 0, -1).applyEuler(planeRef.current.rotation),
    });
  };

  useFrame(() => {
    const p = planeRef.current;
    if (!p) return;

    // CONTROLS
    if (keys.current["w"]) rotation.current.pitch += 0.008;
    if (keys.current["s"]) rotation.current.pitch -= 0.008;
    if (keys.current["a"]) rotation.current.yaw += 0.01;
    if (keys.current["d"]) rotation.current.yaw -= 0.01;

    rotation.current.roll =
      keys.current["a"]
        ? 0.4
        : keys.current["d"]
        ? -0.4
        : rotation.current.roll * 0.92;

    p.rotation.set(
      rotation.current.pitch,
      rotation.current.yaw,
      rotation.current.roll
    );

    const forward = new THREE.Vector3(0, 0, -1).applyEuler(p.rotation);

    let currentSpeed = speed;
    if (keys.current["shift"]) currentSpeed *= 2.5;

    forward.multiplyScalar(currentSpeed);
    velocity.current.lerp(forward, 0.03);

    velocity.current.y += rotation.current.pitch * 0.02;
    velocity.current.y -= 0.0015;

    p.position.add(velocity.current);
    if (p.position.y < 2) p.position.y = 2;

    // MOVE WORLD
    scene.children.forEach((obj) => {
      if (obj.name === "world") obj.position.z += currentSpeed * 25;
    });

    // 🔥 CAMERA FIX (CLOSER)
    const camOffset = cockpit
      ? new THREE.Vector3(0, 1.5, 3)
      : new THREE.Vector3(0, 2, 6);

    camOffset.applyEuler(p.rotation);

    camera.position.lerp(
      p.position.clone().add(camOffset),
      cockpit ? 0.2 : 0.1
    );

    camera.lookAt(p.position);

    setStats({
      speed: currentSpeed.toFixed(2),
      altitude: p.position.y.toFixed(1),
    });
  });

  return (
    <group ref={planeRef} position={[0, 2.5, 0]}>
      <primitive object={model} />
    </group>
  );
}

// ================= WEAPONS =================
function Weapons({ targets, setHits }) {
  useFrame(() => {
    bullets.forEach((b, i) => {
      b.position.add(b.direction.clone().multiplyScalar(3));

      targets.current.forEach((t, ti) => {
        if (b.position.distanceTo(t.position) < 3) {
          explosions.push({ position: t.position.clone(), life: 20 });
          targets.current.splice(ti, 1);
          bullets.splice(i, 1);
          setHits((h) => h + 1);
        }
      });
    });

    missiles.forEach((m, i) => {
      m.position.add(m.direction.clone().multiplyScalar(2));

      targets.current.forEach((t, ti) => {
        if (m.position.distanceTo(t.position) < 4) {
          explosions.push({ position: t.position.clone(), life: 40 });
          targets.current.splice(ti, 1);
          missiles.splice(i, 1);
          setHits((h) => h + 2);
        }
      });
    });
  });

  return (
    <>
      {bullets.map((b, i) => (
        <mesh key={"b" + i} position={b.position}>
          <sphereGeometry args={[0.6]} />
          <meshStandardMaterial color="red" />
        </mesh>
      ))}

      {missiles.map((m, i) => (
        <mesh key={"m" + i} position={m.position}>
          <coneGeometry args={[1, 3]} />
          <meshStandardMaterial color="yellow" />
        </mesh>
      ))}
    </>
  );
}

// ================= CLOUDS =================
function Clouds() {
  const clouds = useRef(
    [...Array(40)].map(() => ({
      position: [
        Math.random() * 200 - 100,
        Math.random() * 40 + 10,
        Math.random() * 200 - 100,
      ],
    }))
  );

  return (
    <>
      {clouds.current.map((c, i) => (
        <mesh key={i} position={c.position}>
          <sphereGeometry args={[4, 16, 16]} />
          <meshStandardMaterial transparent opacity={0.8} />
        </mesh>
      ))}
    </>
  );
}

// ================= MAIN =================
export default function FlightSimulation() {
  const [stats, setStats] = useState({ speed: 0, altitude: 0 });
  const [hits, setHits] = useState(0);
  const targets = useRef([]);

  return (
    <div style={{ width: "100vw", height: "100vh" }}>
      <Canvas shadows camera={{ position: [0, 2, 6] }}>
        <color attach="background" args={["#87CEEB"]} />
        <fog attach="fog" args={["#87CEEB", 10, 300]} />

        <ambientLight intensity={0.4} />
        <directionalLight position={[50, 50, 20]} intensity={1.5} />

        <Sky sunPosition={[100, 20, 100]} />

        <group name="world">
          <Clouds />
        </group>

        <Suspense fallback={null}>
          <Plane speed={0.12} setStats={setStats} />
        </Suspense>

        <Weapons targets={targets} setHits={setHits} />
      </Canvas>
    </div>
  );
}
