import React, { useRef, useState, useEffect } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, useGLTF } from "@react-three/drei";
import * as THREE from "three";

// ================= PLANE MODEL ===============
function PlaneModel() {
  const { scene } = useGLTF("/models/product.glb");
  const planeRef = useRef();

  const velocity = useRef(new THREE.Vector3(0, 0, 0));
  const rotation = useRef(new THREE.Vector3(0, 0, 0));

  const [keys, setKeys] = useState({});
  const throttle = useRef(0);

  // ================= CONTROLS =================
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

  // ================= FLIGHT PHYSICS =================
  useFrame((_, delta) => {
    if (!planeRef.current) return;

    // THROTTLE CONTROL
    if (keys["shift"]) throttle.current += 0.5 * delta;
    if (keys["control"]) throttle.current -= 0.5 * delta;

    throttle.current = THREE.MathUtils.clamp(throttle.current, 0, 2);

    // ROTATION CONTROLS
    if (keys["w"]) rotation.current.x += 0.8 * delta; // pitch up
    if (keys["s"]) rotation.current.x -= 0.8 * delta; // pitch down

    if (keys["a"]) rotation.current.z += 0.8 * delta; // roll left
    if (keys["d"]) rotation.current.z -= 0.8 * delta; // roll right

    if (keys["q"]) rotation.current.y += 0.6 * delta; // yaw left
    if (keys["e"]) rotation.current.y -= 0.6 * delta; // yaw right

    // APPLY ROTATION
    planeRef.current.rotation.x += rotation.current.x * delta;
    planeRef.current.rotation.y += rotation.current.y * delta;
    planeRef.current.rotation.z += rotation.current.z * delta;

    // DAMP ROTATION (smooth)
    rotation.current.multiplyScalar(0.95);

    // FORWARD DIRECTION
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(
      planeRef.current.quaternion
    );

    // LIFT (when moving forward)
    const lift = throttle.current * Math.max(0, Math.sin(-planeRef.current.rotation.x));

    // APPLY VELOCITY
    velocity.current.add(forward.multiplyScalar(throttle.current * delta * 5));
    velocity.current.y += lift * delta * 2;

    // GRAVITY
    velocity.current.y -= 1.5 * delta;

    // DRAG (slow down naturally)
    velocity.current.multiplyScalar(0.99);

    // MOVE PLANE
    planeRef.current.position.add(velocity.current);

    // GROUND (landing)
    if (planeRef.current.position.y < 0) {
      planeRef.current.position.y = 0;
      velocity.current.y = 0;
    }
  });

  return <primitive ref={planeRef} object={scene} scale={1} />;
}

// ================= SCENE =================
export default function App() {
  return (
    <Canvas camera={{ position: [0, 3, 10], fov: 60 }}>
      <ambientLight intensity={1} />
      <directionalLight position={[5, 10, 5]} />

      <PlaneModel />

      <OrbitControls />
    </Canvas>
  );
}
