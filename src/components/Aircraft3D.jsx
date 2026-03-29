import React, { useRef, useState, useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useGLTF, Sky } from "@react-three/drei";
import * as THREE from "three";

// ================= PLANE =================
function Plane() {
  const planeRef = useRef();
  const { camera } = useThree();

  const { scene } = useGLTF("/models/product.glb");

  const velocity = useRef(new THREE.Vector3(0, 0, 0));
  const [throttle, setThrottle] = useState(0);
  const [keys, setKeys] = useState({});

  const maxThrottle = 50;
  const liftThreshold = 10;

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
    if (keys["w"]) setThrottle((t) => Math.min(t + 30 * delta, maxThrottle));
    if (keys["s"]) setThrottle((t) => Math.max(t - 30 * delta, 0));

    // ================= ROTATION =================
    const rotSpeed = 1.5 * delta;
    if (keys["a"]) plane.rotation.z += rotSpeed; // roll left
    if (keys["d"]) plane.rotation.z -= rotSpeed; // roll right
    if (keys["q"]) plane.rotation.y += rotSpeed; // yaw left
    if (keys["e"]) plane.rotation.y -= rotSpeed; // yaw right
    if (keys["arrowup"]) plane.rotation.x += rotSpeed; // pitch up
    if (keys["arrowdown"]) plane.rotation.x -= rotSpeed; // pitch down

    // ================= FORWARD =================
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(plane.quaternion);
    const forwardVelocity = forward.clone().multiplyScalar(throttle * delta);
    velocity.current.add(forwardVelocity);

    // ================= LIFT =================
    const speed = velocity.current.length();
    let lift = 0;
    if (speed > liftThreshold) {
      lift = Math.sin(-plane.rotation.x) * speed * 0.3;
    }
    velocity.current.y += lift * delta;

    // ================= GRAVITY =================
    velocity.current.y -= 9.8 * delta * 0.3;

    // ================= DRAG =================
    velocity.current.multiplyScalar(0.98);

    // ================= MOVE PLANE =================
    plane.position.add(velocity.current);

    // ================= GROUND COLLISION =================
    if (plane.position.y < 0) {
      plane.position.y = 0;
      velocity.current.y = 0;
      if (speed < liftThreshold) plane.rotation.x = 0;
    }

    // ================= CAMERA FOLLOW =================
    // Camera offset behind and above the plane
    const camOffset = new THREE.Vector3(0, 8, 20).applyQuaternion(plane.quaternion);
    const camTarget = plane.position.clone().add(camOffset);

    // Smooth lerp for smooth following
    camera.position.lerp(camTarget, 0.08);

    // Look at plane position
    camera.lookAt(plane.position);
  });

  return (
    <group ref={planeRef} position={[0, 0, 0]}>
      <primitive object={scene} scale={0.25} rotation={[0, Math.PI, 0]} />
    </group>
  );
}

// ================= GROUND =================
function Ground() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[2000, 10000]} />
      <meshStandardMaterial color="#4c7c3a" />
    </mesh>
  );
}

// ================= RUNWAY =================
function Runway() {
  return (
    <group>
      {/* Runway */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <planeGeometry args={[20, 500]} />
        <meshStandardMaterial color="#222" />
      </mesh>

      {/* Center line */}
      {[...Array(25)].map((_, i) => (
        <mesh
          key={i}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, 0.02, -240 + i * 20]}
        >
          <planeGeometry args={[1, 15]} />
          <meshStandardMaterial color="white" />
        </mesh>
      ))}
    </group>
  );
}

// ================= APP =================
export default function App() {
  return (
    <Canvas camera={{ position: [0, 10, 40], fov: 75 }} style={{ width: "100vw", height: "100vh" }}>
      <Sky sunPosition={[100, 50, 100]} turbidity={10} />
      <ambientLight intensity={0.5} />
      <directionalLight position={[100, 200, 50]} intensity={1.5} />
      <fog attach="fog" args={["#cce7ff", 200, 2000]} />

      <Ground />
      <Runway />
      <Plane />
    </Canvas>
  );
}
