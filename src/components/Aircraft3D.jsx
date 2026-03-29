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
  const speed = useRef(0);
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
    if (keys["shift"]) throttle.current += 3 * delta;
    if (keys["control"]) throttle.current -= 3 * delta;

    throttle.current = THREE.MathUtils.clamp(throttle.current, 0, 20);

    // ================= SPEED BUILD-UP =================
    speed.current += (throttle.current - speed.current) * 0.02;

    // ================= ROTATION =================
    if (keys["w"]) plane.rotation.x += 0.8 * delta;
    if (keys["s"]) plane.rotation.x -= 0.8 * delta;

    if (keys["a"]) plane.rotation.z += 1.2 * delta;
    if (keys["d"]) plane.rotation.z -= 1.2 * delta;

    if (keys["q"]) plane.rotation.y += 0.8 * delta;
    if (keys["e"]) plane.rotation.y -= 0.8 * delta;

    // ================= FORWARD =================
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(
      plane.quaternion
    );

    velocity.current.add(forward.multiplyScalar(speed.current * delta * 10));

    // ================= TAKEOFF LOGIC =================
    let lift = 0;

    if (speed.current > 8) {
      lift =
        Math.sin(-plane.rotation.x) *
        speed.current *
        0.8;
    }

    velocity.current.y += lift * delta;

    // ================= GRAVITY =================
    velocity.current.y -= 5 * delta;

    // ================= DRAG =================
    velocity.current.multiplyScalar(0.99);

    // ================= MOVE =================
    plane.position.add(velocity.current);

    // ================= GROUND BEHAVIOR =================
    if (plane.position.y <= 0) {
      plane.position.y = 0;
      velocity.current.y = 0;

      // prevent lift if not fast enough
      if (speed.current < 8) {
        plane.rotation.x = 0;
      }
    }

    // ================= CAMERA =================
    const offset = new THREE.Vector3(0, 6, 25).applyQuaternion(
      plane.quaternion
    );

    const camPos = plane.position.clone().add(offset);

    camera.position.lerp(camPos, 0.08);
    camera.lookAt(plane.position);
  });

  return (
    <group ref={planeRef} position={[0, 0, 0]}>
      <primitive object={scene} scale={0.25} rotation={[0, Math.PI, 0]} />
    </group>
  );
}

// ================= BETTER GROUND =================
function Ground() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[200000, 200000]} />
      <meshStandardMaterial color="#6c9a4f" />
    </mesh>
  );
}

// ================= RUNWAY =================
function Runway() {
  return (
    <group>
      {/* runway */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[120, 4000]} />
        <meshStandardMaterial color="#1f1f1f" />
      </mesh>

      {/* center stripes */}
      {[...Array(80)].map((_, i) => (
        <mesh
          key={i}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, 0.02, -1800 + i * 50]}
        >
          <planeGeometry args={[6, 25]} />
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
      camera={{ position: [0, 15, 40], fov: 75 }}
      style={{ width: "100vw", height: "100vh" }}
    >
      {/* SKY */}
      <Sky sunPosition={[100, 50, 100]} turbidity={10} />

      {/* FOG */}
      <fog attach="fog" args={["#cce7ff", 500, 50000]} />

      {/* LIGHT */}
      <ambientLight intensity={0.5} />
      <directionalLight position={[200, 300, 100]} intensity={2} />

      {/* WORLD */}
      <Ground />
      <Runway />

      {/* PLANE */}
      <Plane />
    </Canvas>
  );
}
