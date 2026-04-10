import React, { useRef, useState, useEffect, Suspense } from "react";
import { Canvas, useFrame, useThree, useLoader } from "@react-three/fiber";
import { Sky, useGLTF } from "@react-three/drei";
import * as THREE from "three";

// ================= TILE =================
function Tile({ url, position, size }) {
  const texture = useLoader(THREE.TextureLoader, url);

  texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;

  return (
    <mesh position={position} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[size, size]} />
      <meshStandardMaterial map={texture} />
    </mesh>
  );
}

// ================= GROUND (INFINITE SYSTEM) =================
function Ground({ planeRef, center }) {
  const zoom = 13;
  const tileSize = 150;

  const tilesRef = useRef([]);

  const latLonToTile = (lat, lon) => {
    const x = ((lon + 180) / 360) * Math.pow(2, zoom);
    const y =
      ((1 -
        Math.log(
          Math.tan((lat * Math.PI) / 180) +
          1 / Math.cos((lat * Math.PI) / 180)
        ) /
          Math.PI) /
        2) *
      Math.pow(2, zoom);
    return { x, y };
  };

  const tileToLatLon = (x, y) => {
    const n = Math.PI - (2 * Math.PI * y) / Math.pow(2, zoom);
    return {
      lat: (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n))),
      lon: (x / Math.pow(2, zoom)) * 360 - 180,
    };
  };

  const [tiles, setTiles] = useState([]);

  // 🔥 INITIAL GRID
  useEffect(() => {
    if (!center) return;

    const { x, y } = latLonToTile(center.lat, center.lon);

    const grid = [];

    for (let i = -3; i <= 3; i++) {
      for (let j = -3; j <= 3; j++) {
        const tx = Math.floor(x + i);
        const ty = Math.floor(y + j);

        grid.push({
          tx,
          ty,
          position: [i * tileSize, 0, j * tileSize],
        });
      }
    }

    tilesRef.current = grid;
    setTiles(grid);
  }, [center]);

  // 🔥 FOLLOW PLANE (INFINITE EFFECT)
  useFrame(() => {
    if (!planeRef.current) return;

    const px = planeRef.current.position.x;
    const pz = planeRef.current.position.z;

    setTiles((prev) =>
      prev.map((tile) => {
        let [x, y, z] = tile.position;

        // wrap tiles (infinite illusion)
        if (x + px > tileSize * 3) x -= tileSize * 7;
        if (x + px < -tileSize * 3) x += tileSize * 7;

        if (z + pz > tileSize * 3) z -= tileSize * 7;
        if (z + pz < -tileSize * 3) z += tileSize * 7;

        return {
          ...tile,
          position: [x, 0, z],
        };
      })
    );
  });

  return (
    <>
      {tiles.map((tile, i) => (
        <Tile
          key={i}
          url={`https://tile.openstreetmap.org/${zoom}/${tile.tx}/${tile.ty}.png`}
          position={tile.position}
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

    if (!city) return;

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

      {/* SEARCH UI */}
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
            placeholder="Search city (e.g Accra, Kumasi)"
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
