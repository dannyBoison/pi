import React, { useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Sky, Cloud, useGLTF } from "@react-three/drei";
import * as THREE from "three";



// ================= PLANE =================
function Plane({ throttle, controls }) {

  const planeRef = useRef();
  const velocity = useRef(0);

  const gltf = useGLTF("/models/product.glb");

  useFrame(() => {

    if (!planeRef.current) return;

    const plane = planeRef.current;

    // acceleration
    velocity.current += (throttle * 0.002);

    // drag
    velocity.current *= 0.995;

    // forward movement
    plane.translateZ(-velocity.current);

    // lift
    if (velocity.current > 0.02) {
      plane.position.y += velocity.current * 0.2;
    }

    // descend slowly
    plane.position.y -= 0.002;

    // turn left
    if (controls.current.left) {
      plane.rotation.y += 0.02;
      plane.rotation.z = THREE.MathUtils.lerp(plane.rotation.z, 0.4, 0.1);
    }

    // turn right
    if (controls.current.right) {
      plane.rotation.y -= 0.02;
      plane.rotation.z = THREE.MathUtils.lerp(plane.rotation.z, -0.4, 0.1);
    }

    // level wings
    if (!controls.current.left && !controls.current.right) {
      plane.rotation.z = THREE.MathUtils.lerp(plane.rotation.z, 0, 0.1);
    }

    // climb
    if (controls.current.up) {
      plane.rotation.x = THREE.MathUtils.lerp(plane.rotation.x, -0.3, 0.1);
      plane.position.y += 0.1;
    }

    // descend
    if (controls.current.down) {
      plane.rotation.x = THREE.MathUtils.lerp(plane.rotation.x, 0.3, 0.1);
      plane.position.y -= 0.1;
    }

    if (!controls.current.up && !controls.current.down) {
      plane.rotation.x = THREE.MathUtils.lerp(plane.rotation.x, 0, 0.1);
    }

  });

  return <primitive ref={planeRef} object={gltf.scene} scale={0.5} />;
}



// ================= CAMERA FOLLOW =================
function FollowCamera({ target }) {

  const { camera } = useThree();

  useFrame(() => {

    if (!target.current) return;

    const plane = target.current;

    const desired = new THREE.Vector3(
      plane.position.x,
      plane.position.y + 3,
      plane.position.z + 8
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
        <planeGeometry args={[5000,5000]}/>
        <meshStandardMaterial color="#2c7a2c"/>
      </mesh>

      <Cloud position={[50,30,-100]} speed={0.2}/>
      <Cloud position={[-120,25,-200]} speed={0.2}/>
      <Cloud position={[200,40,-400]} speed={0.2}/>

    </group>

  );

}



// ================= MAIN =================
export default function AircraftSim() {

  const controls = useRef({
    left:false,
    right:false,
    up:false,
    down:false
  });

  const planeRef = useRef();

  const [throttle,setThrottle] = useState(0.3);



  // keyboard controls
  const keyDown = (e)=>{

    if(e.key==="ArrowLeft") controls.current.left=true
    if(e.key==="ArrowRight") controls.current.right=true
    if(e.key==="ArrowUp") controls.current.up=true
    if(e.key==="ArrowDown") controls.current.down=true

  }

  const keyUp = (e)=>{

    if(e.key==="ArrowLeft") controls.current.left=false
    if(e.key==="ArrowRight") controls.current.right=false
    if(e.key==="ArrowUp") controls.current.up=false
    if(e.key==="ArrowDown") controls.current.down=false

  }



  return (

<div
tabIndex={0}
onKeyDown={keyDown}
onKeyUp={keyUp}
style={{width:"100%",height:"100vh"}}
>

<Canvas camera={{ position:[0,5,12], fov:60 }}>

<ambientLight intensity={0.6}/>
<directionalLight position={[10,20,10]}/>

<Sky sunPosition={[100,20,100]}/>

<World/>

<Plane
ref={planeRef}
throttle={throttle}
controls={controls}
/>

<FollowCamera target={planeRef}/>

<OrbitControls
enablePan
enableZoom
enableRotate
/>

</Canvas>



{/* HUD */}
<div style={{
position:"absolute",
top:"20px",
left:"20px",
background:"rgba(0,0,0,0.7)",
color:"white",
padding:"10px",
borderRadius:"8px"
}}>
Throttle: {(throttle*100).toFixed(0)}%
</div>



{/* THROTTLE */}
<div style={{
position:"absolute",
bottom:"30px",
left:"50%",
transform:"translateX(-50%)",
background:"rgba(0,0,0,0.8)",
padding:"15px",
borderRadius:"10px"
}}>

<input
type="range"
min="0"
max="1"
step="0.01"
value={throttle}
onChange={(e)=>setThrottle(parseFloat(e.target.value))}
style={{width:"300px"}}
/>

</div>

</div>

  );
}
