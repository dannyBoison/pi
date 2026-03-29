import React, { useRef, useState, useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

// ================= PLANE =================
function Plane() {
  const planeRef = useRef();
  const { camera } = useThree();

  const velocity = useRef(new THREE.Vector3());
  const rotation = useRef(new THREE.Vector3());
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
    if (!planeRef.current) return;

    // THROTTLE
    if (keys["shift"]) throttle.current += 1 * delta;
    if (keys["control"]) throttle.current -= 1 * delta;
    throttle.current = THREE.MathUtils.clamp(throttle.current, 0, 5);

    // ROTATION
    if (keys["w"]) rotation.current.x += 1 * delta;
    if (keys["s"]) rotation.current.x -= 1 * delta;
    if (keys["a"]) rotation.current.z += 1 * delta;
    if (keys["d"]) rotation.current.z -= 1 * delta;

    planeRef.current.rotation.x += rotation.current.x * delta;
    planeRef.current.rotation.z += rotation.current.z * delta;

    rotation.current.multiplyScalar(0.9);

    // FORWARD
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(
      planeRef.current.quaternion
    );

    velocity.current.add(forward.multiplyScalar(throttle.current * delta * 10));

    // LIFT + GRAVITY
    velocity.current.y += Math.sin(-planeRef.current.rotation.x) * 2 * delta;
    velocity.current.y -= 1.5 * delta;

    velocity.current.multiplyScalar(0.99);

    planeRef.current.position.add(velocity.current);

    // GROUND
    if (planeRef.current.position.y < 0) {
      planeRef.current.position.y = 0;
      velocity.current.y = 0;
    }

    // CAMERA FOLLOW
    const offset = new THREE.Vector3(0, 5, 15).applyQuaternion(
      planeRef.current.quaternion
    );

    camera.position.copy(planeRef.current.position.clone().add(offset));
    camera.lookAt(planeRef.current.position);
  });

  return (
    <mesh ref={planeRef} position={[0, 0, 0]}>
      <boxGeometry args={[1, 0.3, 2]} />
      <meshStandardMaterial />
    </mesh>
  );
}

// ================= GROUND =================
function Ground() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[10000, 10000]} />
      <meshStandardMaterial />
    </mesh>
  );
}

// ================= RUNWAY =================
function Runway() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
      <planeGeometry args={[50, 1000]} />
      <meshStandardMaterial />
    </mesh>
  );
}

// ================= APP =================
export default function App() {
  return (
    <Canvas camera={{ position: [0, 5, 15], fov: 60 }}>
      <ambientLight />
      <directionalLight position={[10, 10, 5]} />

      <Ground />
      <Runway />
      <Plane />
    </Canvas>
  );
}


I’ll debug it with you step-by-step like we’re building a real game engine 😎
