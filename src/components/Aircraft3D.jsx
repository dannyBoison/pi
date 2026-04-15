import React, { useRef, useState, useEffect, Suspense } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Sky, useGLTF, useTexture } from "@react-three/drei";
import * as THREE from "three";

// ================= TILE =================
function Tile({ url, position, size }) {
  const texture = useTexture(url);
  const [opacity, setOpacity] = useState(0);

  useEffect(() => {
    let i = 0;
    const interval = setInterval(() => {
      i += 0.1;
      setOpacity(Math.min(i, 1));
      if (i >= 1) clearInterval(interval);
    }, 25);

    return () => clearInterval(interval);
  }, []);

  texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.anisotropy = 16;

  return (
    <mesh position={position} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[size, size]} />
      <meshStandardMaterial map={texture} transparent opacity={opacity} />
    </mesh>
  );
}

// ================= MINI MAP (FIXED GTA STYLE) =================
function MiniMap({ planeRef, heading }) {
  const [pos, setPos] = useState({ x: 0, z: 0 });

  // ✅ SAFE: no R3F hooks, no crashes
  useEffect(() => {
    let frame;

    const update = () => {
      if (planeRef.current) {
        setPos({
          x: planeRef.current.position.x,
          z: planeRef.current.position.z,
        });
      }

      frame = requestAnimationFrame(update);
    };

    update();
    return () => cancelAnimationFrame(frame);
  }, [planeRef]);

  const size = 160;

  return (
    <div
      style={{
        position: "absolute",
        bottom: 20,
        right: 20,
        width: size,
        height: size,
        borderRadius: "50%",
        background: "rgba(0,0,0,0.65)",
        border: "3px solid rgba(255,255,255,0.25)",
        backdropFilter: "blur(6px)",
        overflow: "hidden",
        zIndex: 200,
      }}
    >
      {/* rotating radar */}
      <div
        style={{
          position: "absolute",
          width: "100%",
          height: "100%",
          transform: `rotate(${-heading}rad)`,
          transition: "transform 0.1s linear",
        }}
      >
        {/* grid */}
        <div
          style={{
            position: "absolute",
            width: "200%",
            height: "200%",
            left: "-50%",
            top: "-50%",
            backgroundImage:
              "radial-gradient(rgba(255,255,255,0.18) 1px, transparent 1px)",
            backgroundSize: "18px 18px",
          }}
        />

        {/* player dot */}
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            transform: "translate(-50%, -50%)",
            width: 10,
            height: 10,
            background: "lime",
            borderRadius: "50%",
            boxShadow: "0 0 12px lime",
          }}
        />

        {/* direction arrow */}
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "38%",
            transform: "translateX(-50%)",
            width: 0,
            height: 0,
            borderLeft: "6px solid transparent",
            borderRight: "6px solid transparent",
            borderBottom: "12px solid white",
          }}
        />
      </div>

      {/* glow ring */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "50%",
          boxShadow: "inset 0 0 25px rgba(0,255,0,0.15)",
          pointerEvents: "none",
        }}
      />
    </div>
  );
}

