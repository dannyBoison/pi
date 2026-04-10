import React, { useRef, useState, useEffect, Suspense } from "react";
import { Canvas, useFrame, useThree, useLoader } from "@react-three/fiber";
import { Sky, useGLTF } from "@react-three/drei";
import * as THREE from "three";

// ================= TILE =================
function Tile({ url, position, size }) {
  const texture = useLoader(THREE.TextureLoader, url);

  return (
    <mesh position={position} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[size, size]} />
      <meshStandardMaterial map={texture} />
    </mesh>
  );
}

// ================= GROUND =================
function Ground({ center, resetKey }) {
  const zoom = 12;
  const tileSize = 120;

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

  useEffect(() => {
    if (!center) return;

    const { x, y } = latLonToTile(center.lat, center.lon);

    const grid = [];

    for (let i = -2; i <= 2; i++) {
      for (let j = -2; j <= 2; j++) {
        grid.push({
          url: `https://tile.openstreetmap.org/${zoom}/${x + i}/${y + j}.png`,
          position: [i * tileSize, 0, j * tileSize],
        });
      }
    }

    setTiles(grid);
  }, [center, resetKey]);

  return (
    <>
      {tiles.map((tile, i) => (
        <Tile key={i} {...tile} size={tileSize} />
      ))}
    </>
  );
}

// ================= PLANE =================
const Plane = React.forwardRef(({ speed, setStats, autopilot }, planeRef) => {
  const { camera } = useThree();
  const { scene: model } = useGLTF("/models/product.glb");

  const velocity = useRef(new THREE.Vector3(0, 0, -speed));
  const rotation = useRef({ pitch: 0, yaw: 0, roll: 0 });
  const keys = useRef({});
  const [cockpit, setCockpit] = useState(false);

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

    // 🔥 AUTOPILOT
    if (autopilot) {
      rotation.current.yaw += 0.002; // smooth turn
    } else {
      if (keys.current["w"]) rotation.current.pitch += 0.008;
      if (keys.current["s"]) rotation.current.pitch -= 0.008;
      if (keys.current["a"]) rotation.current.yaw += 0.01;
      if (keys.current["d"]) rotation.current.yaw -= 0.01;
    }

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
    velocity.current.lerp(forward, 0.05);

    velocity.current.y += rotation.current.pitch * 0.02;
    velocity.current.y -= 0.0015;

    p.position.add(velocity.current);
    if (p.position.y < 2) p.position.y = 2;

    const camOffset = cockpit
      ? new THREE.Vector3(0, 1.5, 3)
      : new THREE.Vector3(0, 2, 6);

    camOffset.applyEuler(p.rotation);

    camera.position.lerp(p.position.clone().add(camOffset), 0.1);
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
  return (
    <>
      {[...Array(20)].map((_, i) => (
        <mesh key={i} position={[
          Math.random() * 200 - 100,
          Math.random() * 40 + 10,
          Math.random() * 200 - 100,
        ]}>
          <sphereGeometry args={[4, 16, 16]} />
          <meshStandardMaterial transparent opacity={0.6} />
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
  const [locationName, setLocationName] = useState("Accra");
  const [resetKey, setResetKey] = useState(0);
  const [autopilot, setAutopilot] = useState(false);

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

    if (data.length === 0) return alert("City not found");

    setCenter({
      lat: parseFloat(data[0].lat),
      lon: parseFloat(data[0].lon),
    });

    setLocationName(city);

    // 🔥 RESET PLANE
    if (planeRef.current) {
      planeRef.current.position.set(0, 2.5, 0);
    }

    // 🔥 FORCE MAP RESET
    setResetKey((k) => k + 1);
  };

  return (
    <div style={{ width: "100vw", height: "100vh" }}>

      {/* UI */}
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
            placeholder="Enter city"
            style={{ padding: 8, borderRadius: 5 }}
          />
        </form>

        <p>📍 Location: {locationName}</p>
        <p>Speed: {stats.speed}</p>
        <p>Altitude: {stats.altitude}</p>

        <button onClick={() => setAutopilot(!autopilot)}>
          {autopilot ? "Disable Autopilot" : "Enable Autopilot"}
        </button>
      </div>

      <Canvas camera={{ position: [0, 2, 6] }}>
        <color attach="background" args={["#87CEEB"]} />
        <ambientLight intensity={0.6} />
        <directionalLight position={[100, 100, 50]} intensity={2} />

        <Sky sunPosition={[100, 20, 100]} />

        <Ground center={center} resetKey={resetKey} />
        <Clouds />

        <Suspense fallback={null}>
          <Plane
            speed={0.12}
            setStats={setStats}
            ref={planeRef}
            autopilot={autopilot}
          />
        </Suspense>
      </Canvas>
    </div>
  );
}
