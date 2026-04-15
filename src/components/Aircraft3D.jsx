import React, { useRef, useState, useEffect, Suspense } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Sky, useGLTF, useTexture } from "@react-three/drei";
import * as THREE from "three";

// ================= TILE =================
function Tile({ url, position, size }) {
  const texture = useTexture(url);
  const materialRef = useRef();

  useEffect(() => {
    if (materialRef.current) {
      materialRef.current.opacity = 0;
    }
  }, []);

  useFrame(() => {
    if (materialRef.current && materialRef.current.opacity < 1) {
      materialRef.current.opacity += 0.05; // ✅ smooth fade-in
    }
  });

  texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.anisotropy = 16;

  return (
    <mesh position={position} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[size, size]} />
      <meshStandardMaterial
        ref={materialRef}
        map={texture}
        transparent
      />
    </mesh>
  );
}

// ================= GROUND =================
function Ground({ planeRef, center, setMiniMap }) {
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

  const tileToLatLon = (x, y) => {
    const n = Math.PI - (2 * Math.PI * y) / maxTile;
    return {
      lon: (x / maxTile) * 360 - 180,
      lat: (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)))
    };
  };

  const addTile = (x, y, baseX, baseY) => {
    const normalized = normalizeTile(x, y);
    if (!normalized) return;

    const key = `${normalized.x},${normalized.y}`;
    if (tilesRef.current.has(key)) return;

    const worldX = (x - baseX) * tileSize;
    const worldZ = (y - baseY) * tileSize;

    tilesRef.current.set(key, {
      key,
      url: `https://tile.openstreetmap.org/${zoom}/${normalized.x}/${normalized.y}.png`,
      position: [worldX, 0, worldZ],
    });
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

    // ✅ update minimap center
    const latlon = tileToLatLon(baseTile.x, baseTile.y);
    setMiniMap(latlon);
  };

  const baseTileRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const t = latLonToTile(center.lat, center.lon);
    baseTileRef.current = t;
    tilesRef.current.clear();
  }, [center]);

  useFrame(() => {
    if (!planeRef.current) return;

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
function MiniMap({ lat, lon, heading }) {
  return (
    <div style={{
      position: "absolute",
      top: 20,
      right: 20,
      width: 200,
      height: 200,
      borderRadius: "50%",
      overflow: "hidden",
      border: "3px solid white",
      zIndex: 200
    }}>
      <iframe
        title="minimap"
        width="200"
        height="200"
        style={{
          border: "none",
          transform: `rotate(${-heading}rad) scale(1.3)`
        }}
        src={`https://www.openstreetmap.org/export/embed.html?bbox=${lon-0.01},${lat-0.01},${lon+0.01},${lat+0.01}&layer=mapnik`}
      />
    </div>
  );
}

// ================= PLANE =================
const Plane = React.forwardRef(({ speed, setStats, setHeading }, planeRef) => {
  const { camera } = useThree();

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

    setHeading(rotation.current.yaw);

    const camOffset = new THREE.Vector3(0, 4, 10);
    camOffset.applyEuler(p.rotation);

    camera.position.lerp(p.position.clone().add(camOffset), 0.08);
    camera.lookAt(p.position.clone().add(new THREE.Vector3(0, 1, 0)));

    setStats({
      speed: speed.toFixed(2),
      altitude: p.position.y.toFixed(1),
    });
  });

  return (
    <mesh ref={planeRef} position={[0, 3, 0]}>
      <coneGeometry args={[0.5, 2, 8]} />
      <meshStandardMaterial color="red" />
    </mesh>
  );
});

// ================= MAIN =================
export default function FlightSimulation() {
  const [stats, setStats] = useState({ speed: 0, altitude: 0 });
  const [heading, setHeading] = useState(0);
  const [miniMap, setMiniMap] = useState({ lat: 5.6, lon: -0.18 });

  const planeRef = useRef();

  const [center, setCenter] = useState({
    lat: 5.6037,
    lon: -0.1870,
  });

  return (
    <div style={{ width: "100vw", height: "100vh", position: "relative" }}>

      <MiniMap lat={miniMap.lat} lon={miniMap.lon} heading={heading} />

      <Canvas camera={{ position: [0, 4, 10], fov: 60 }}>
        <ambientLight intensity={0.6} />
        <directionalLight position={[100, 100, 50]} intensity={2} />
        <Sky sunPosition={[100, 20, 100]} />

        <Ground planeRef={planeRef} center={center} setMiniMap={setMiniMap} />

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
