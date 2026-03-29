import React, { useRef, useState, useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useGLTF, Sky } from "@react-three/drei";
import * as THREE from "three";

// ================= PLANE =================
function Plane() {
  const planeRef = useRef();
  const { camera } = useThree();

  const { scene } = useGLTF("/models/product.glb");

  // PHYSICS STATES
  const velocity = useRef(new THREE.Vector3(0, 0, 0));
  const [throttle, setThrottle] = useState(0);
  const [keys, setKeys] = useState({});

  const maxThrottle = 50; // max forward speed
  const liftThreshold = 5; // min speed to start lifting

  // KEY HANDLERS
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
    if (keys["shift"]) setThrottle((t) => Math.min(t + 20 * delta, maxThrottle));
    if (keys["control"]) setThrottle((t) => Math.max(t - 20 * delta, 0));

    // ================= ROTATION CONTROLS =================
    const rotSpeed = 1.2 * delta;
    if (keys["w"]) plane.rotation.x += rotSpeed; // pitch up
    if (keys["s"]) plane.rotation.x -= rotSpeed; // pitch down
    if (keys["a"]) plane.rotation.z += rotSpeed; // roll left
    if (keys["d"]) plane.rotation.z -= rotSpeed; // roll right
    if (keys["q"]) plane.rotation.y += rotSpeed; // yaw left
    if (keys["e"]) plane.rotation.y -= rotSpeed; // yaw right

    // ================= FORWARD VELOCITY =================
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(plane.quaternion);
    const forwardVelocity = forward.clone().multiplyScalar(throttle * delta);
    velocity.current.add(forwardVelocity);

    // ================= LIFT =================
    const speed = velocity.current.length();
    let lift = 0;
    if (speed > liftThreshold) {
      // Only apply lift if moving fast enough
      lift = Math.max(0, Math.sin(-plane.rotation.x)) * speed * 0.6;
    }
    velocity.current.y += lift * delta;

    // ================= GRAVITY =================
    velocity.current.y -= 9.8 * delta * 0.5;

    // ================= DRAG =================
    velocity.current.multiplyScalar(0.99);

    // ================= MOVE PLANE =================
    plane.position.add(velocity.current);

    // ================= GROUND COLLISION =================
    if (plane.position.y < 0) {
      plane.position.y = 0;
      velocity.current.y = 0;
      // Keep plane flat on ground if taxiing
      if (speed < liftThreshold) plane.rotation.x = 0;
    }

    // ================= CAMERA FOLLOW =================
    const camOffset = new THREE.Vector3(0, 8, 25).applyQuaternion(plane.quaternion);
    const camPos = plane.position.clone().add(camOffset);
    camera.position.lerp(camPos, 0.08);
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
      {/* Main runway */}
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

      {/* THROTTLE INFO */}
      {/* Optional: you can render throttle UI later */}
    </Canvas>
  );
}
