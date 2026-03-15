import React, { useState, useEffect, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Sky, Cloud, useGLTF } from "@react-three/drei";



// ================= WORLD =================
function World({ planeRef }) {

  const worldRef = useRef();

  useFrame(() => {

    if (!planeRef.current || !worldRef.current) return;

    const plane = planeRef.current;

    worldRef.current.position.x = -plane.position.x;
    worldRef.current.position.z = -plane.position.z;

  });

  return (

    <group ref={worldRef}>

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -2, 0]}>
        <planeGeometry args={[2000, 2000]} />
        <meshStandardMaterial color="#1f7a1f" />
      </mesh>

      <Cloud position={[30, 20, -40]} speed={0.2}/>
      <Cloud position={[-50, 25, -80]} speed={0.2}/>
      <Cloud position={[60, 18, -120]} speed={0.2}/>
      <Cloud position={[120, 30, -200]} speed={0.15}/>

    </group>

  );
}



// ================= CAMERA FOLLOW =================
function FollowCamera({ planeRef }) {

  const { camera } = useThree();

  useFrame(() => {

    if (!planeRef.current) return;

    const plane = planeRef.current;

    const target = {
      x: plane.position.x,
      y: plane.position.y + 4,
      z: plane.position.z + 12
    };

    camera.position.lerp(target, 0.05);

    camera.lookAt(
      plane.position.x,
      plane.position.y,
      plane.position.z
    );

  });

  return null;

}



// ================= PLANE =================
function PlaneModel({ controls, planeRef }) {

  const gltf = useGLTF("/models/product.glb");

  useFrame(() => {

    if (!planeRef.current) return;

    const plane = planeRef.current;

    if (controls.engineOff) return;

    plane.translateZ(-controls.speed);

    if (controls.left) {
      plane.rotation.y += 0.02;
      plane.rotation.z = 0.35;
    }

    if (controls.right) {
      plane.rotation.y -= 0.02;
      plane.rotation.z = -0.35;
    }

    if (!controls.left && !controls.right) {
      plane.rotation.z *= 0.9;
    }

    if (controls.climb) {
      plane.position.y += 0.06;
      plane.rotation.x = -0.3;
    }

    if (controls.descend) {
      plane.position.y -= 0.06;
      plane.rotation.x = 0.3;
    }

    if (!controls.climb && !controls.descend) {
      plane.rotation.x *= 0.9;
    }

  });

  return <primitive ref={planeRef} object={gltf.scene} scale={0.5} />;

}



// ================= MAIN =================
export default function Aircraft3D() {

  const planeRef = useRef();

  const [speed, setSpeed] = useState(0.05);
  const [altitude, setAltitude] = useState(0);
  const [heading, setHeading] = useState(0);
  const [fuel, setFuel] = useState(100);
  const [autopilot, setAutopilot] = useState(false);
  const [warning, setWarning] = useState("");

  const controls = useRef({
    left:false,
    right:false,
    climb:false,
    descend:false,
    speed:0.05,
    engineOff:false
  });



  useEffect(()=>{
    controls.current.speed = speed;
  },[speed]);



  // ================= FUEL SYSTEM =================
  useEffect(()=>{

    const fuelTimer = setInterval(()=>{

      setFuel(f=>{
        if(f<=0){
          controls.current.engineOff=true
          setWarning("ENGINE FAILURE - OUT OF FUEL")
          return 0
        }
        return f - 0.05
      })

    },200)

    return ()=>clearInterval(fuelTimer)

  },[])



  // ================= STALL WARNING =================
  useEffect(()=>{

    if(speed < 0.02 && altitude > 500){

      setWarning("STALL WARNING")

    }else{

      setWarning("")

    }

  },[speed, altitude])



  // ================= CONTROLS =================
  const turnLeft = ()=>{
    if(autopilot) return
    controls.current.left = true;
    setHeading(h=>h-5);
  }

  const stopLeft = ()=> controls.current.left=false;

  const turnRight = ()=>{
    if(autopilot) return
    controls.current.right = true;
    setHeading(h=>h+5);
  }

  const stopRight = ()=> controls.current.right=false;

  const climb = ()=>{
    if(autopilot) return
    controls.current.climb=true;
    setAltitude(a=>a+100);
  }

  const stopClimb = ()=> controls.current.climb=false;

  const descend = ()=>{
    if(autopilot) return
    controls.current.descend=true;
    setAltitude(a=>a-100);
  }

  const stopDescend = ()=> controls.current.descend=false;



  // ================= AUTOPILOT =================
  const toggleAutopilot = ()=>{

    setAutopilot(a=>!a)

    if(!autopilot){
      controls.current.left=false
      controls.current.right=false
      controls.current.climb=false
      controls.current.descend=false
    }

  }



  return (

<section style={{width:"95%",margin:"20px auto",fontFamily:"sans-serif"}}>

<div
style={{
height:"580px",
border:"3px solid #0ea5e9",
borderRadius:"12px",
position:"relative",
overflow:"hidden"
}}
>

<Canvas camera={{ position:[0,4,10], fov:60 }}>

<ambientLight intensity={0.6}/>
<directionalLight position={[10,10,5]}/>

<Sky sunPosition={[100,20,100]}/>

<World planeRef={planeRef}/>

<PlaneModel controls={controls.current} planeRef={planeRef}/>

<FollowCamera planeRef={planeRef}/>

<OrbitControls
enablePan={true}
enableZoom={true}
enableRotate={true}
/>

</Canvas>



{/* HUD */}
<div
style={{
position:"absolute",
top:"10px",
left:"10px",
background:"rgba(0,0,0,0.7)",
color:"white",
padding:"12px",
borderRadius:"8px",
fontSize:"14px"
}}
>

<div>Speed: {(speed*1000).toFixed(0)} km/h</div>
<div>Altitude: {altitude} ft</div>
<div>Heading: {heading}°</div>
<div>Fuel: {fuel.toFixed(1)}%</div>
<div>Autopilot: {autopilot ? "ON" : "OFF"}</div>

{warning && (
<div style={{color:"red",marginTop:"5px"}}>
⚠ {warning}
</div>
)}

</div>



{/* CONTROL PANEL */}
<div
style={{
position:"absolute",
bottom:"10px",
left:"50%",
transform:"translateX(-50%)",
background:"rgba(0,0,0,0.75)",
padding:"12px",
borderRadius:"10px",
color:"white",
width:"340px",
textAlign:"center"
}}
>

<div>Throttle</div>

<input
type="range"
min="0.01"
max="0.25"
step="0.005"
value={speed}
onChange={(e)=>setSpeed(parseFloat(e.target.value))}
style={{width:"100%"}}
/>

<div
style={{
marginTop:"10px",
display:"grid",
gridTemplateColumns:"1fr 1fr",
gap:"6px"
}}
>

<button onMouseDown={turnLeft} onMouseUp={stopLeft}>⬅ Turn</button>

<button onMouseDown={turnRight} onMouseUp={stopRight}>Turn ➡</button>

<button onMouseDown={climb} onMouseUp={stopClimb}>Climb</button>

<button onMouseDown={descend} onMouseUp={stopDescend}>Descend</button>

</div>

<button
onClick={toggleAutopilot}
style={{
marginTop:"8px",
width:"100%",
background:"#0ea5e9",
border:"none",
padding:"6px",
color:"white",
borderRadius:"5px"
}}
>
Toggle Autopilot
</button>

</div>

</div>

</section>

  );

}
