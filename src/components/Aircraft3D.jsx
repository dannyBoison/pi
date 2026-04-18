import React, {
  useRef,
  useState,
  useEffect,
  Suspense,
  useMemo,
} from "react";
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
      url: `https://tile.openstreetmap.org/${zoom}/${normalized.x}/${normalized.y}.png`,
      position: [worldX, 0, worldZ],
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
        <Tile key={tile.key} {...tile} size={tileSize} />
      ))}
    </group>
  );
}

// ================= ROUTES (NEW FEATURE) =================
const ROUTES = [
  {
    name: "Accra → Kumasi Airport",
    from: { lat: 5.605186, lon: -0.166786 },
    to: { lat: 6.71456, lon: -1.59082 },
  },
  {
    name: "Accra → Takoradi Airport",
    from: { lat: 5.605186, lon: -0.166786 },
    to: { lat: 4.896, lon: -1.774 },
  },
  {
    name: "Kumasi → Accra",
    from: { lat: 6.71456, lon: -1.59082 },
    to: { lat: 5.605186, lon: -0.166786 },
  },
];

// ================= PLANE =================
const Plane = React.forwardRef(
  ({ speed, setStats, setHeading, autopilot }, planeRef) => {
    const { camera } = useThree();

    let model;
    try {
      model = useGLTF("/models/product.glb").scene;
    } catch {
      model = null;
    }

    const velocity = useRef(new THREE.Vector3());
    const rotation = useRef({ pitch: 0, yaw: 0, roll: 0 });
    const keys = useRef({});

    const headingRef = useRef(0);
    const lastUIUpdate = useRef(0);

    // ================= AUTOPILOT STATE =================
    const targetRef = useRef(null);

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

      // ================= AUTOPILOT =================
      if (autopilot.active && targetRef.current) {
        const target = targetRef.current;

        const targetPos = new THREE.Vector3(
          target.x,
          3,
          target.z
        );

        const dir = targetPos.clone().sub(p.position).normalize();

        // smooth rotation toward target
        const targetYaw = Math.atan2(dir.x, dir.z);
        rotation.current.yaw = THREE.MathUtils.lerp(
          rotation.current.yaw,
          targetYaw,
          0.03
        );

        const forward = new THREE.Vector3(0, 0, -1).applyEuler(
          new THREE.Euler(
            rotation.current.pitch,
            rotation.current.yaw,
            0
          )
        );

        p.position.add(forward.multiplyScalar(speed));

        // arrival check
        if (p.position.distanceTo(targetPos) < 10) {
          autopilot.setActive(false);
        }
      }

      // ================= MANUAL CONTROL =================
      else {
        if (keys.current["a"]) rotation.current.yaw += 0.01;
        if (keys.current["d"]) rotation.current.yaw -= 0.01;
        if (keys.current["w"]) rotation.current.pitch += 0.008;
        if (keys.current["s"]) rotation.current.pitch -= 0.008;

        p.rotation.set(
          rotation.current.pitch,
          rotation.current.yaw,
          rotation.current.roll
        );

        const forward = new THREE.Vector3(0, 0, -1).applyEuler(
          p.rotation
        );
        forward.multiplyScalar(speed);

        velocity.current.lerp(forward, 0.05);
        p.position.add(velocity.current);
      }

      headingRef.current = rotation.current.yaw;

      const camOffset = new THREE.Vector3(0, 4, 10);
      camOffset.applyEuler(p.rotation);

      camera.position.lerp(
        p.position.clone().add(camOffset),
        0.08
      );

      camera.lookAt(
        p.position.clone().add(new THREE.Vector3(0, 1, 0))
      );

      const now = performance.now();
      if (now - lastUIUpdate.current > 200) {
        lastUIUpdate.current = now;

        setStats({
          speed: speed.toFixed(2),
          altitude: p.position.y.toFixed(1),
        });

        setHeading(rotation.current.yaw);
      }
    });

    // expose target setter
    useEffect(() => {
      autopilot.setTargetRef((t) => (targetRef.current = t));
    }, []);

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
  }
);

// ================= MAIN =================
export default function FlightSimulation() {
  const [stats, setStats] = useState({ speed: 0, altitude: 0 });
  const [heading, setHeading] = useState(0);
  const planeRef = useRef();

  const [center, setCenter] = useState({
    lat: 5.6037,
    lon: -0.1870,
  });

  const [speed, setSpeed] = useState(0.12);

  // ================= AUTOPILOT STATE =================
  const [selectedRoute, setSelectedRoute] = useState(ROUTES[0]);
  const [autopilot, setAutopilot] = useState({
    active: false,
    setActive: () => {},
    setTargetRef: () => {},
  });

  const targetSetterRef = useRef(null);

  useEffect(() => {
    setAutopilot({
      active: false,
      setActive: (v) =>
        setAutopilot((p) => ({ ...p, active: v })),
      setTargetRef: (fn) => (targetSetterRef.current = fn),
    });
  }, []);

  const startJourney = () => {
    const from = selectedRoute.from;
    const to = selectedRoute.to;

    setCenter(from);

    const worldScale = 0.0003;

    const target = {
      x: (to.lon - from.lon) / worldScale,
      z: (to.lat - from.lat) / worldScale,
    };

    targetSetterRef.current?.(target);

    setAutopilot((p) => ({ ...p, active: true }));
  };

  return (
    <div style={{ width: "100vw", height: "100vh" }}>
      {/* ================= UI ================= */}
      <div
        style={{
          position: "absolute",
          top: 20,
          left: 20,
          zIndex: 100,
          background: "#000000cc",
          color: "white",
          padding: 12,
          borderRadius: 10,
        }}
      >
        <h4>Flight Control</h4>

        <select
          value={selectedRoute.name}
          onChange={(e) =>
            setSelectedRoute(
              ROUTES.find((r) => r.name === e.target.value)
            )
          }
        >
          {ROUTES.map((r) => (
            <option key={r.name}>{r.name}</option>
          ))}
        </select>

        <button onClick={startJourney}>
          Start Journey ✈️
        </button>

        <p>Speed: {stats.speed}</p>
        <p>Altitude: {stats.altitude}</p>
        <p>
          Mode:{" "}
          {autopilot.active ? "Autopilot 🤖" : "Manual 🎮"}
        </p>
      </div>

      {/* ================= CANVAS ================= */}
      <Canvas camera={{ position: [0, 4, 10], fov: 60 }}>
        <ambientLight intensity={0.6} />
        <directionalLight position={[100, 100, 50]} intensity={2} />
        <Sky sunPosition={[100, 20, 100]} />

        <Ground planeRef={planeRef} center={center} />

        <Suspense fallback={null}>
          <Plane
            speed={speed}
            setStats={setStats}
            setHeading={setHeading}
            ref={planeRef}
            autopilot={autopilot}
          />
        </Suspense>
      </Canvas>
    </div>
  );
}
