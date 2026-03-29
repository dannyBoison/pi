import React, { useRef, useState, useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

// ================= PLANE =================
function Plane() {
  const planeRef = useRef();
  const { camera } = useThree();

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

    throttle.current = THREE.MathUtils.clamp(throttle.current, 0, 10);

    // ================= ROTATION =================
    if (keys["w"]) plane.rotation.x += 1.2 * delta; // pitch up
    if (keys["s"]) plane.rotation.x -= 1.2 * delta; // pitch down

    if (keys["a"]) plane.rotation.z += 1.2 * delta; // roll left
    if (keys["d"]) plane.rotation.z -= 1.2 * delta; // roll right

    if (keys["q"]) plane.rotation.y += 1.0 * delta; // yaw left
    if (keys["e"]) plane.rotation.y -= 1.0 * delta; // yaw right

    // ================= FORWARD =================
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(
      plane.quaternion
    );

    velocity.current.add(forward.multiplyScalar(throttle.current * delta * 20));

    // ================= LIFT =================
    const lift =
      Math.max(0, throttle.current) *
      Math.sin(-plane.rotation.x) *
      5;

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

    // ================= CAMERA FOLLOW =================
    const offset = new THREE.Vector3(0, 6, 18).applyQuaternion(
      plane.quaternion
    );

    const targetPos = plane.position.clone().add(offset);

    camera.position.lerp(targetPos, 0.1); // smooth follow
    camera.lookAt(plane.position);
  });

  return (
    <mesh ref={planeRef} position={[0, 0, 0]}>
      <boxGeometry args={[2, 0.5, 4]} />
      <meshStandardMaterial color="orange" />
    </mesh>
  );
}

// ================= HUGE GROUND =================
function Ground() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[50000, 50000]} />
      <meshStandardMaterial color="#3a7d44" />
    </mesh>
  );
}

// ================= RUNWAY =================
function Runway() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
      <planeGeometry args={[80, 2000]} />
      <meshStandardMaterial color="black" />
    </mesh>
  );
}

// ================= APP =================
export default function App() {
  return (
    <Canvas
      camera={{ position: [0, 10, 25], fov: 70 }}
      style={{ width: "100vw", height: "100vh" }}
    >
      {/* LIGHT */}
      <ambientLight intensity={0.6} />
      <directionalLight position={[100, 100, 50]} intensity={1.5} />

      {/* WORLD */}
      <Ground />
      <Runway />

      {/* PLANE */}
      <Plane />
    </Canvas>
  );
}
