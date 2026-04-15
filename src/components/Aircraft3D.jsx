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
function MiniMap({ heading }) {
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
        transform: `rotate(${-heading}rad)`
      }}>
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

// ================= GROUND (FIXED INFINITE WORLD) =================
function Ground({ planeRef, center }) {
  const zoom = 14;
  const tileSize = 120;

  const tilesRef = useRef(new Map());

  const latLonToTile = (lat, lon) => {
    const x = Math.floor(((lon + 180) / 360) * Math.pow(2, zoom));
    const y = Math.floor(
      ((1 -
        Math.log(
          Math.tan((lat * Math.PI) / 180) +
          1 / Math.cos((lat * Math.PI) / 180)
        ) / Math.PI) / 2) *
        Math.pow(2, zoom)
    );
    return { x, y };
  };

  const createTile = (x, y, baseX, baseY) => {
    const key = `${x}_${y}`;
    if (tilesRef.current.has(key)) return;

    tilesRef.current.set(key, {
      url: `https://tile.openstreetmap.org/${zoom}/${x}/${y}.png`,
      position: [(x - baseX) * tileSize, 0, (y - baseY) * tileSize],
      key
    });
  };

  const updateTiles = (baseX, baseY) => {
    const range = 8; // bigger world

    for (let i = -range; i <= range; i++) {
      for (let j = -range; j <= range; j++) {
        createTile(baseX + i, baseY + j, baseX, baseY);
      }
    }

    // cleanup far tiles
    for (let key of tilesRef.current.keys()) {
      const [x, y] = key.split("_").map(Number);
      if (
        Math.abs(x - baseX) > range + 2 ||
        Math.abs(y - baseY) > range + 2
      ) {
        tilesRef.current.delete(key);
      }
    }
  };

  useEffect(() => {
    const { x, y } = latLonToTile(center.lat, center.lon);
    updateTiles(x, y);
  }, [center]);

  return (
    <>
      {Array.from(tilesRef.current.values()).map((tile) => (
        <Tile key={tile.key} {...tile} size={tileSize} />
      ))}
    </>
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

// ================= PLANE (FIXED CAMERA START BUG) =================
const Plane = React.forwardRef(({ speed, setStats, setHeading }, planeRef) => {
  const { camera } = useThree();

  const model = useGLTF("/models/product.glb").scene;

  const velocity = useRef(new THREE.Vector3());
  const rot = useRef({ pitch: 0, yaw: 0 });
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

    // controls
    if (keys.current["a"]) rot.current.yaw += 0.01;
    if (keys.current["d"]) rot.current.yaw -= 0.01;
    if (keys.current["w"]) rot.current.pitch += 0.008;
    if (keys.current["s"]) rot.current.pitch -= 0.008;

    p.rotation.set(rot.current.pitch, rot.current.yaw, 0);

    const forward = new THREE.Vector3(0, 0, -1).applyEuler(p.rotation);
    forward.multiplyScalar(speed);

    velocity.current.lerp(forward, 0.08);
    p.position.add(velocity.current);

    setHeading(rot.current.yaw);

    // FIXED CAMERA (prevents inside-plane view)
    const camOffset = new THREE.Vector3(0, 6, 14);
    camOffset.applyEuler(p.rotation);

    camera.position.lerp(p.position.clone().add(camOffset), 0.08);
    camera.lookAt(p.position);

    setStats({
      speed: speed.toFixed(2),
      altitude: p.position.y.toFixed(1),
    });
  });

  return (
    <group ref={planeRef} position={[0, 5, 0]}>
      <primitive object={model} scale={2} />
    </group>
  );
});

// ================= MAIN =================
export default function FlightSimulation() {
  const [stats, setStats] = useState({ speed: 0, altitude: 0 });
  const [heading, setHeading] = useState(0);
  const planeRef = useRef();

  const [center] = useState({ lat: 5.6037, lon: -0.1870 });

  return (
    <div style={{ width: "100vw", height: "100vh", position: "relative" }}>
      <Compass heading={heading} />
      <MiniMap heading={heading} />

      <Canvas camera={{ position: [0, 6, 14], fov: 60 }}>
        <color attach="background" args={["#87CEEB"]} />
        <ambientLight intensity={0.7} />
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
