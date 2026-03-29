import React, { useRef, useState, useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useGLTF, Sky } from "@react-three/drei";
import * as THREE from "three";

// ================= PLANE =================
function Plane() {
  const planeRef = useRef();
  const { camera } = useThree();

  const { scene } = useGLTF("/models/product.glb");

  const velocity = useRef(new THREE.Vector3());
  const throttle = useRef(0);
  const [keys, setKeys] = useState({});

  useEffect(() => {
    const down = (e) => setKeys((k) => ({ ...k, [e.key.toLowerCase()]: true }));
    const up = (e) => setKeys((k) => ({ ...k, [e.key.toLowerCase()]: false }));

    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);

    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  useFrame((_, delta) => {
    const plane = planeRef.current;
    if (!plane) return;

    // ================= THROTTLE =================
    if (keys["shift"]) throttle.current += 2 * delta;
    if (keys["control"]) throttle.current -= 2 * delta;
    throttle.current = THREE.MathUtils.clamp(throttle.current, 0, 12);

    // ================= ROTATION =================
    if (keys["w"]) plane.rotation.x += 1.2 * delta;
    if (keys["s"]) plane.rotation.x -= 1.2 * delta;

    if (keys["a"]) plane.rotation.z += 1.2 * delta;
    if (keys["d"]) plane.rotation.z -= 1.2 * delta;

    if (keys["q"]) plane.rotation.y += 1.0 * delta;
    if (keys["e"]) plane.rotation.y -= 1.0 * delta;

    // ================= FIX DIRECTION =================
    // Make plane face forward (VERY IMPORTANT)
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(
      plane.quaternion
    );

    velocity.current.add(forward.multiplyScalar(throttle.current * delta * 25));

    // ================= LIFT =================
    const lift =
      Math.max(0, throttle.current) *
      Math.sin(-plane.rotation.x) *
      6;

    velocity.current.y += lift * delta;

    // ================= GRAVITY =================
    velocity.current.y -= 3 * delta;

    // ================= DRAG =================
    velocity.current.multiplyScalar(0.995);

    // ================= MOVE =================
    plane.position.add(velocity.current);

    // ================= GROUND =================
    if (plane.position.y < 0) {
      plane.position.y = 0;
      velocity.current.y = 0;
    }

    // ================= CAMERA =================
    const offset = new THREE.Vector3(0, 5, 20).applyQuaternion(
      plane.quaternion
    );

    const target = plane.position.clone().add(offset);

    camera.position.lerp(target, 0.08);
    camera.lookAt(plane.position);
  });

  return (
    <group ref={planeRef} position={[0, 1, 0]}>
      {/* 🔥 ROTATE MODEL TO FACE FORWARD */}
      <primitive object={scene} scale={0.2} rotation={[0, Math.PI, 0]} />
    </group>
  );
}

// ================= REALISTIC GROUND =================
function Ground() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[100000, 100000]} />
      <meshStandardMaterial color="#4c7c3a" />
    </mesh>
  );
}

// ================= RUNWAY WITH MARKINGS =================
function Runway() {
  return (
    <group>
      {/* Runway */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <planeGeometry args={[100, 3000]} />
        <meshStandardMaterial color="#222" />
      </mesh>

      {/* Center line */}
      {[...Array(50)].map((_, i) => (
        <mesh
          key={i}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, 0.03, -1400 + i * 60]}
        >
          <planeGeometry args={[5, 30]} />
          <meshStandardMaterial color="white" />
        </mesh>
      ))}
    </group>
  );
}

// ================= APP =================
export default function App() {
  return (
    <Canvas
      camera={{ position: [0, 10, 30], fov: 70 }}
      style={{ width: "100vw", height: "100vh" }}
    >
      {/* SKY */}
      <Sky sunPosition={[100, 20, 100]} />

      {/* FOG (DEPTH FEEL) */}
      <fog attach="fog" args={["#bcdff5", 200, 20000]} />

      {/* LIGHT */}
      <ambientLight intensity={0.5} />
      <directionalLight position={[100, 200, 100]} intensity={1.5} />

      {/* WORLD */}
      <Ground />
      <Runway />

      {/* PLANE */}
      <Plane />
    </Canvas>
  );
}
