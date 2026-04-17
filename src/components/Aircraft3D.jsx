import React, { useRef, useState, useEffect, Suspense, useMemo } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import mapboxgl from "mapbox-gl";
import { Sky, useGLTF } from "@react-three/drei";
import * as THREE from "three";

// ================= TEXTURE CACHE =================
const textureCache = new Map();

function getTexture(url) {
  if (textureCache.has(url)) return textureCache.get(url);

  const tex = new THREE.TextureLoader().load(url);
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.anisotropy = 8;

  textureCache.set(url, tex);
  return tex;
}

// ================= HEIGHT CACHE =================
const heightCache = new Map();

async function getHeight(lat, lon) {
  const key = `${lat.toFixed(3)},${lon.toFixed(3)}`;

  if (heightCache.has(key)) return heightCache.get(key);

  try {
    const res = await fetch(
      `https://api.open-elevation.com/api/v1/lookup?locations=${lat},${lon}`
    );
    const data = await res.json();
    const h = data?.results?.[0]?.elevation ?? 0;

    heightCache.set(key, h);
    return h;
  } catch {
    return 0;
  }
}

// ================= TILE =================
function Tile({ url, position, size, height }) {
  const texture = useMemo(() => getTexture(url), [url]);

  // 🔥 REAL terrain displacement (not fake Y shift)
  const geometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(size, size, 32, 32);

    const pos = geo.attributes.position;

    for (let i = 0; i < pos.count; i++) {
      const z = pos.getZ(i);
      const x = pos.getX(i);

      const dist = Math.sqrt(x * x + z * z);
      const h = Math.sin(dist * 0.05) * height * 0.02;

      pos.setY(i, h);
    }

    geo.computeVertexNormals();
    return geo;
  }, [size, height]);

  return (
    <mesh
      geometry={geometry}
      position={[position[0], 0, position[2]]}
      rotation={[-Math.PI / 2, 0, 0]}
    >
      <meshStandardMaterial map={texture} />
    </mesh>
  );
}

// ================= GROUND =================
function Ground({ planeRef, center }) {
  const zoom = 14;
  const tileSize = 120;

  const tilesRef = useRef(new Map());
  const [tiles, setTiles] = useState([]);
  const dirtyRef = useRef(false);
  const lastUpdateRef = useRef(0);

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

  const addTile = async (x, y, baseX, baseY) => {
    const normalized = normalizeTile(x, y);
    if (!normalized) return;

    const key = `${normalized.x},${normalized.y}`;
    if (tilesRef.current.has(key)) return;

    const worldX = (x - baseX) * tileSize;
    const worldZ = (y - baseY) * tileSize;

    const n = Math.pow(2, zoom);

    const lon = (normalized.x / n) * 360 - 180;
    const lat =
      (Math.atan(Math.sinh(Math.PI * (1 - (2 * normalized.y) / n))) * 180) /
      Math.PI;

    const height = await getHeight(lat, lon);

    tilesRef.current.set(key, {
      key,
      url: `https://tile.openstreetmap.org/${zoom}/${normalized.x}/${normalized.y}.png`,
      position: [worldX, 0, worldZ],
      height,
    });

    dirtyRef.current = true;
  };

  const removeFarTiles = (px, pz) => {
    const maxDistance = tileSize * 12;

    tilesRef.current.forEach((tile, key) => {
      const dx = tile.position[0] - px;
      const dz = tile.position[2] - pz;

      if (Math.abs(dx) > maxDistance || Math.abs(dz) > maxDistance) {
        tilesRef.current.delete(key);
        dirtyRef.current = true;
      }
    });
  };

  const updateTiles = (planePos, baseTile) => {
    const range = 6;

    for (let i = -range; i <= range; i++) {
      for (let j = -range; j <= range; j++) {
        addTile(baseTile.x + i, baseTile.y + j, baseTile.x, baseTile.y);
      }
    }

    removeFarTiles(planePos.x, planePos.z);
  };

  const baseTileRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const t = latLonToTile(center.lat, center.lon);
    baseTileRef.current = t;
    tilesRef.current.clear();
    dirtyRef.current = true;
  }, [center]);

  useFrame(({ clock }) => {
    if (!planeRef.current) return;

    const now = clock.elapsedTime;

    if (now - lastUpdateRef.current < 0.4) return;
    lastUpdateRef.current = now;

    const p = planeRef.current.position;

    const moveX = Math.floor(p.x / tileSize);
    const moveZ = Math.floor(p.z / tileSize);

    const baseTile = {
      x: baseTileRef.current.x + moveX,
      y: baseTileRef.current.y + moveZ,
    };

    updateTiles(p, baseTile);

    if (dirtyRef.current) {
      dirtyRef.current = false;
      setTiles([...tilesRef.current.values()]);
    }
  });

  return (
    <group>
      {tiles.map((tile) => (
        <Tile
          key={tile.key}
          url={tile.url}
          position={tile.position}
          size={tileSize}
          height={tile.height}
        />
      ))}
    </group>
  );
}

// ================= PLANE =================
const Plane = React.forwardRef(({ speed }, ref) => {
  const { camera } = useThree();
  const keys = useRef({});
  const rotation = useRef({ yaw: 0, pitch: 0 });
  const velocity = useRef(new THREE.Vector3());

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
    const p = ref.current;
    if (!p) return;

    if (keys.current["a"]) rotation.current.yaw += 0.01;
    if (keys.current["d"]) rotation.current.yaw -= 0.01;
    if (keys.current["w"]) rotation.current.pitch += 0.01;
    if (keys.current["s"]) rotation.current.pitch -= 0.01;

    p.rotation.set(rotation.current.pitch, rotation.current.yaw, 0);

    const forward = new THREE.Vector3(0, 0, -1).applyEuler(p.rotation);
    velocity.current.lerp(forward.multiplyScalar(speed), 0.1);

    p.position.add(velocity.current);

    const camOffset = new THREE.Vector3(0, 5, 12).applyEuler(p.rotation);

    camera.position.lerp(p.position.clone().add(camOffset), 0.1);
    camera.lookAt(p.position);
  });

  return (
    <group ref={ref} position={[0, 3, 0]}>
      <mesh>
        <coneGeometry args={[0.5, 2, 8]} />
        <meshStandardMaterial color="red" />
      </mesh>
    </group>
  );
});

// ================= MAIN =================
export default function App() {
  const planeRef = useRef();
  const [center, setCenter] = useState({ lat: 5.6037, lon: -0.187 });

  return (
    <div style={{ width: "100vw", height: "100vh" }}>
      <Canvas camera={{ position: [0, 5, 10], fov: 60 }}>
        <ambientLight intensity={0.7} />
        <directionalLight position={[50, 50, 50]} intensity={2} />
        <Sky sunPosition={[100, 20, 100]} />

        <Ground planeRef={planeRef} center={center} />

        <Suspense fallback={null}>
          <Plane ref={planeRef} speed={0.15} />
        </Suspense>
      </Canvas>
    </div>
  );
}
