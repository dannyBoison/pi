import React, { useRef, useState, useEffect, Suspense, forwardRef } from "react";
import { Canvas, useFrame, useThree, useLoader } from "@react-three/fiber";
import { Sky, useGLTF } from "@react-three/drei";
import * as THREE from "three";

// ================= GLOBAL =================
const bullets = [];
const missiles = [];
const explosions = [];

// ================= TILE HELPER =================
function getTileUrl(lat, lon, zoom = 10) {
  const x = Math.floor(((lon + 180) / 360) * Math.pow(2, zoom));
  const y = Math.floor(
    ((1 -
      Math.log(
        Math.tan((lat * Math.PI) / 180) +
        1 / Math.cos((lat * Math.PI) / 180)
      ) /
      Math.PI) / 2) * Math.pow(2, zoom)
  );

  return `https://tile.openstreetmap.org/${zoom}/${x}/${y}.png`;
}

// ================= GROUND =================
function Ground({ planeRef, mapUrl }) {
  const texture = useLoader(THREE.TextureLoader, mapUrl);

  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(20, 20);

  const groundRef = useRef();

  useFrame(() => {
    if (planeRef?.current && groundRef.current) {
      groundRef.current.position.x = planeRef.current.position.x;
      groundRef.current.position.z = planeRef.current.position.z;
    }
  });

  return (
    <mesh ref={groundRef} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[4000, 4000]} />
      <meshStandardMaterial map={texture} />
    </mesh>
  );
}

// ================= PLANE =================
const Plane = forwardRef(({ speed, setStats }, planeRef) => {
  const { camera } = useThree();
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
});

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
  const planeRef = useRef();

  const [city, setCity] = useState("");
  const [mapUrl, setMapUrl] = useState(
    "https://tile.openstreetmap.org/6/33/22.png"
  );

  const handleSearch = async (e) => {
    e.preventDefault();

    if (!city) return;

    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${city}`
    );
    const data = await res.json();

    if (data.length === 0) {
      alert("City not found");
      return;
    }

    const lat = parseFloat(data[0].lat);
    const lon = parseFloat(data[0].lon);

    setMapUrl(getTileUrl(lat, lon, 10));
  };

  return (
    <div style={{ width: "100vw", height: "100vh" }}>

      {/* 🔍 SEARCH UI */}
      <div style={{
        position: "absolute",
        top: 20,
        left: 20,
        zIndex: 10,
        background: "#000000aa",
        padding: 15,
        borderRadius: 8,
        color: "white"
      }}>
        <form onSubmit={handleSearch}>
          <input
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="Enter city (e.g Kumasi)"
            style={{ padding: 8, borderRadius: 5 }}
          />
        </form>

        <p>Speed: {stats.speed}</p>
        <p>Altitude: {stats.altitude}</p>
      </div>

      <Canvas shadows camera={{ position: [0, 2, 6] }}>
        <color attach="background" args={["#87CEEB"]} />
        <fog attach="fog" args={["#87CEEB", 10, 300]} />

        <ambientLight intensity={0.6} />
        <directionalLight position={[100, 100, 50]} intensity={2} />

        <Sky sunPosition={[100, 20, 100]} />

        <group name="world">
          <Ground planeRef={planeRef} mapUrl={mapUrl} />
          <Clouds />
        </group>

        <Suspense fallback={null}>
          <Plane speed={0.12} setStats={setStats} ref={planeRef} />
        </Suspense>
      </Canvas>
    </div>
  );
}
