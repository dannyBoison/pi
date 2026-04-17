🔥 FULL CODE (ALL FIXES + REAL BUILDINGS)
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
  tex.anisotropy = 4;
  textureCache.set(url, tex);
  return tex;
}

// ================= BUILDING CACHE =================
const buildingCache = new Map();
const BUILDING_LIMIT = 40;

async function fetchBuildings(x, y, zoom) {
  const key = `${x},${y},${zoom}`;
  if (buildingCache.has(key)) return buildingCache.get(key);

  const n = Math.pow(2, zoom);

  const lon1 = (x / n) * 360 - 180;
  const lon2 = ((x + 1) / n) * 360 - 180;

  const lat1 =
    (180 / Math.PI) *
    Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n)));
  const lat2 =
    (180 / Math.PI) *
    Math.atan(Math.sinh(Math.PI * (1 - (2 * (y + 1)) / n)));

  const url = `https://overpass-api.de/api/interpreter?data=
  [out:json];
  way["building"](${lat2},${lon1},${lat1},${lon2});
  out geom;`;

  try {
    const res = await fetch(url);
    const data = await res.json();

    const sliced = data.elements.slice(0, BUILDING_LIMIT);
    buildingCache.set(key, sliced);
    return sliced;
  } catch (err) {
    console.log("Building fetch error:", err);
    return [];
  }
}

// ================= BUILDING CREATION =================
function createBuildingMesh(way, center) {
  if (!way.geometry) return null;

  const shape = new THREE.Shape();

  way.geometry.forEach((p, i) => {
    const x = (p.lon - center.lon) * 10000;
    const z = (p.lat - center.lat) * 10000;

    if (i === 0) shape.moveTo(x, z);
    else shape.lineTo(x, z);
  });

  const height =
    way.tags?.height
      ? parseFloat(way.tags.height)
      : way.tags?.["building:levels"]
      ? parseFloat(way.tags["building:levels"]) * 3
      : 8 + Math.random() * 10;

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: height,
    bevelEnabled: false,
  });

  const material = new THREE.MeshStandardMaterial({
    color: "#888",
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.x = -Math.PI / 2;

  return mesh;
}

// ================= TILE =================
function Tile({ url, position, size }) {
  const texture = useMemo(() => getTexture(url), [url]);

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
  const buildingRef = useRef(new Map());

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

  const addTile = (x, y, baseX, baseY) => {
    const normalized = normalizeTile(x, y);
    if (!normalized) return;

    const key = `${normalized.x},${normalized.y}`;
    if (tilesRef.current.has(key)) return;

    const worldX = (x - baseX) * tileSize;
    const worldZ = (y - baseY) * tileSize;

    tilesRef.current.set(key, {
      key,
      x: normalized.x,
      y: normalized.y,
      url: `https://tile.openstreetmap.org/${zoom}/${normalized.x}/${normalized.y}.png`,
      position: [worldX, 0, worldZ],
    });

    dirtyRef.current = true;
  };

  const removeFarTiles = (planeX, planeZ) => {
    const maxDistance = tileSize * 10;

    tilesRef.current.forEach((tile, key) => {
      const dx = tile.position[0] - planeX;
      const dz = tile.position[2] - planeZ;

      if (Math.abs(dx) > maxDistance || Math.abs(dz) > maxDistance) {
        tilesRef.current.delete(key);
        buildingRef.current.delete(key); // 🔥 remove buildings too
        dirtyRef.current = true;
      }
    });
  };

  const updateTiles = (planePos, baseTile) => {
    const range = 5;

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
    buildingRef.current.clear();
    dirtyRef.current = true;
  }, [center]);

  useFrame(async ({ clock }) => {
    if (!planeRef.current) return;

    const now = clock.elapsedTime;
    if (now - lastUpdateRef.current < 0.6) return;
    lastUpdateRef.current = now;

    const p = planeRef.current.position;

    const moveX = Math.floor(p.x / tileSize);
    const moveZ = Math.floor(p.z / tileSize);

    const baseTile = {
      x: baseTileRef.current.x + moveX,
      y: baseTileRef.current.y + moveZ,
    };

    updateTiles(p, baseTile);

    // 🔥 BUILDINGS LOAD (safe + cached)
    for (const tile of tilesRef.current.values()) {
      if (buildingRef.current.has(tile.key)) continue;

      fetchBuildings(tile.x, tile.y, zoom).then((data) => {
        const meshes = data
          .map((way) => {
            const mesh = createBuildingMesh(way, center);
            if (!mesh) return null;

            mesh.position.set(
              tile.position[0],
              0,
              tile.position[2]
            );

            return mesh;
          })
          .filter(Boolean);

        buildingRef.current.set(tile.key, meshes);
      });
    }

    if (dirtyRef.current) {
      dirtyRef.current = false;
      setTiles(Array.from(tilesRef.current.values()));
    }
  });

  return (
    <group ref={groupRef}>
      {tiles.map((tile) => (
        <Tile key={tile.key} {...tile} size={tileSize} />
      ))}

      {[...buildingRef.current.values()].flat().map((mesh, i) => (
        <primitive object={mesh} key={i} />
      ))}
    </group>
  );
}

