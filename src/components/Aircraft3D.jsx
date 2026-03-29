import React, { useRef, useState, useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useGLTF, Sky } from "@react-three/drei";
import * as THREE from "three";

// ================= PLANE MODEL ===============
function PlaneModel() {
  const { scene } = useGLTF("/models/product.glb");
  const planeRef = useRef();
  const { camera } = useThree();

  const velocity = useRef(new THREE.Vector3(0, 0, 0));
  const rotation = useRef(new THREE.Vector3(0, 0, 0));

  const [keys, setKeys] = useState({});
  const throttle = useRef(0);

  // CONTROLS
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
    if (keys["shift"]) throttle.current += 0.5 * delta;
    if (keys["control"]) throttle.current -= 0.5 * delta;
    throttle.current = THREE.MathUtils.clamp(throttle.current, 0, 3);

    // ROTATION
    if (keys["w"]) rotation.current.x += 0.8 * delta;
    if (keys["s"]) rotation.current.x -= 0.8 * delta;

    if (keys["a"]) rotation.current.z += 0.8 * delta;
    if (keys["d"]) rotation.current.z -= 0.8 * delta;

    if (keys["q"]) rotation.current.y += 0.6 * delta;
    if (keys["e"]) rotation.current.y -= 0.6 * delta;

    planeRef.current.rotation.x += rotation.current.x * delta;
    planeRef.current.rotation.y += rotation.current.y * delta;
    planeRef.current.rotation.z += rotation.current.z * delta;

    rotation.current.multiplyScalar(0.95);

    // FORWARD
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(
      planeRef.current.quaternion
    );

    const lift =
      throttle.current *
      Math.max(0, Math.sin(-planeRef.current.rotation.x));

    velocity.current.add(forward.multiplyScalar(throttle.current * delta * 10));
    velocity.current.y += lift * delta * 3;

    velocity.current.y -= 1.5 * delta;
    velocity.current.multiplyScalar(0.995);

    planeRef.current.position.add(velocity.current);

    // GROUND
    if (planeRef.current.position.y < 0) {
      planeRef.current.position.y = 0;
      velocity.current.y = 0;
    }

    // 🎥 FOLLOW CAMERA
    const camOffset = new THREE.Vector3(0, 3, 10)
      .applyQuaternion(planeRef.current.quaternion);

    camera.position.copy(
      planeRef.current.position.clone().add(camOffset)
    );

    camera.lookAt(planeRef.current.position);
  });

  return (
    <primitive
      ref={planeRef}
      object={scene}
      scale={1.5}
      position={[0, 0, 0]}
    />
  );
}

// ================= GROUND =================
function Ground() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
      <planeGeometry args={[10000, 10000]} />
      <meshStandardMaterial color="#3b7d3b" />
    </mesh>
  );
}

// ================= RUNWAY =================
function Runway() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
      <planeGeometry args={[50, 1000]} />
      <meshStandardMaterial color="black" />
    </mesh>
  );
}

// ================= SCENE =================
export default function App() {
  return (
    <Canvas camera={{ position: [0, 5, 15], fov: 60 }}>
      {/* LIGHT */}
      <ambientLight intensity={0.5} />
      <directionalLight position={[100, 100, 50]} intensity={1} />

      {/* SKY */}
      <Sky sunPosition={[100, 20, 100]} />

      {/* WORLD */}
      <Ground />
      <Runway />

      {/* PLANE */}
      <PlaneModel />
    </Canvas>
  );
}
