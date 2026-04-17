import React, { useRef, useState, useEffect, Suspense, useMemo } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import mapboxgl from "mapbox-gl";
import { Sky, useGLTF, useTexture } from "@react-three/drei";
import * as THREE from "three";

// ================= TEXTURE CACHE =================
const textureCache = new Map();

function getTexture(url) {
  if (textureCache.has(url)) return textureCache.get(url);
  const tex = new THREE.TextureLoader().load(url);
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.anisotropy = 4;
  textureCache.set(url, tex);
  return tex;
}

// ================= HEIGHT CACHE (NEW) =================
const heightCache = new Map();

async function getHeight(lat, lon) {
  const key = `${lat.toFixed(3)},${lon.toFixed(3)}`;
  if (heightCache.has(key)) return heightCache.get(key);

  try {
    const res = await fetch(
      `https://api.open-elevation.com/api/v1/lookup?locations=${lat},${lon}`
    );
    const data = await res.json();
    const h = data.results[0].elevation || 0;

    heightCache.set(key, h);
    return h;
  } catch {
    return 0;
  }
}

// ================= TILE =================
function Tile({ url, position, size, elevation = 0 }) {
  const texture = useMemo(() => getTexture(url), [url]);

  return (
    <mesh
      position={[position[0], elevation * 0.05, position[2]]}
      rotation={[-Math.PI / 2, 0, 0]}
    >
      <planeGeometry args={[size, size, 10, 10]} />
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
  const dirtyRef = useRef(false);
  const lastUpdateRef = useRef(0);

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

  const addTile = async (x, y, baseX, baseY) => {
    const normalized = normalizeTile(x, y);
    if (!normalized) return;

    const key = `${normalized.x},${normalized.y}`;
    if (tilesRef.current.has(key)) return;

    const worldX = (x - baseX) * tileSize;
    const worldZ = (y - baseY) * tileSize;

    // 🌍 convert tile → lat/lon
    const n = Math.pow(2, zoom);
    const lon = (normalized.x / n) * 360 - 180;
    const lat =
      (Math.atan(Math.sinh(Math.PI * (1 - 2 * normalized.y / n))) * 180) /
      Math.PI;

    const elevation = await getHeight(lat, lon);

    tilesRef.current.set(key, {
      key,
      url: `https://tile.openstreetmap.org/${zoom}/${normalized.x}/${normalized.y}.png`,
      position: [worldX, 0, worldZ],
      elevation,
    });

    dirtyRef.current = true;
  };

  const removeFarTiles = (planeX, planeZ) => {
    const maxDistance = tileSize * 12;

    tilesRef.current.forEach((tile, key) => {
      const dx = tile.position[0] - planeX;
      const dz = tile.position[2] - planeZ;

      if (Math.abs(dx) > maxDistance || Math.abs(dz) > maxDistance) {
        tilesRef.current.delete(key);
        dirtyRef.current = true;
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
  };

  const baseTileRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const t = latLonToTile(center.lat, center.lon);
    baseTileRef.current = t;
    tilesRef.current.clear();
    dirtyRef.current = true;
  }, [center]);

  useFrame(({ clock }) => {
    if (!planeRef.current || !groupRef.current) return;

    const now = clock.elapsedTime;

    if (now - lastUpdateRef.current < 0.5) return;
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
      setTiles(Array.from(tilesRef.current.values()));
    }
  });

  return (
    <group ref={groupRef}>
      {tiles.map((tile) => (
        <Tile key={tile.key} {...tile} size={tileSize} elevation={tile.elevation} />
      ))}
    </group>
  );
}