// ================= GROUND =================
function Ground({ planeRef, center }) {
  const zoom = 14;
  const tileSize = 120;

  const tilesRef = useRef(new Map());
  const [tiles, setTiles] = useState([]);
  const baseTileRef = useRef({ x: 0, y: 0 });
  const lastUpdateRef = useRef(0);

  const maxTile = Math.pow(2, zoom);
  const UPDATE_INTERVAL = 120;

  const normalizeTile = (x, y) => {
    x = ((x % maxTile) + maxTile) % maxTile;
    if (y < 0 || y >= maxTile) return null;
    return { x, y };
  };

  const addTile = (x, y, baseX, baseY) => {
    const n = normalizeTile(x, y);
    if (!n) return;

    const key = `${n.x},${n.y}`;
    if (tilesRef.current.has(key)) return;

    const worldX = (x - baseX) * tileSize;
    const worldZ = (y - baseY) * tileSize;

    tilesRef.current.set(key, {
      key,
      url: `https://tile.openstreetmap.org/${zoom}/${n.x}/${n.y}.png`,
      position: [worldX, 0, worldZ],
    });
  };

  const removeFarTiles = (px, pz) => {
    const maxDist = tileSize * 12;

    tilesRef.current.forEach((t, key) => {
      const dx = t.position[0] - px;
      const dz = t.position[2] - pz;

      if (Math.abs(dx) > maxDist || Math.abs(dz) > maxDist) {
        tilesRef.current.delete(key);
      }
    });
  };

  const updateTiles = (planePos, baseTile) => {
    const range = 8;
    const dirX = Math.sign(planePos.x);
    const dirZ = Math.sign(planePos.z);

    for (let i = -range; i <= range; i++) {
      for (let j = -range; j <= range; j++) {
        addTile(
          baseTile.x + i + dirX * 3,
          baseTile.y + j + dirZ * 3,
          baseTile.x,
          baseTile.y
        );
      }
    }

    removeFarTiles(planePos.x, planePos.z);
    setTiles(Array.from(tilesRef.current.values()));
  };

  useEffect(() => {
    const x = Math.floor(((center.lon + 180) / 360) * maxTile);
    const y = Math.floor(((1 - Math.log(Math.tan(center.lat * Math.PI / 180) + 1 / Math.cos(center.lat * Math.PI / 180)) / Math.PI) / 2) * maxTile);

    baseTileRef.current = { x, y };
    tilesRef.current.clear();
  }, [center]);

  useFrame((state) => {
    if (!planeRef.current) return;

    const now = state.clock.elapsedTime * 1000;
    if (now - lastUpdateRef.current < UPDATE_INTERVAL) return;
    lastUpdateRef.current = now;

    const p = planeRef.current.position;

    const baseTile = {
      x: baseTileRef.current.x + Math.floor(p.x / tileSize),
      y: baseTileRef.current.y + Math.floor(p.z / tileSize),
    };

    updateTiles(p, baseTile);
  });

  return (
    <group>
      {tiles.map((t) => (
        <Tile key={t.key} {...t} size={tileSize} />
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
      justifyContent: "center",
      fontWeight: "bold"
    }}>
      <div style={{
        transform: `rotate(${-heading}rad)`,
        transition: "transform 0.1s linear"
      }}>
        N <span style={{ marginLeft: 40 }}>E</span>
        <div style={{ position: "absolute", bottom: -40 }}>S</div>
        <div style={{ position: "absolute", left: -40 }}>W</div>
      </div>
    </div>
  );
}

// ================= PLANE =================
const Plane = React.forwardRef(({ speed, setStats, setHeading }, planeRef) => {
  const { camera } = useThree();
  const velocity = useRef(new THREE.Vector3());

  const rotation = useRef({ pitch: 0, yaw: 0 });

  useFrame(() => {
    const p = planeRef.current;
    if (!p) return;

    rotation.current.yaw += 0;

    const forward = new THREE.Vector3(0, 0, -1).applyEuler(p.rotation);
    forward.multiplyScalar(speed);

    velocity.current.lerp(forward, 0.05);
    p.position.add(velocity.current);

    setHeading(rotation.current.yaw);

    camera.position.lerp(
      p.position.clone().add(new THREE.Vector3(0, 4, 10)),
      0.08
    );

    camera.lookAt(p.position);
  });

  return (
    <group ref={planeRef} position={[0, 3, 0]}>
      <mesh>
        <coneGeometry args={[0.5, 2, 8]} />
        <meshStandardMaterial color="red" />
      </mesh>
    </group>
  );
});

// ================= MAIN =================
export default function FlightSimulation() {
  const planeRef = useRef();
  const [heading, setHeading] = useState(0);

  const [center] = useState({ lat: 5.6037, lon: -0.187 });

  return (
    <div style={{ width: "100vw", height: "100vh", position: "relative" }}>
      <Compass heading={heading} />
      <MiniMap planeRef={planeRef} heading={heading} />

      <Canvas camera={{ position: [0, 4, 10], fov: 60 }}>
        <ambientLight intensity={0.6} />
        <directionalLight position={[100, 100, 50]} intensity={2} />
        <Sky sunPosition={[100, 20, 100]} />

        <Ground planeRef={planeRef} center={center} />

        <Suspense fallback={null}>
          <Plane speed={0.12} setHeading={setHeading} ref={planeRef} />
        </Suspense>
      </Canvas>
    </div>
  );
}
