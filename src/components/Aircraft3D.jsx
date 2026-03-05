import React from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, useGLTF } from "@react-three/drei";

function PlaneModel() {
  const gltf = useGLTF("/models/product.glb");
  return <primitive object={gltf.scene} scale={0.5} />;
}

export default function Aircraft3D({ selectedRegion, decision }) {
  return (
    <section style={{ height: "400px", width: "80%", margin: "50px auto" }}>
      <Canvas>
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 5]} intensity={1} />
        <PlaneModel />
        <OrbitControls />
      </Canvas>
      {selectedRegion && (
        <p style={{ textAlign: "center" }}>
          Aircraft approaching {selectedRegion.name} → Status: {decision}
        </p>
      )}
    </section>
  );
}