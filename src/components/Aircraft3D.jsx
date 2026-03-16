import React, { useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Sky, Cloud, useGLTF } from "@react-three/drei";
import * as THREE from "three";



// ================= PLANE =================
function Plane({ planeRef, throttle, controls, setSpeed, setAltitude }) {

  const velocity = useRef(0);
  const gltf = useGLTF("/models/product.glb");

  useFrame(() => {

    if (!planeRef.current) return;

    const plane = planeRef.current;

    // throttle acceleration
    velocity.current += throttle * 0.0015;

    // drag
    velocity.current *= 0.995;

    setSpeed((velocity.current * 800).toFixed(0));

    // forward motion
    plane.translateZ(-velocity.current);

    // lift
    if (velocity.current > 0.02) {
      plane.position.y += velocity.current * 0.25;
    }

    // gravity
    plane.position.y -= 0.003;

    setAltitude((plane.position.y * 100).toFixed(0));

    // turning
    if (controls.current.left) {
      plane.rotation.y += 0.02;
      plane.rotation.z = THREE.MathUtils.lerp(plane.rotation.z, 0.4, 0.1);
    }

    if (controls.current.right) {
      plane.rotation.y -= 0.02;
      plane.rotation.z = THREE.MathUtils.lerp(plane.rotation.z, -0.4, 0.1);
    }

    if (!controls.current.left && !controls.current.right) {
      plane.rotation.z = THREE.MathUtils.lerp(plane.rotation.z, 0, 0.1);
    }

    // climb
    if (controls.current.up) {
      plane.rotation.x = THREE.MathUtils.lerp(plane.rotation.x, -0.3, 0.1);
      plane.position.y += 0.12;
    }

    // descend
    if (controls.current.down) {
      plane.rotation.x = THREE.MathUtils.lerp(plane.rotation.x, 0.3, 0.1);
      plane.position.y -= 0.12;
    }

    if (!controls.current.up && !controls.current.down) {
      plane.rotation.x = THREE.MathUtils.lerp(plane.rotation.x, 0, 0.1);
    }

  });

  return <primitive ref={planeRef} object={gltf.scene} scale={0.5} />;
}



// ================= CAMERA =================
function FollowCamera({ planeRef }) {

  const { camera } = useThree();

  useFrame(() => {

    if (!planeRef.current) return;

    const plane = planeRef.current;

    const target = new THREE.Vector3(
      plane.position.x,
      plane.position.y + 3,
      plane.position.z + 10
    );

    camera.position.lerp(target, 0.05);
    camera.lookAt(plane.position);

  });

  return null;

}



// ================= WORLD =================
function World() {

  return (

    <group>

      <mesh rotation={[-Math.PI/2,0,0]} position={[0,-2,0]}>
        <planeGeometry args={[6000,6000]} />
        <meshStandardMaterial color="#3a8f3a" />
      </mesh>

      <Cloud position={[80,35,-120]} speed={0.2}/>
      <Cloud position={[-150,40,-300]} speed={0.2}/>
      <Cloud position={[250,45,-500]} speed={0.2}/>

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

  const [throttle,setThrottle] = useState(0.4);
  const [speed,setSpeed] = useState(0);
  const [altitude,setAltitude] = useState(0);



  // keyboard
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
style={{width:"100%",height:"100vh",outline:"none"}}
>

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
/>

<FollowCamera planeRef={planeRef}/>

<OrbitControls enablePan enableZoom enableRotate/>

</Canvas>



{/* HUD */}
<div style={{
position:"absolute",
top:"20px",
left:"20px",
background:"rgba(0,0,0,0.7)",
color:"white",
padding:"12px",
borderRadius:"8px",
fontSize:"14px"
}}>
<div>Speed: {speed} km/h</div>
<div>Altitude: {altitude} ft</div>
<div>Throttle: {(throttle*100).toFixed(0)}%</div>
</div>



{/* JOYSTICK CONTROLS */}
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
>
⬅
</button>

<button
onMouseDown={()=>controls.current.right=true}
onMouseUp={()=>controls.current.right=false}
>
➡
</button>

<br/>

<button
onMouseDown={()=>controls.current.up=true}
onMouseUp={()=>controls.current.up=false}
>
⬆
</button>

<button
onMouseDown={()=>controls.current.down=true}
onMouseUp={()=>controls.current.down=false}
>
⬇
</button>

</div>



{/* THROTTLE LEVER */}
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
style={{height:"150px"}}
orient="vertical"
/>

</div>

</div>

  );
}
