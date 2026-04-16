import React, { useRef, useState, useEffect, Suspense } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Sky, useGLTF, useTexture } from "@react-three/drei";
import * as THREE from "three";

// ================= TILE =================
function Tile({ url, position, size }) {
  const texture = useTexture(url);
  texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.anisotropy = 16;

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
  const tilesRef = useRef(new Map());
  const [tiles, setTiles] = useState([]);

  const maxTile = Math.pow(2, zoom);

  const normalizeTile = (x, y) => {
    x = ((x % maxTile) + maxTile) % maxTile;
    if (y < 0 || y >= maxTile) return null;
    return { x, y };
  };

  const latLonToTile = (lat, lon) => {
    const x = Math.floor(((lon + 180) / 360) * maxTile);
    const y = Math.floor(
      ((1 -
        Math.log(
          Math.tan((lat * Math.PI) / 180) +
          1 / Math.cos((lat * Math.PI) / 180)
        ) /
        Math.PI) /
        2) *
        maxTile
    );
    return { x, y };
  };

  const addTile = (x, y, baseX, baseY) => {
    const normalized = normalizeTile(x, y);
    if (!normalized) return;

    const key = `${normalized.x},${normalized.y}`;
    if (tilesRef.current.has(key)) return;

    const worldX = (x - baseX) * tileSize;
    const worldZ = (y - baseY) * tileSize;

    const tile = {
      key,
      url: `https://tile.openstreetmap.org/${zoom}/${normalized.x}/${normalized.y}.png`,
      position: [worldX, 0, worldZ],
    };

    tilesRef.current.set(key, tile);
  };

  const removeFarTiles = (planeX, planeZ) => {
    const maxDistance = tileSize * 12;

    tilesRef.current.forEach((tile, key) => {
      const dx = tile.position[0] - planeX;
      const dz = tile.position[2] - planeZ;

      if (Math.abs(dx) > maxDistance || Math.abs(dz) > maxDistance) {
        tilesRef.current.delete(key);
      }
    });
  };

  const updateTiles = (planePos, baseTile) => {
    const range = 7;

    for (let i = -range; i <= range; i++) {
      for (let j = -range; j <= range; j++) {
        addTile(baseTile.x + i, baseTile.y + j, baseTile.x, baseTile.y);
      }
    }

    removeFarTiles(planePos.x, planePos.z);
    setTiles(Array.from(tilesRef.current.values()));
  };

  const baseTileRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const t = latLonToTile(center.lat, center.lon);
    baseTileRef.current = t;
    tilesRef.current.clear();
  }, [center]);

  useFrame(() => {
    if (!planeRef.current || !groupRef.current) return;

    const p = planeRef.current.position;

    const moveX = Math.floor(p.x / tileSize);
    const moveZ = Math.floor(p.z / tileSize);

    const baseTile = {
      x: baseTileRef.current.x + moveX,
      y: baseTileRef.current.y + moveZ,
    };

    updateTiles(p, baseTile);
  });

  return (
    <group ref={groupRef}>
      {tiles.map((tile) => (
        <Tile key={tile.key} {...tile} size={tileSize} />
      ))}
    </group>
  );
}

