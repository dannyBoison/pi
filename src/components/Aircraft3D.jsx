import React, { useRef, useState, useEffect, Suspense } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Sky, useGLTF, useTexture } from "@react-three/drei";
import * as THREE from "three";

// ================= TILE =================
function Tile({ url, position, size }) {
  const texture = useTexture(url);
  const materialRef = useRef();
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
      <meshStandardMaterial
        ref={materialRef}
        map={texture}
        transparent
        opacity={opacity}
      />
    </mesh>
  );
}

// ================= MINI MAP (NEW GTA STYLE) =================


function MiniMap({ planeRef, heading }) {
  const [pos, setPos] = useState({ x: 0, z: 0 });
  const [trail, setTrail] = useState([]);

  // smooth tracking
  useEffect(() => {
    let frame;

    const update = () => {
      if (planeRef.current) {
        const x = planeRef.current.position.x;
        const z = planeRef.current.position.z;

        setPos({ x, z });

        // trail (last 20 positions)
        setTrail((prev) => {
          const next = [...prev, { x, z }];
          return next.slice(-20);
        });
      }

      frame = requestAnimationFrame(update);
    };

    update();
    return () => cancelAnimationFrame(frame);
  }, [planeRef]);

  const size = 170;
  const scale = 0.06;

  return (
    <div
      style={{
        position: "absolute",
        bottom: 20,
        right: 20,
        width: size,
        height: size,
        borderRadius: "50%",
        background: "radial-gradient(circle, rgba(0,0,0,0.75), rgba(0,0,0,0.95))",
        border: "2px solid rgba(0,255,120,0.35)",
        boxShadow: "0 0 25px rgba(0,255,120,0.15)",
        overflow: "hidden",
        zIndex: 200,
      }}
    >
      {/* RADAR SWEEP EFFECT */}
      <div
        style={{
          position: "absolute",
          width: "100%",
          height: "100%",
          background:
            "conic-gradient(from 0deg, rgba(0,255,120,0.0), rgba(0,255,120,0.15), rgba(0,255,120,0.0))",
          animation: "spin 3s linear infinite",
          opacity: 0.6,
        }}
      />

      {/* rotating world */}
      <div
        style={{
          position: "absolute",
          width: "100%",
          height: "100%",
          transform: `rotate(${-heading}rad)`,
          transition: "transform 0.1s linear",
        }}
      >
        {/* faint terrain grid (fake map feel) */}
        <div
          style={{
            position: "absolute",
            width: "220%",
            height: "220%",
            left: "-60%",
            top: "-60%",
            backgroundImage:
              "radial-gradient(rgba(0,255,120,0.12) 1px, transparent 1px)",
            backgroundSize: "14px 14px",
            filter: "blur(0.2px)",
          }}
        />

        {/* movement trail */}
        {trail.map((t, i) => {
          const x = t.x * scale;
          const z = t.z * scale;

          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: "50%",
                top: "50%",
                width: 4,
                height: 4,
                transform: `translate(${x}px, ${z}px)`,
                background: "rgba(0,255,120,0.5)",
                borderRadius: "50%",
                opacity: i / trail.length,
                boxShadow: "0 0 6px rgba(0,255,120,0.5)",
              }}
            />
          );
        })}

        {/* player dot */}
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: 10,
            height: 10,
            transform: "translate(-50%, -50%)",
            background: "#00ff7b",
            borderRadius: "50%",
            boxShadow: "0 0 12px #00ff7b",
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
            borderBottom: "14px solid white",
            filter: "drop-shadow(0 0 2px white)",
          }}
        />
      </div>

      {/* pulse ring animation */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "50%",
          boxShadow: "inset 0 0 25px rgba(0,255,120,0.25)",
          animation: "pulse 2.5s infinite",
          pointerEvents: "none",
        }}
      />

      {/* CSS animations */}
      <style>
        {`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }

          @keyframes pulse {
            0% { box-shadow: inset 0 0 15px rgba(0,255,120,0.15); }
            50% { box-shadow: inset 0 0 30px rgba(0,255,120,0.35); }
            100% { box-shadow: inset 0 0 15px rgba(0,255,120,0.15); }
          }
        `}
      </style>
    </div>
  );
}


// ================= GROUND =================
function Ground({ planeRef, center }) {
  const zoom = 14;
  const tileSize = 120;

  const groupRef = useRef();
  const tilesRef = useRef(new Map());
  const [tiles, setTiles] = useState([]);

  const baseTileRef = useRef({ x: 0, y: 0 });

  const lastUpdateRef = useRef(0);
  const UPDATE_INTERVAL = 120;

  const maxTile = Math.pow(2, zoom);

  const normalizeTile = (x, y) => {
    x = ((x % maxTile) + maxTile) % maxTile;
    if (y < 0 || y >= maxTile) return null;
    return { x, y };
  };

  const latLonToTile = (lat, lon) => {
    const x = Math.floor(((lon + 180) / 360) * maxTile);
    const y =
      Math.floor(
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
    const t = latLonToTile(center.lat, center.lon);
    baseTileRef.current = t;
    tilesRef.current.clear();
  }, [center]);

  useFrame((state) => {
    if (!planeRef.current) return;

    const now = state.clock.elapsedTime * 1000;
    if (now - lastUpdateRef.current < UPDATE_INTERVAL) return;
    lastUpdateRef.current = now;

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

    const camOffset = new THREE.Vector3(0, 4, 10).applyEuler(p.rotation);

    camera.position.lerp(p.position.clone().add(camOffset), 0.08);
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

    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${city}`
    );
    const data = await res.json();

    if (!data.length) return alert("City not found");

    setCenter({
      lat: parseFloat(data[0].lat),
      lon: parseFloat(data[0].lon),
    });

    planeRef.current?.position.set(0, 3, 0);
  };

  return (
    <div style={{ width: "100vw", height: "100vh", position: "relative" }}>
      <Compass heading={heading} />

      {/* ✅ GTA MINI MAP */}
      <MiniMap planeRef={planeRef} heading={heading} />

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
          <Plane speed={0.12} setStats={setStats} setHeading={setHeading} ref={planeRef} />
        </Suspense>
      </Canvas>
    </div>
  );
}
