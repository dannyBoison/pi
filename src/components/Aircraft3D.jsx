import React, { useRef, useState, useEffect, Suspense, useMemo } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import mapboxgl from "mapbox-gl";
import { Sky, useGLTF, useTexture } from "@react-three/drei";
import * as THREE from "three";

// ================= TEXTURE CACHE =================
const textureCache = new Map();

function getTexture(url) {
  if (textureCache.has(url)) return textureCache.get(url);
  const tex = new THREE.TextureLoader().load(url);
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.anisotropy = 4; // 🔥 reduced for performance
  textureCache.set(url, tex);
  return tex;
}

// ================= TILE =================
function Tile({ url, position, size }) {
  const texture = useMemo(() => getTexture(url), [url]);

  return (
    <mesh position={position} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[size, size]} />
      <meshStandardMaterial map={texture} />
    </mesh>
  );
}

// ================= GROUND =================
function Ground({ planeRef, center }) {
  const zoom = 14;
  const tileSize = 120;

  const groupRef = useRef();
  const tilesRef = useRef(new Map());
  const dirtyRef = useRef(false);
  const lastUpdateRef = useRef(0);

  const [tiles, setTiles] = useState([]);

  const maxTile = Math.pow(2, zoom);

  const normalizeTile = (x, y) => {
    x = ((x % maxTile) + maxTile) % maxTile;
    if (y < 0 || y >= maxTile) return null;
    return { x, y };
  };

  const latLonToTile = (lat, lon) => {
    const x = Math.floor(((lon + 180) / 360) * maxTile);
    const y = Math.floor(
      ((1 -
        Math.log(
          Math.tan((lat * Math.PI) / 180) +
          1 / Math.cos((lat * Math.PI) / 180)
        ) /
        Math.PI) /
        2) *
        maxTile
    );
    return { x, y };
  };

  const addTile = (x, y, baseX, baseY) => {
    const normalized = normalizeTile(x, y);
    if (!normalized) return;

    const key = `${normalized.x},${normalized.y}`;
    if (tilesRef.current.has(key)) return;

    const worldX = (x - baseX) * tileSize;
    const worldZ = (y - baseY) * tileSize;

    tilesRef.current.set(key, {
      key,
      url: `https://tile.openstreetmap.org/${zoom}/${normalized.x}/${normalized.y}.png`,
      position: [worldX, 0, worldZ],
    });

    dirtyRef.current = true;
  };

  const removeFarTiles = (planeX, planeZ) => {
    const maxDistance = tileSize * 12;

    tilesRef.current.forEach((tile, key) => {
      const dx = tile.position[0] - planeX;
      const dz = tile.position[2] - planeZ;

      if (Math.abs(dx) > maxDistance || Math.abs(dz) > maxDistance) {
        tilesRef.current.delete(key);
        dirtyRef.current = true;
      }
    });
  };

  const updateTiles = (planePos, baseTile) => {
    const range = 7;

    for (let i = -range; i <= range; i++) {
      for (let j = -range; j <= range; j++) {
        addTile(baseTile.x + i, baseTile.y + j, baseTile.x, baseTile.y);
      }
    }

    removeFarTiles(planePos.x, planePos.z);
  };

  const baseTileRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const t = latLonToTile(center.lat, center.lon);
    baseTileRef.current = t;
    tilesRef.current.clear();
    dirtyRef.current = true;
  }, [center]);

  useFrame(({ clock }) => {
    if (!planeRef.current || !groupRef.current) return;

    const now = clock.elapsedTime;

    // 🔥 throttle tile updates (0.5s)
    if (now - lastUpdateRef.current < 0.5) return;
    lastUpdateRef.current = now;

    const p = planeRef.current.position;

    const moveX = Math.floor(p.x / tileSize);
    const moveZ = Math.floor(p.z / tileSize);

    const baseTile = {
      x: baseTileRef.current.x + moveX,
      y: baseTileRef.current.y + moveZ,
    };

    updateTiles(p, baseTile);

    if (dirtyRef.current) {
      dirtyRef.current = false;
      setTiles(Array.from(tilesRef.current.values()));
    }
  });

  return (
    <group ref={groupRef}>
      {tiles.map((tile) => (
        <Tile key={tile.key} {...tile} size={tileSize} />
      ))}
    </group>
  );
}

