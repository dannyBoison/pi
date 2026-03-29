import React, { useRef, useState, useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useGLTF, Sky } from "@react-three/drei";
import * as THREE from "three";

// ================= PLANE COMPONENT =================
function Plane() {
  const planeRef = useRef();
  const { camera } = useThree();

  const { scene } = useGLTF("/models/product.glb");

  // Physics states
  const velocity = useRef(new THREE.Vector3(0, 0, 0));
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
    if (keys["shift"]) throttle.current += 5 * delta; // increase speed
    if (keys["control"]) throttle.current -= 5 * delta; // decrease speed
    throttle.current = THREE.MathUtils.clamp(throttle.current, 0, 50);

    // ================= ROTATION CONTROLS =================
    const rotationSpeed = 1.0 * delta;
    if (keys["w"]) plane.rotation.x += rotationSpeed; // pitch up
    if (keys["s"]) plane.rotation.x -= rotationSpeed; // pitch down
    if (keys["a"]) plane.rotation.z += rotationSpeed; // roll left
    if (keys["d"]) plane.rotation.z -= rotationSpeed; // roll right
    if (keys["q"]) plane.rotation.y += rotationSpeed; // yaw left
    if (keys["e"]) plane.rotation.y -= rotationSpeed; // yaw right

    // ================= FORWARD MOVEMENT =================
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(plane.quaternion);
    const forwardVelocity = forward.clone().multiplyScalar(throttle.current * delta);
    velocity.current.add(forwardVelocity);

    // ================= LIFT =================
    // Lift only starts when plane speed > threshold (like takeoff)
    const speedMagnitude = velocity.current.length();
    let lift = 0;
    const takeoffSpeed = 10; // speed needed to lift
    if (speedMagnitude > takeoffSpeed) {
      lift = Math.max(0, Math.sin(-plane.rotation.x)) * speedMagnitude * 0.5;
    }

    velocity.current.y += lift * delta;

    // ================= GRAVITY =================
    velocity.current.y -= 9.8 * delta * 0.5; // simple gravity

    // ================= DRAG =================
    velocity.current.multiplyScalar(0.99);

    // ================= MOVE PLANE =================
    plane.position.add(velocity.current);

    // ================= GROUND COLLISION =================
    if (plane.position.y < 0) {
      plane.position.y = 0;
      velocity.current.y = 0;

      // Keep plane flat on ground if taxiing
      if (speedMagnitude < takeoffSpeed) {
        plane.rotation.x = 0;
      }
    }

    // ================= CAMERA FOLLOW =================
    const cameraOffset = new THREE.Vector3(0, 8, 25).applyQuaternion(plane.quaternion);
    const camPos = plane.position.clone().add(cameraOffset);
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

      {/* Runway center line */}
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
      {/* SKY & LIGHT */}
      <Sky sunPosition={[100, 50, 100]} turbidity={10} />
      <ambientLight intensity={0.5} />
      <directionalLight position={[100, 200, 50]} intensity={1.5} />

      {/* FOG */}
      <fog attach="fog" args={["#cce7ff", 200, 2000]} />

      {/* WORLD */}
      <Ground />
      <Runway />
      <Plane />
    </Canvas>
  );
}
