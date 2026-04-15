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

// ================= GROUND =================
function Ground({ planeRef, center }) {
  const zoom = 14;
  const tileSize = 140; // 🔥 slightly bigger spacing for better scale feel

  const groupRef = useRef();
  const [tiles, setTiles] = useState([]);
  const lastTile = useRef({ x: 0, y: 0 });

  const LOAD_RADIUS = 7;

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

  const generateTiles = (baseX, baseY) => {
    const grid = [];

    for (let i = -LOAD_RADIUS; i <= LOAD_RADIUS; i++) {
      for (let j = -LOAD_RADIUS; j <= LOAD_RADIUS; j++) {
        grid.push({
          key: `${baseX + i}-${baseY + j}`,
          url: `https://tile.openstreetmap.org/${zoom}/${baseX + i}/${baseY + j}.png`,
          position: [i * tileSize, 0, j * tileSize],
        });
      }
    }

    setTiles(grid);
  };

  useEffect(() => {
    const base = latLonToTile(center.lat, center.lon);
    lastTile.current = base;
    generateTiles(base.x, base.y);
  }, [center]);

  useFrame(() => {
    if (!planeRef.current || !groupRef.current) return;

    const p = planeRef.current;

    groupRef.current.position.x = -p.position.x * 0.5;
    groupRef.current.position.z = -p.position.z * 0.5;

    const moveX = Math.floor(p.position.x / tileSize);
    const moveZ = Math.floor(p.position.z / tileSize);

    const base = latLonToTile(center.lat, center.lon);

    const newX = base.x + moveX;
    const newY = base.y + moveZ;

    if (Math.abs(newX - lastTile.current.x) >= 1 || Math.abs(newY - lastTile.current.y) >= 1) {
      lastTile.current = { x: newX, y: newY };

      requestAnimationFrame(() => {
        generateTiles(newX, newY);
      });
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
      <div style={{ transform: `rotate(${-heading}rad)` }}>
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

  const velocity = useRef(new THREE.Vector3());
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

    // ================= CAMERA FIX (IMPORTANT) =================
    const camOffset = new THREE.Vector3(0, 8, 22); // 🔥 FARTHER + HIGHER
    camOffset.applyEuler(p.rotation);

    const desiredCamPos = p.position.clone().add(camOffset);

    camera.position.lerp(desiredCamPos, 0.05); // smoother follow

    // prevent clipping into plane
    const lookTarget = p.position.clone().add(new THREE.Vector3(0, 2, 0));
    camera.lookAt(lookTarget);

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

  const [center, setCenter] = useState({
    lat: 5.6037,
    lon: -0.1870,
  });

  return (
    <div style={{ width: "100vw", height: "100vh" }}>
      <Compass heading={heading} />

      <Canvas camera={{ position: [0, 10, 25], fov: 75 }}> 
        {/* 🔥 FIX: better default flight view */}
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