// ================= MINIMAP =================
function Minimap({ planeRef, heading, center }) {
  const mapContainer = useRef(null);
  const mapRef = useRef(null);
  const planeMarker = useRef(null);

  mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;

  useEffect(() => {
    if (mapRef.current) return;

    mapRef.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/satellite-v9",
      center: [center.lon, center.lat],
      zoom: 14,
      interactive: false,
    });

    const el = document.createElement("div");
    el.style.borderLeft = "7px solid transparent";
    el.style.borderRight = "7px solid transparent";
    el.style.borderBottom = "14px solid red";

    planeMarker.current = new mapboxgl.Marker(el)
      .setLngLat([center.lon, center.lat])
      .addTo(mapRef.current);
  }, []);

  useFrame(() => {
    if (!planeRef.current || !mapRef.current) return;

    const p = planeRef.current.position;

    const lon = center.lon + p.x * 0.0003;
    const lat = center.lat + p.z * 0.0003;

    mapRef.current.setCenter([lon, lat]);
    planeMarker.current.setLngLat([lon, lat]);
    mapRef.current.setBearing(-heading * (180 / Math.PI));
  });

  return (
    <div
      ref={mapContainer}
      style={{
        position: "absolute",
        bottom: 20,
        left: 20,
        width: 180,
        height: 180,
        borderRadius: "50%",
        overflow: "hidden",
        border: "3px solid white",
      }}
    />
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
      display: "flex",
      justifyContent: "center",
      alignItems: "center"
    }}>
      <div style={{ transform: `rotate(${-heading}rad)` }}>N</div>
    </div>
  );
}

// ================= PLANE =================
const Plane = React.forwardRef(({ speed, setStats, setHeading }, ref) => {
  const { camera } = useThree();

  const velocity = useRef(new THREE.Vector3(0, 0, -speed));
  const rotation = useRef({ pitch: 0, yaw: 0 });
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
    const p = ref.current;
    if (!p) return;

    if (keys.current["a"]) rotation.current.yaw += 0.01;
    if (keys.current["d"]) rotation.current.yaw -= 0.01;
    if (keys.current["w"]) rotation.current.pitch += 0.008;
    if (keys.current["s"]) rotation.current.pitch -= 0.008;

    p.rotation.set(rotation.current.pitch, rotation.current.yaw, 0);

    const forward = new THREE.Vector3(0, 0, -1).applyEuler(p.rotation);
    forward.multiplyScalar(speed);

    velocity.current.lerp(forward, 0.05);
    p.position.add(velocity.current);

    const camOffset = new THREE.Vector3(0, 4, 10).applyEuler(p.rotation);

    camera.position.lerp(p.position.clone().add(camOffset), 0.08);
    camera.lookAt(p.position);

    setStats({
      speed: speed.toFixed(2),
      altitude: p.position.y.toFixed(1),
    });

    setHeading(rotation.current.yaw);
  });

  return (
    <mesh ref={ref} position={[0, 3, 0]}>
      <coneGeometry args={[0.5, 2, 8]} />
      <meshStandardMaterial color="red" />
    </mesh>
  );
});

// ================= MAIN =================
export default function FlightSimulation() {
  const [stats, setStats] = useState({ speed: 0, altitude: 0 });
  const [heading, setHeading] = useState(0);
  const planeRef = useRef();

  const [center, setCenter] = useState({
    lat: 5.6037,
    lon: -0.1870,
  });

  return (
    <div style={{ width: "100vw", height: "100vh", position: "relative" }}>
      <Compass heading={heading} />
      <Minimap planeRef={planeRef} heading={heading} center={center} />

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
