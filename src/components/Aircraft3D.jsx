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

// ================= MINIMAP =================
function MiniMap({ plane, heading }) {
  return (
    <div style={{
      position: "absolute",
      bottom: 20,
      left: 20,
      width: 160,
      height: 160,
      background: "#000000cc",
      borderRadius: 10,
      zIndex: 200,
      overflow: "hidden"
    }}>
      <div style={{
        position: "absolute",
        width: "100%",
        height: "100%",
        transform: `rotate(${-heading}rad)`,
        transition: "transform 0.1s linear"
      }}>
        {/* grid */}
        <div style={{
          position: "absolute",
          width: "100%",
          height: "100%",
          display: "grid",
          gridTemplateColumns: "repeat(5, 1fr)",
          gridTemplateRows: "repeat(5, 1fr)",
          opacity: 0.3
        }}>
          {Array.from({ length: 25 }).map((_, i) => (
            <div key={i} style={{ border: "1px solid white" }} />
          ))}
        </div>

        {/* plane dot */}
        <div style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          width: 10,
          height: 10,
          background: "red",
          borderRadius: "50%",
          transform: "translate(-50%, -50%)"
        }} />
      </div>
    </div>
  );
}

// ================= GROUND (INFINITE WORLD) =================
function Ground({ planeRef, center }) {
  const zoom = 14;
  const tileSize = 120;

  const groupRef = useRef();

  const tilesRef = useRef(new Map()); // key = "x_z"
  const lastCenter = useRef({ x: 0, y: 0 });

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

  const createTile = (x, y) => {
    const key = `${x}_${y}`;
    if (tilesRef.current.has(key)) return;

    tilesRef.current.set(key, {
      url: `https://tile.openstreetmap.org/${zoom}/${x}/${y}.png`,
      position: [(x - lastCenter.current.x) * tileSize, 0, (y - lastCenter.current.y) * tileSize],
      key
    });
  };

  const updateTiles = (baseX, baseY, forwardX = 0, forwardY = 0) => {
    const range = 7; // BIGGER WORLD

    for (let i = -range; i <= range; i++) {
      for (let j = -range; j <= range; j++) {
        const fx = Math.round(forwardX * 3);
        const fy = Math.round(forwardY * 3);

        createTile(baseX + i + fx, baseY + j + fy);
      }
    }

    // cleanup far tiles
    for (let key of tilesRef.current.keys()) {
      const [x, y] = key.split("_").map(Number);
      if (
        Math.abs(x - baseX) > range + 3 ||
        Math.abs(y - baseY) > range + 3
      ) {
        tilesRef.current.delete(key);
      }
    }
  };

  useEffect(() => {
    const { x, y } = latLonToTile(center.lat, center.lon);
    lastCenter.current = { x, y };
    updateTiles(x, y);
  }, [center]);

  useFrame(() => {
    if (!planeRef.current) return;

    const p = planeRef.current;

    const forward = new THREE.Vector3(0, 0, -1).applyEuler(p.rotation);
    const fx = forward.x;
    const fy = forward.z;

    const centerTile = latLonToTile(center.lat, center.lon);

    updateTiles(centerTile.x, centerTile.y, fx, fy);
  });

  return (
    <group ref={groupRef}>
      {Array.from(tilesRef.current.values()).map((tile) => (
        <Tile key={tile.key} {...tile} size={tileSize} />
      ))}
    </group>
  );
}

// ================= COMPASS =================
function Compass({ heading }) {
  return (
    <div style={{
      position: "absolute",
      top: 20,
      left: "50%",
      transform: "translateX(-50%)",
      width: 120,
      height: 120,
      borderRadius: "50%",
      background: "#000000cc",
      color: "white",
      zIndex: 100,
      display: "flex",
      alignItems: "center",
      justifyContent: "center"
    }}>
      <div style={{
        transform: `rotate(${-heading}rad)`
      }}>
        N
        <div style={{ position: "absolute", right: -40 }}>E</div>
        <div style={{ position: "absolute", bottom: -40 }}>S</div>
        <div style={{ position: "absolute", left: -40 }}>W</div>
      </div>
    </div>
  );
}

// ================= PLANE =================
const Plane = React.forwardRef(({ speed, setStats, setHeading }, planeRef) => {
  const { camera } = useThree();

  let model;
  try {
    model = useGLTF("/models/product.glb").scene;
  } catch {
    model = null;
  }

  const velocity = useRef(new THREE.Vector3(0, 0, -speed));
  const rot = useRef({ pitch: 0, yaw: 0, roll: 0 });
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

    if (keys.current["a"]) rot.current.yaw += 0.01;
    if (keys.current["d"]) rot.current.yaw -= 0.01;
    if (keys.current["w"]) rot.current.pitch += 0.008;
    if (keys.current["s"]) rot.current.pitch -= 0.008;

    p.rotation.set(rot.current.pitch, rot.current.yaw, 0);

    const forward = new THREE.Vector3(0, 0, -1).applyEuler(p.rotation);
    forward.multiplyScalar(speed);

    velocity.current.lerp(forward, 0.05);
    p.position.add(velocity.current);

    setHeading(rot.current.yaw);

    const camOffset = new THREE.Vector3(0, 4, 10).applyEuler(p.rotation);

    camera.position.lerp(p.position.clone().add(camOffset), 0.08);
    camera.lookAt(p.position);

    setStats({
      speed: speed.toFixed(2),
      altitude: p.position.y.toFixed(1),
    });
  });

  return (
    <group ref={planeRef} position={[0, 3, 0]}>
      {model ? (
        <primitive object={model} />
      ) : (
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
  const [heading, setHeading] = useState(0);
  const planeRef = useRef();

  const [city, setCity] = useState("");
  const [center, setCenter] = useState({ lat: 5.6037, lon: -0.1870 });

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

    if (planeRef.current) {
      planeRef.current.position.set(0, 3, 0);
    }
  };

  return (
    <div style={{ width: "100vw", height: "100vh", position: "relative" }}>
      <Compass heading={heading} />
      <MiniMap plane={planeRef} heading={heading} />

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
            placeholder="Search city"
            style={{ padding: 8 }}
          />
          <button>Search</button>
        </form>

        <p>Speed: {stats.speed}</p>
        <p>Altitude: {stats.altitude}</p>
      </div>

      <Canvas camera={{ position: [0, 4, 10], fov: 60 }}>
        <color attach="background" args={["#87CEEB"]} />
        <ambientLight intensity={0.6} />
        <directionalLight position={[100, 100, 50]} intensity={2} />
        <Sky sunPosition={[100, 20, 100]} />

        <Ground planeRef={planeRef} center={center} />

        <Suspense fallback={null}>
          <Plane speed={0.12} setStats={setStats} setHeading={setHeading} ref={planeRef} />
        </Suspense>
      </Canvas>
    </div>
  );
}
