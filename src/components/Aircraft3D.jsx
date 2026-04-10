import React, { useRef, useState, useEffect, Suspense } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Sky, useGLTF, useTexture } from "@react-three/drei";
import * as THREE from "three";

// ================= TILE =================
function Tile({ url, position, size }) {
  const texture = useTexture(url);

  return (
    <mesh position={position} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[size, size]} />
      <meshStandardMaterial map={texture} />
    </mesh>
  );
}

// ================= GROUND =================
function Ground({ planeRef, center }) {
  const zoom = 14;
  const tileSize = 120;

  const groupRef = useRef();
  const [tiles, setTiles] = useState([]);

  const latLonToTile = (lat, lon) => {
    const x = Math.floor(((lon + 180) / 360) * Math.pow(2, zoom));
    const y = Math.floor(
      ((1 -
        Math.log(
          Math.tan((lat * Math.PI) / 180) +
          1 / Math.cos((lat * Math.PI) / 180)
        ) /
        Math.PI) /
        2) *
        Math.pow(2, zoom)
    );
    return { x, y };
  };

  // 🔥 Load tiles when city changes
  useEffect(() => {
    const { x, y } = latLonToTile(center.lat, center.lon);

    const grid = [];
    for (let i = -3; i <= 3; i++) {
      for (let j = -3; j <= 3; j++) {
        grid.push({
          url: `https://tile.openstreetmap.org/${zoom}/${x + i}/${y + j}.png`,
          position: [i * tileSize, 0, j * tileSize],
        });
      }
    }

    setTiles(grid);
  }, [center]);

  // 🔥 Move ground instead of recreating tiles
  useFrame(() => {
    if (!planeRef.current || !groupRef.current) return;

    groupRef.current.position.x = -planeRef.current.position.x * 0.5;
    groupRef.current.position.z = -planeRef.current.position.z * 0.5;
  });

  return (
    <group ref={groupRef}>
      {tiles.map((tile, i) => (
        <Tile key={i} {...tile} size={tileSize} />
      ))}
    </group>
  );
}

// ================= PLANE =================
const Plane = React.forwardRef(({ speed, setStats }, planeRef) => {
  const { camera } = useThree();

  let model;
  try {
    model = useGLTF("/models/product.glb").scene;
  } catch {
    model = null;
  }

  const velocity = useRef(new THREE.Vector3(0, 0, -speed));
  const rotation = useRef({ pitch: 0, yaw: 0, roll: 0 });
  const keys = useRef({});

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

    if (keys.current["a"]) rotation.current.yaw += 0.01;
    if (keys.current["d"]) rotation.current.yaw -= 0.01;
    if (keys.current["w"]) rotation.current.pitch += 0.008;
    if (keys.current["s"]) rotation.current.pitch -= 0.008;

    p.rotation.set(
      rotation.current.pitch,
      rotation.current.yaw,
      rotation.current.roll
    );

    const forward = new THREE.Vector3(0, 0, -1).applyEuler(p.rotation);
    forward.multiplyScalar(speed);

    velocity.current.lerp(forward, 0.05);
    p.position.add(velocity.current);

    const camOffset = new THREE.Vector3(0, 2, 6).applyEuler(p.rotation);

    camera.position.lerp(p.position.clone().add(camOffset), 0.1);
    camera.lookAt(p.position);

    setStats({
      speed: speed.toFixed(2),
      altitude: p.position.y.toFixed(1),
    });
  });

  return (
    <group ref={planeRef} position={[0, 2.5, 0]}>
      {model ? (
        <primitive object={model} scale={2} />
      ) : (
        // 🔥 fallback plane if model fails
        <mesh>
          <coneGeometry args={[0.5, 2, 8]} />
          <meshStandardMaterial color="red" />
        </mesh>
      )}
    </group>
  );
});

// ================= MAIN =================
export default function FlightSimulation() {
  const [stats, setStats] = useState({ speed: 0, altitude: 0 });
  const planeRef = useRef();

  const [city, setCity] = useState("");
  const [center, setCenter] = useState({
    lat: 5.6037,
    lon: -0.1870,
  });

  const handleSearch = async (e) => {
    e.preventDefault();

    if (!city) return;

    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${city}`
      );
      const data = await res.json();

      if (!data.length) return alert("City not found");

      setCenter({
        lat: parseFloat(data[0].lat),
        lon: parseFloat(data[0].lon),
      });

      // reset plane
      if (planeRef.current) {
        planeRef.current.position.set(0, 2.5, 0);
      }

    } catch {
      alert("Search failed");
    }
  };

  return (
    <div style={{ width: "100vw", height: "100vh", position: "relative" }}>

      {/* 🔥 UI OVER CANVAS */}
      <div style={{
        position: "absolute",
        top: 20,
        left: 20,
        zIndex: 100,
        background: "#000000cc",
        padding: 15,
        borderRadius: 10,
        color: "white"
      }}>
        <form onSubmit={handleSearch}>
          <input
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="Search city (Accra, Kumasi, London)"
            style={{ padding: 8, marginRight: 5 }}
          />
          <button type="submit">Search</button>
        </form>

        <p>Speed: {stats.speed}</p>
        <p>Altitude: {stats.altitude}</p>
      </div>

      <Canvas camera={{ position: [0, 2, 6] }}>
        <color attach="background" args={["#87CEEB"]} />
        <ambientLight intensity={0.6} />
        <directionalLight position={[100, 100, 50]} intensity={2} />

        <Sky sunPosition={[100, 20, 100]} />

        <Ground planeRef={planeRef} center={center} />

        <Suspense fallback={null}>
          <Plane speed={0.12} setStats={setStats} ref={planeRef} />
        </Suspense>
      </Canvas>
    </div>
  );
}
