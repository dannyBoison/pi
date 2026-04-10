import React, { useRef, useState, useEffect, Suspense } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Sky, useGLTF, useTexture } from "@react-three/drei";
import * as THREE from "three";

// ================= TILE =================
function Tile({ url, position, size }) {
  const texture = useTexture(url);

  texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;

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

  const [tiles, setTiles] = useState([]);

  const latLonToTile = (lat, lon) => {
    const x = ((lon + 180) / 360) * Math.pow(2, zoom);
    const y =
      ((1 -
        Math.log(
          Math.tan((lat * Math.PI) / 180) +
          1 / Math.cos((lat * Math.PI) / 180)
        ) /
          Math.PI) /
      2 *
      Math.pow(2, zoom);
    return { x, y };
  };

  const baseTile = useRef({ x: 0, y: 0 });

  // 🔥 LOAD CITY MAP
  useEffect(() => {
    const { x, y } = latLonToTile(center.lat, center.lon);

    baseTile.current = {
      x: Math.floor(x),
      y: Math.floor(y),
    };

    const grid = [];

    for (let i = -2; i <= 2; i++) {
      for (let j = -2; j <= 2; j++) {
        grid.push({
          x: baseTile.current.x + i,
          y: baseTile.current.y + j,
          offset: [i * tileSize, 0, j * tileSize],
        });
      }
    }

    setTiles(grid);
  }, [center]);

  // 🔥 MOVE WITH PLANE (SMOOTH)
  useFrame(() => {
    if (!planeRef.current) return;

    const px = planeRef.current.position.x * 0.02;
    const pz = planeRef.current.position.z * 0.02;

    setTiles((prev) =>
      prev.map((tile) => ({
        ...tile,
        position: [
          tile.offset[0] - px,
          0,
          tile.offset[2] - pz,
        ],
      }))
    );
  });

  return (
    <>
      {tiles.map((tile, i) => (
        <Tile
          key={i}
          url={`https://tile.openstreetmap.org/${zoom}/${tile.x}/${tile.y}.png`}
          position={tile.position || tile.offset}
          size={tileSize}
        />
      ))}
    </>
  );
}

// ================= PLANE =================
const Plane = React.forwardRef(({ speed, setStats }, planeRef) => {
  const { camera } = useThree();
  const { scene: model } = useGLTF("/models/product.glb");

  const velocity = useRef(new THREE.Vector3(0, 0, -speed));
  const rotation = useRef({ pitch: 0, yaw: 0, roll: 0 });
  const keys = useRef({});

  useEffect(() => {
    if (!model) return;

    const box = new THREE.Box3().setFromObject(model);
    const size = new THREE.Vector3();
    box.getSize(size);

    const scale = 2 / Math.max(size.x, size.y, size.z);
    model.scale.set(scale, scale, scale);
    model.rotation.y = Math.PI;
  }, [model]);

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
      <primitive object={model} />
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
  };

  return (
    <div style={{ width: "100vw", height: "100vh" }}>

      {/* SEARCH */}
      <div style={{
        position: "absolute",
        top: 20,
        left: 20,
        zIndex: 10,
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
            style={{ padding: 8 }}
          />
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
