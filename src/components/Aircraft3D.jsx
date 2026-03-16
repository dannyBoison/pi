import React, { useRef, useState, useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Sky, Cloud, useGLTF } from "@react-three/drei";
import * as THREE from "three";


// ================= PLANE =================
function Plane({ planeRef, throttle, controls, setSpeed, setAltitude, setHeading }) {

  const velocity = useRef(0);
  const gltf = useGLTF("/models/product.glb");

  useFrame(() => {

    if (!planeRef.current) return;

    const plane = planeRef.current;

    // acceleration from throttle
    velocity.current += throttle * 0.0008;

    // air drag
    velocity.current *= 0.992;

    // forward movement
    plane.translateZ(-velocity.current);

    setSpeed((velocity.current * 1200).toFixed(0));

    // lift
    if (velocity.current > 0.02) {
      plane.position.y += velocity.current * 0.15;
    }

    // gravity
    plane.position.y -= 0.002;

    setAltitude((plane.position.y * 100).toFixed(0));

    // turning
    if (controls.current.left) {
      plane.rotation.y += 0.02;
      plane.rotation.z = THREE.MathUtils.lerp(plane.rotation.z, 0.5, 0.1);
    }

    if (controls.current.right) {
      plane.rotation.y -= 0.02;
      plane.rotation.z = THREE.MathUtils.lerp(plane.rotation.z, -0.5, 0.1);
    }

    if (!controls.current.left && !controls.current.right) {
      plane.rotation.z = THREE.MathUtils.lerp(plane.rotation.z, 0, 0.1);
    }

    // climb
    if (controls.current.up) {
      plane.position.y += 0.1;
      plane.rotation.x = THREE.MathUtils.lerp(plane.rotation.x, -0.4, 0.1);
    }

    // descend
    if (controls.current.down) {
      plane.position.y -= 0.1;
      plane.rotation.x = THREE.MathUtils.lerp(plane.rotation.x, 0.4, 0.1);
    }

    if (!controls.current.up && !controls.current.down) {
      plane.rotation.x = THREE.MathUtils.lerp(plane.rotation.x, 0, 0.1);
    }

    setHeading((THREE.MathUtils.radToDeg(plane.rotation.y) % 360).toFixed(0));

  });

  return <primitive ref={planeRef} object={gltf.scene} scale={0.5} />;
}



// ================= CAMERA FOLLOW =================
function FollowCamera({ planeRef }) {

  const { camera } = useThree();

  useFrame(() => {

    if (!planeRef.current) return;

    const plane = planeRef.current;

    const desired = new THREE.Vector3(
      plane.position.x,
      plane.position.y + 4,
      plane.position.z + 12
    );

    camera.position.lerp(desired, 0.05);
    camera.lookAt(plane.position);

  });

  return null;
}



// ================= WORLD =================
function World() {

  return (

    <group>

      <mesh rotation={[-Math.PI/2,0,0]} position={[0,-2,0]}>
        <planeGeometry args={[8000,8000]} />
        <meshStandardMaterial color="#3b8f3b" />
      </mesh>

      <Cloud position={[100,40,-200]} speed={0.2}/>
      <Cloud position={[-200,35,-400]} speed={0.2}/>
      <Cloud position={[300,45,-600]} speed={0.2}/>

    </group>

  );

}



// ================= MAIN =================
export default function AircraftSim() {

  const planeRef = useRef();

  const controls = useRef({
    left:false,
    right:false,
    up:false,
    down:false
  });

  const [throttle,setThrottle] = useState(0.3);
  const [speed,setSpeed] = useState(0);
  const [altitude,setAltitude] = useState(0);
  const [heading,setHeading] = useState(0);



  // keyboard controls
  useEffect(()=>{

    const down = (e)=>{

      if(e.key==="ArrowLeft") controls.current.left=true
      if(e.key==="ArrowRight") controls.current.right=true
      if(e.key==="ArrowUp") controls.current.up=true
      if(e.key==="ArrowDown") controls.current.down=true

    }

    const up = (e)=>{

      if(e.key==="ArrowLeft") controls.current.left=false
      if(e.key==="ArrowRight") controls.current.right=false
      if(e.key==="ArrowUp") controls.current.up=false
      if(e.key==="ArrowDown") controls.current.down=false

    }

    window.addEventListener("keydown",down)
    window.addEventListener("keyup",up)

    return ()=>{
      window.removeEventListener("keydown",down)
      window.removeEventListener("keyup",up)
    }

  },[])



  return (

<div style={{width:"100%",height:"100vh"}}>

<Canvas camera={{ position:[0,6,15], fov:60 }}>

<ambientLight intensity={0.7}/>
<directionalLight position={[10,20,10]}/>

<Sky sunPosition={[100,20,100]}/>

<World/>

<Plane
planeRef={planeRef}
throttle={throttle}
controls={controls}
setSpeed={setSpeed}
setAltitude={setAltitude}
setHeading={setHeading}
/>

<FollowCamera planeRef={planeRef}/>

<OrbitControls enablePan enableZoom enableRotate/>

</Canvas>



{/* HUD */}
<div style={{
position:"absolute",
top:"20px",
left:"20px",
background:"rgba(0,0,0,0.75)",
color:"white",
padding:"12px",
borderRadius:"10px",
fontSize:"14px"
}}>

<div>Speed: {speed} km/h</div>
<div>Altitude: {altitude} ft</div>
<div>Heading: {heading}°</div>
<div>Throttle: {(throttle*100).toFixed(0)}%</div>

</div>



{/* FLIGHT CONTROLS */}
<div style={{
position:"absolute",
bottom:"40px",
left:"40px",
background:"rgba(0,0,0,0.75)",
padding:"15px",
borderRadius:"10px"
}}>

<button
onMouseDown={()=>controls.current.left=true}
onMouseUp={()=>controls.current.left=false}
>⬅</button>

<button
onMouseDown={()=>controls.current.right=true}
onMouseUp={()=>controls.current.right=false}
>➡</button>

<br/>

<button
onMouseDown={()=>controls.current.up=true}
onMouseUp={()=>controls.current.up=false}
>⬆</button>

<button
onMouseDown={()=>controls.current.down=true}
onMouseUp={()=>controls.current.down=false}
>⬇</button>

</div>



{/* THROTTLE */}
<div style={{
position:"absolute",
bottom:"40px",
right:"40px",
background:"rgba(0,0,0,0.75)",
padding:"15px",
borderRadius:"10px",
color:"white"
}}>

<div>Throttle</div>

<input
type="range"
min="0"
max="1"
step="0.01"
value={throttle}
onChange={(e)=>setThrottle(parseFloat(e.target.value))}
style={{width:"200px"}}
/>

</div>

</div>

  );

}
  
