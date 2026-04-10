import React, { useRef, useState, useEffect, Suspense } from "react";
import { Canvas, useFrame, useThree, useLoader } from "@react-three/fiber";
import { Sky, useGLTF } from "@react-three/drei";
import * as THREE from "three";

// ================= GROUND =================
function Ground({ planeRef, mapUrl }) {
  const texture = useLoader(THREE.TextureLoader, mapUrl);

  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(20, 20);

  const groundRef = useRef();

  useFrame(() => {
    if (!planeRef.current) return;

    // follow plane (infinite illusion)
    groundRef.current.position.x = planeRef.current.position.x;
    groundRef.current.position.z = planeRef.current.position.z;
  });

  return (
    <mesh ref={groundRef} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[5000, 5000]} />
      <meshStandardMaterial map={texture} />
    </mesh>
  );
}

// ================= GET TILE =================
function getTileUrl(lat, lon, zoom = 12) {
  const x = Math.floor(((lon + 180) / 360) * Math.pow(2, zoom));
  const y = Math.floor(
    ((1 -
      Math.log(
        Math.tan((lat * Math.PI) / 180) +
        1 / Math.cos((lat * Math.PI) / 180)
      ) /
      Math.PI) / 2) *
      Math.pow(2, zoom)
  );

  return `https://tile.openstreetmap.org/${zoom}/${x}/${y}.png`;
}

// ================= PLANE =================
const Plane = React.forwardRef(({ speed, setStats }, planeRef) => {
  const { camera } = useThree();
  const { scene: model } = useGLTF("/models/product.glb");

  const velocity = useRef(new THREE.Vector3(0, 0, -speed));
  const rotation = useRef({ pitch: 0, yaw: 0, roll: 0 });
  const keys = useRef({});

  useEffect(() => {
    if (!model) return;

    const box = new THREE.Box3().setFromObject(model);
    const size = new THREE.Vector3();
    box.getSize(size);

    const scale = 2 / Math.max(size.x, size.y, size.z);
    model.scale.set(scale, scale, scale);
    model.rotation.y = Math.PI;
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

    const camOffset = new THREE.Vector3(0, 2, 6).applyEuler(p.rotation);

    camera.position.lerp(p.position.clone().add(camOffset), 0.1);
    camera.lookAt(p.position);

    setStats({
      speed: speed.toFixed(2),
      altitude: p.position.y.toFixed(1),
    });
  });

  return (
    <group ref={planeRef} position={[0, 2.5, 0]}>
      <primitive object={model} />
    </group>
  );
});

// ================= MAIN =================
export default function FlightSimulation() {
  const [stats, setStats] = useState({ speed: 0, altitude: 0 });
  const planeRef = useRef();

  const [city, setCity] = useState("");
  const [mapUrl, setMapUrl] = useState(
    "https://tile.openstreetmap.org/12/2048/1362.png" // default Accra
  );

  const handleSearch = async (e) => {
    e.preventDefault();

    if (!city) return;

    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${city}`
    );
    const data = await res.json();

    if (!data.length) return alert("City not found");

    const lat = parseFloat(data[0].lat);
    const lon = parseFloat(data[0].lon);

    setMapUrl(getTileUrl(lat, lon));

    if (planeRef.current) {
      planeRef.current.position.set(0, 2.5, 0);
    }
  };

  return (
    <div style={{ width: "100vw", height: "100vh" }}>

      {/* SEARCH UI */}
      <div style={{
        position: "absolute",
        top: 20,
        left: 20,
        zIndex: 10,
        background: "#000000cc",
        padding: 15,
        borderRadius: 10,
        color: "white"
      }}>
        <form onSubmit={handleSearch}>
          <input
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="Search city (e.g Accra, Kumasi)"
            style={{ padding: 8 }}
          />
        </form>

        <p>Speed: {stats.speed}</p>
        <p>Altitude: {stats.altitude}</p>
      </div>

      <Canvas camera={{ position: [0, 2, 6] }}>
        <color attach="background" args={["#87CEEB"]} />
        <ambientLight intensity={0.6} />
        <directionalLight position={[100, 100, 50]} intensity={2} />

        <Sky sunPosition={[100, 20, 100]} />

        <Ground planeRef={planeRef} mapUrl={mapUrl} />

        <Suspense fallback={null}>
          <Plane speed={0.12} setStats={setStats} ref={planeRef} />
        </Suspense>
      </Canvas>
    </div>
  );
}