// ================= MINIMAP =================
function Minimap({ planeRef, heading, center }) {
  const mapContainer = useRef(null);
  const mapRef = useRef(null);
  const planeMarker = useRef(null);

  mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;

  const centerRef = useRef(center);
  const headingRef = useRef(heading);

  useEffect(() => {
    centerRef.current = center;
  }, [center]);

  useEffect(() => {
    headingRef.current = heading;
  }, [heading]);

  useEffect(() => {
    if (mapRef.current) return;

    mapRef.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/satellite-v9",
      center: [center.lon, center.lat],
      zoom: 14,
      pitch: 0,
      interactive: false,
    });

    const el = document.createElement("div");
    el.style.width = "0";
    el.style.height = "0";
    el.style.borderLeft = "7px solid transparent";
    el.style.borderRight = "7px solid transparent";
    el.style.borderBottom = "14px solid red";

    planeMarker.current = new mapboxgl.Marker(el)
      .setLngLat([center.lon, center.lat])
      .addTo(mapRef.current);
  }, []);

  useEffect(() => {
    if (!mapRef.current || !planeRef.current) return;

    let frameId;
    let last = 0;

    const update = (t) => {
      if (t - last > 50) { // 🔥 20fps throttle
        last = t;

        const p = planeRef.current.position;
        const c = centerRef.current;

        const lon = c.lon + p.x * 0.0003;
        const lat = c.lat + p.z * 0.0003;

        mapRef.current.setCenter([lon, lat]);
        planeMarker.current?.setLngLat([lon, lat]);

        mapRef.current.setBearing(
          -headingRef.current * (180 / Math.PI)
        );
      }

      frameId = requestAnimationFrame(update);
    };

    update(0);

    return () => cancelAnimationFrame(frameId);
  }, []);

  return (
    <div
      ref={mapContainer}
      style={{
        position: "absolute",
        bottom: 20,
        left: 20,
        width: 180,
        height: 180,
        borderRadius: "50%",
        overflow: "hidden",
        border: "3px solid white",
        zIndex: 100,
      }}
    />
  );
}

// ================= COMPASS =================
function Compass({ heading }) {
  return (
    <div style={{
      position: "absolute",
      top: 20,
      left: "50%",
      transform: "translateX(-50%)",
      width: 120,
      height: 120,
      borderRadius: "50%",
      background: "#000000cc",
      color: "white",
      zIndex: 100,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontWeight: "bold"
    }}>
      <div style={{
        position: "relative",
        transform: `rotate(${-heading}rad)`,
        transition: "transform 0.1s linear"
      }}>
        N
        <div style={{ position: "absolute", right: -40, top: 0 }}>E</div>
        <div style={{ position: "absolute", bottom: -40, left: 0 }}>S</div>
        <div style={{ position: "absolute", left: -40, top: 0 }}>W</div>
      </div>
    </div>
  );
}


// ================= NAVIGATION =================
function worldToLatLon(x, z, center) {
  const scale = 0.0001;
  return {
    lat: center.lat + z * scale,
    lon: center.lon + x * scale,
  };
}



