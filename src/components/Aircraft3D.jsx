import React, { useState, useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, useGLTF } from "@react-three/drei";


// ================= PLANE MODEL =================
function PlaneModel({ position, rotation }) {

  const gltf = useGLTF("/models/product.glb");

  return (
    <primitive
      object={gltf.scene}
      scale={0.5}
      position={position}
      rotation={rotation}
    />
  );
}



// ================= MAIN SIM =================
export default function Aircraft3D({ selectedRegion, decision }) {

  const [position, setPosition] = useState([0, 0, 0]);
  const [rotation, setRotation] = useState([0, 0, 0]);
  const [controlMode, setControlMode] = useState(false);



  // ================= KEYBOARD CONTROLS =================
  useEffect(() => {

    const handleKey = (e) => {

      if (!controlMode) return;

      let [x, y, z] = position;
      let [rx, ry, rz] = rotation;

      const speed = 0.3;

      switch (e.key.toLowerCase()) {

        case "w": // forward
          z -= speed;
          break;

        case "s": // backward
          z += speed;
          break;

        case "a": // turn left
          ry += 0.1;
          break;

        case "d": // turn right
          ry -= 0.1;
          break;

        case "z": // climb
          y += speed;
          break;

        case "escape": // exit sim
          setControlMode(false);
          alert("Exited simulation");
          return;

        default:
          return;
      }

      setPosition([x, y, z]);
      setRotation([rx, ry, rz]);

    };

    window.addEventListener("keydown", handleKey);

    return () => window.removeEventListener("keydown", handleKey);

  }, [position, rotation, controlMode]);



  // ================= ENTER SIM =================
  const startSimulation = () => {

    alert(
      "Aircraft Control Mode\n\n" +
      "W = Forward\n" +
      "S = Backward\n" +
      "A = Turn Left\n" +
      "D = Turn Right\n" +
      "Z = Climb\n\n" +
      "Press ESC to exit"
    );

    setControlMode(true);

  };



  return (

    <section
      style={{
        height: "450px",
        width: "80%",
        margin: "50px auto"
      }}
    >

      <div
        onClick={startSimulation}
        style={{
          height: "100%",
          border: "3px solid #0ea5e9",
          borderRadius: "10px",
          cursor: "pointer"
        }}
      >

        <Canvas camera={{ position: [0, 2, 6] }}>

          <ambientLight intensity={0.5} />
          <directionalLight position={[10, 10, 5]} intensity={1} />

          <PlaneModel
            position={position}
            rotation={rotation}
          />

          <OrbitControls />

        </Canvas>

      </div>



      {/* REGION STATUS */}
      {selectedRegion && (
        <p style={{ textAlign: "center", marginTop: "10px" }}>
          Aircraft approaching {selectedRegion.name} → Status: {decision}
        </p>
      )}

    </section>
  );
}
