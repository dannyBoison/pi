import React, { useRef, useState, useEffect, Suspense } from "react";
import { Canvas, useFrame, useThree, useLoader } from "@react-three/fiber";
import { Sky, useGLTF } from "@react-three/drei";
import * as THREE from "three";

// ================= GLOBAL =================
const bullets = [];
const missiles = [];
const explosions = [];

// ================= GROUND MAP =================
function Ground() {
  const texture = useLoader(
    THREE.TextureLoader,
    "https://threejsfundamentals.org/threejs/resources/images/checker.png"
  );

  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(100, 100); // 🔥 VERY IMPORTANT

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
      <planeGeometry args={[5000, 5000]} /> {/* 🔥 BIGGER */}
      <meshStandardMaterial map={texture} />
    </mesh>
  );
}

// ================= PLANE =================
function Plane({ speed, setStats }) {
  const planeRef = useRef();
  const { camera, scene } = useThree();
  const { scene: model } = useGLTF("/models/product.glb");

  const velocity = useRef(new THREE.Vector3(0, 0, -speed));
  const rotation = useRef({ pitch: 0, yaw: 0, roll: 0 });
  const keys = useRef({});
  const [cockpit, setCockpit] = useState(false);

  useEffect(() => {
    if (model) {
      const box = new THREE.Box3().setFromObject(model);
      const size = new THREE.Vector3();
      box.getSize(size);

      const maxDim = Math.max(size.x, size.y, size.z);
      const scale = 2.0 / maxDim;

      model.scale.set(scale, scale, scale);

      model.traverse((c) => {
        if (c.isMesh) {
          c.castShadow = true;
          c.receiveShadow = true;
        }
      });

      model.rotation.y = Math.PI;
    }
  }, [model]);

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

  return (
    <div style={{ width: "100vw", height: "100vh" }}>
      <Canvas shadows camera={{ position: [0, 2, 6] }}>
        <color attach="background" args={["#87CEEB"]} />
        <fog attach="fog" args={["#87CEEB", 10, 300]} />

        <ambientLight intensity={0.4} />
        <directionalLight position={[50, 50, 20]} intensity={1.5} />

        <Sky sunPosition={[100, 20, 100]} />

        <group name="world">
          <Ground />
          <Clouds />
        </group>

        <Suspense fallback={null}>
          <Plane speed={0.12} setStats={setStats} />
        </Suspense>
      </Canvas>
    </div>
  );
}