// ================= MINIMAP =================
🔥 REPLACE ONLY YOUR Minimap FUNCTION WITH THIS
function Minimap({ planeRef, heading, center }) {
  const [tiles, setTiles] = useState([]);

  const zoom = 14;
  const tileSize = 80; // ✅ scaled DOWN to fit minimap

  const maxTile = Math.pow(2, zoom);

  const latLonToTile = (lat, lon) => {
    const x = Math.floor(((lon + 180) / 360) * maxTile);
    const y = Math.floor(
      ((1 -
        Math.log(
          Math.tan((lat * Math.PI) / 180) +
          1 / Math.cos((lat * Math.PI) / 180)
        ) /
        Math.PI) /
        2) *
        maxTile
    );
    return { x, y };
  };

  useEffect(() => {
    let frame;

    const update = () => {
      if (!planeRef.current) return;

      const p = planeRef.current.position;
      const base = latLonToTile(center.lat, center.lon);

      const offsetX = Math.floor(p.x / 120);
      const offsetY = Math.floor(p.z / 120);

      const tileX = base.x + offsetX;
      const tileY = base.y + offsetY;

      const newTiles = [];

      for (let i = -1; i <= 1; i++) {
        for (let j = -1; j <= 1; j++) {
          newTiles.push({
            key: `${tileX + i},${tileY + j}`,
            url: `https://tile.openstreetmap.org/${zoom}/${tileX + i}/${tileY + j}.png`,
            x: i,
            y: j,
          });
        }
      }

      setTiles(newTiles);

      frame = requestAnimationFrame(update);
    };

    update();
    return () => cancelAnimationFrame(frame);
  }, [planeRef, center]);

  return (
    <div style={{
      position: "absolute",
      bottom: 20,
      left: 20,
      width: 180,
      height: 180,
      borderRadius: "50%",
      overflow: "hidden",
      border: "3px solid white",
      background: "#000",
      zIndex: 100
    }}>
      {/* ROTATING MAP */}
      <div style={{
        position: "absolute",
        width: "100%",
        height: "100%",
        transform: `rotate(${heading}rad)`,
        transformOrigin: "center"
      }}>
        {tiles.map((tile) => (
          <img
            key={tile.key}
            src={tile.url}
            style={{
              position: "absolute",
              width: tileSize,
              height: tileSize,
              left: `calc(50% + ${tile.x * tileSize}px)`,
              top: `calc(50% + ${tile.y * tileSize}px)`,
              transform: "translate(-50%, -50%)"
            }}
          />
        ))}
      </div>

      {/* PLAYER */}
      <div style={{
        position: "absolute",
        top: "50%",
        left: "50%",
        width: 0,
        height: 0,
        borderLeft: "8px solid transparent",
        borderRight: "8px solid transparent",
        borderBottom: "16px solid red",
        transform: "translate(-50%, -50%)",
        zIndex: 10
      }} />
    </div>
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
      justifyContent: "center",
      fontWeight: "bold"
    }}>
      <div style={{
        position: "relative",
        transform: `rotate(${-heading}rad)`,
        transition: "transform 0.1s linear"
      }}>
        N
        <div style={{ position: "absolute", right: -40, top: 0 }}>E</div>
        <div style={{ position: "absolute", bottom: -40, left: 0 }}>S</div>
        <div style={{ position: "absolute", left: -40, top: 0 }}>W</div>
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
  const rotation = useRef({ pitch: 0, yaw: 0, roll: 0 });
  const keys = useRef({});

  useEffect(() => {
    if (model) {
      const box = new THREE.Box3().setFromObject(model);
      const size = new THREE.Vector3();
      box.getSize(size);
      const scale = 2 / Math.max(size.x, size.y, size.z);
      model.scale.set(scale, scale, scale);
      model.rotation.y = Math.PI;
    }
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

    setHeading(rotation.current.yaw);

    const camOffset = new THREE.Vector3(0, 4, 10);
    camOffset.applyEuler(p.rotation);

    camera.position.lerp(
      p.position.clone().add(camOffset),
      0.08
    );

    camera.lookAt(p.position.clone().add(new THREE.Vector3(0, 1, 0)));

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

      if (planeRef.current) {
        planeRef.current.position.set(0, 3, 0);
      }

    } catch {
      alert("Search failed");
    }
  };

  return (
    <div style={{ width: "100vw", height: "100vh", position: "relative" }}>

      <Compass heading={heading} />
      <Minimap planeRef={planeRef} heading={heading} center={center} />

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
            style={{ padding: 8, marginRight: 5 }}
          />
          <button type="submit">Search</button>
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
          <Plane
            speed={0.12}
            setStats={setStats}
            setHeading={setHeading}
            ref={planeRef}
          />
        </Suspense>
      </Canvas>
    </div>
  );
}