// ================= PLANE =================
const Plane = React.forwardRef(({ speed, setStats, setHeading, center, destination }, planeRef) => {
  const { camera } = useThree();

  let model;
  try {
    model = useGLTF("/models/product.glb").scene;
  } catch {
    model = null;
  }

  const velocity = useRef(new THREE.Vector3(0, 0, -speed));
  const rotation = useRef({ pitch: 0, yaw: 0, roll: 0 });
  const keys = useRef({});

  const statsRef = useRef({ speed: 0, altitude: 0 });
  const headingRef = useRef(0);
  const lastUIUpdate = useRef(0);

  useEffect(() => {
    if (model) {
      const box = new THREE.Box3().setFromObject(model);
      const size = new THREE.Vector3();
      box.getSize(size);
      const scale = 2 / Math.max(size.x, size.y, size.z);
      model.scale.set(scale, scale, scale);
      model.rotation.y = Math.PI;
    }
  }, [model]);

  useEffect(() => {
    const down = (e) => (keys.current[e.key.toLowerCase()] = true);
    const up = (e) => (keys.current[e.key.toLowerCase()] = false);

    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);

    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  useFrame(() => {
    const p = planeRef.current;
    if (!p) return;

    if (keys.current["a"]) rotation.current.yaw += 0.01;
    if (keys.current["d"]) rotation.current.yaw -= 0.01;
    if (keys.current["w"]) rotation.current.pitch += 0.008;
    if (keys.current["s"]) rotation.current.pitch -= 0.008;

    

    p.rotation.set(
      rotation.current.pitch,
      rotation.current.yaw,
      rotation.current.roll
    );



// ✈️ AUTOPILOT (FIXED + STABLE)
if (destination) {
  const scale = 0.0001;

  // convert plane world position → pseudo lat/lon
  const currentLat = center.lat + p.position.z * scale;
  const currentLon = center.lon + p.position.x * scale;

  const dx = destination.lon - currentLon;
  const dz = destination.lat - currentLat;

  const targetAngle = Math.atan2(dx, dz);

  // smooth turning
  rotation.current.yaw += (targetAngle - rotation.current.yaw) * 0.05;

  // move forward stronger when autopilot is active
  const forwardBoost = 1.2;

  const distance = Math.sqrt(dx * dx + dz * dz);

  // stop condition (prevents infinite drift)
  if (distance < 0.0008) {
    velocity.current.set(0, 0, 0);
    return;
  }

  // optional: log progress
  // console.log("Distance:", distance);
}

    

    const forward = new THREE.Vector3(0, 0, -1).applyEuler(p.rotation);
    const autoMultiplier = destination ? 1.5 : 1;
forward.multiplyScalar(speed * autoMultiplier);

    velocity.current.lerp(forward, 0.05);
    p.position.add(velocity.current);

    headingRef.current = rotation.current.yaw;

    const camOffset = new THREE.Vector3(0, 4, 10);
    camOffset.applyEuler(p.rotation);

    camera.position.lerp(
      p.position.clone().add(camOffset),
      0.08
    );

    camera.lookAt(p.position.clone().add(new THREE.Vector3(0, 1, 0)));

    // 🔥 throttle UI updates (5fps)
    const now = performance.now();
    if (now - lastUIUpdate.current > 200) {
      lastUIUpdate.current = now;

      setStats({
        speed: speed.toFixed(2),
        altitude: p.position.y.toFixed(1),
      });

      setHeading(rotation.current.yaw);
    }
  });

  return (
    <group ref={planeRef} position={[0, 3, 0]}>
      {model ? (
        <primitive object={model} />
      ) : (
        <mesh>
          <coneGeometry args={[0.5, 2, 8]} />
          <meshStandardMaterial color="red" />
        </mesh>
      )}
    </group>
  );
});


// ================= MAIN =================
export default function FlightSimulation() {
  const [stats, setStats] = useState({ speed: 0, altitude: 0 });
  const [heading, setHeading] = useState(0);
  const planeRef = useRef();

  const [city, setCity] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [center, setCenter] = useState({
    lat: 5.6037,
    lon: -0.1870,
  });

  


 const [destination, setDestination] = useState(null);

  // ✅ NEW: dynamic speed control
  const [speed, setSpeed] = useState(0.12);
  const speedRef = useRef(speed);

  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);

  useEffect(() => {
    const handleKeys = (e) => {
      if (e.key === "Shift") {
        setSpeed((s) => Math.min(s + 0.02, 1)); // increase
      }
      if (e.key === "Control") {
        setSpeed((s) => Math.max(s - 0.02, 0.02)); // decrease
      }
    };

    window.addEventListener("keydown", handleKeys);
    return () => window.removeEventListener("keydown", handleKeys);
  }, []);

  const handleInputChange = async (value) => {
    setCity(value);

    if (value.length < 2) {
      setSuggestions([]);
      return;
    }

    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${value}&addressdetails=1&limit=5`
      );
      const data = await res.json();

      const formatted = data.map((place) => ({
        name: `${place.name || value}, ${place.address?.country || ""}`,
        lat: parseFloat(place.lat),
        lon: parseFloat(place.lon),
      }));

      setSuggestions(formatted);
    } catch (err) {
      console.log(err);
    }
  };

const handleSelect = (place) => {
  setCity(place.name);
  setSuggestions([]);

  // ✈️ set destination instead of teleport
  setDestination({
    lat: place.lat,
    lon: place.lon,
  });
};

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!city) return;

    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${city}`
      );
      const data = await res.json();

      if (!data.length) return alert("City not found");

      setCenter({
        lat: parseFloat(data[0].lat),
        lon: parseFloat(data[0].lon),
      });

      if (planeRef.current) {
        planeRef.current.position.set(0, 3, 0);
      }

    } catch {
      alert("Search failed");
    }
  };

  return (
    <div style={{ width: "100vw", height: "100vh", position: "relative" }}>
      <Compass heading={heading} />
      <Minimap planeRef={planeRef} heading={heading} center={center} />

      <div style={{
        position: "absolute",
        top: 20,
        left: 20,
        zIndex: 100,
        background: "#000000cc",
        padding: 15,
        borderRadius: 10,
        color: "white"
      }}>
        <form onSubmit={handleSearch}>
          <input
            value={city}
            onChange={(e) => handleInputChange(e.target.value)}
            placeholder="Search city"
            style={{ padding: 8, marginRight: 5 }}
          />
          <button type="submit">Search</button>
        </form>

        {suggestions.length > 0 && (
          <div style={{
            background: "white",
            color: "black",
            borderRadius: 5,
            marginTop: 5,
            maxHeight: 150,
            overflowY: "auto"
          }}>
            {suggestions.map((s, index) => (
              <div
                key={index}
                onClick={() => handleSelect(s)}
                style={{
                  padding: 8,
                  cursor: "pointer",
                  borderBottom: "1px solid #ddd"
                }}
              >
                {s.name}
              </div>
            ))}
          </div>
        )}

        <p>Speed: {stats.speed}</p>
        <p>Altitude: {stats.altitude}</p>

        {/* ✅ NEW UI indicator */}
        <p>Control Speed:</p>
        <p>Shift = Faster | Ctrl = Slower</p>
      </div>

      <Canvas camera={{ position: [0, 4, 10], fov: 60 }}>
        <color attach="background" args={["#87CEEB"]} />
        <ambientLight intensity={0.6} />
        <directionalLight position={[100, 100, 50]} intensity={2} />
        <Sky sunPosition={[100, 20, 100]} />

        <Ground planeRef={planeRef} center={center} />

        <Suspense fallback={null}>
       <Plane
  speed={speed}
  setStats={setStats}
  setHeading={setHeading}
  center={center}
  destination={destination}
  ref={planeRef}
/>
        </Suspense>
      </Canvas>
    </div>
  );
}
