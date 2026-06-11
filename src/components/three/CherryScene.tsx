"use client";

import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, ContactShadows } from "@react-three/drei";
import * as THREE from "three";
import { gsap } from "gsap";

/**
 * Procedural glossy cherry pair — no external .glb assets.
 * Bodies: squashed spheres with MeshPhysicalMaterial (clearcoat = wet gloss).
 * Stems: TubeGeometry along a bent CatmullRom curve, joined at the top.
 */

const CHERRY_RED = "#6e0f1d";
const CHERRY_DEEP = "#4a0a12";
const STEM_GREEN = "#3e7d33";

function Stem({ from, to, mid }: { from: [number, number, number]; to: [number, number, number]; mid: [number, number, number] }) {
  const geometry = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(...from),
      new THREE.Vector3(...mid),
      new THREE.Vector3(...to),
    ]);
    return new THREE.TubeGeometry(curve, 24, 0.045, 10, false);
  }, [from, mid, to]);

  return (
    <mesh geometry={geometry} castShadow>
      <meshStandardMaterial color={STEM_GREEN} roughness={0.6} />
    </mesh>
  );
}

function CherryBody({
  position,
  radius,
  color,
}: {
  position: [number, number, number];
  radius: number;
  color: string;
}) {
  return (
    <mesh position={position} scale={[1, 0.94, 1]} castShadow>
      <sphereGeometry args={[radius, 64, 64]} />
      <meshPhysicalMaterial
        color={color}
        roughness={0.16}
        metalness={0}
        clearcoat={1}
        clearcoatRoughness={0.08}
        sheen={0.4}
        sheenColor="#ff5a6a"
      />
    </mesh>
  );
}

const REST_Y = -0.35;
const DROP_Y = 6.5;
/* bounce.out first touches the target at ~36% of the tween duration —
   the squash keyframe is timed against that first impact. */
const DROP_DURATION = 1.2;
const IMPACT_AT = DROP_DURATION * 0.36;

function CherryPair() {
  const group = useRef<THREE.Group>(null);
  const squash = useRef<THREE.Group>(null);

  /* Entrance choreography (brief §3, mechanic A): the cherry FALLS into
     frame with a bounce, stretching on the way down and squashing on
     impact, then hands over to the infinite Float idle below.
     Reduced motion never reaches this component: CherryHero swaps the
     whole scene for the static poster before mount. */
  useEffect(() => {
    const g = group.current;
    const s = squash.current;
    if (!g || !s) return;

    /* The drop pose is ALSO the JSX initial state below: R3F may paint
       frames before this effect runs, and the cherry must never flash in
       its final pose before the fall starts. The .set() calls only re-assert
       it (idempotent) in case of a re-mount mid-tween. */
    const tl = gsap.timeline();
    tl.set(g.position, { y: DROP_Y })
      .set(s.scale, { x: 0.92, y: 1.16, z: 0.92 }) // stretch while falling
      .to(g.position, { y: REST_Y, duration: DROP_DURATION, ease: "bounce.out" }, 0)
      .to(
        s.scale,
        { x: 1.18, y: 0.76, z: 1.18, duration: 0.11, ease: "power2.in" },
        IMPACT_AT - 0.05,
      )
      .to(
        s.scale,
        { x: 1, y: 1, z: 1, duration: 0.9, ease: "elastic.out(1, 0.38)" },
        IMPACT_AT + 0.07,
      );

    return () => {
      tl.kill();
    };
  }, []);

  // Cursor magnet: gentle mouse-follow rotation, damped for inertia.
  useFrame((state, delta) => {
    if (!group.current) return;
    group.current.rotation.y = THREE.MathUtils.damp(
      group.current.rotation.y,
      state.pointer.x * 0.5,
      3,
      delta,
    );
    group.current.rotation.x = THREE.MathUtils.damp(
      group.current.rotation.x,
      -state.pointer.y * 0.25,
      3,
      delta,
    );
  });

  return (
    <group ref={group} position={[0, DROP_Y, 0]}>
      <group ref={squash} scale={[0.92, 1.16, 0.92]}>
        {/* Infinite idle: slow rotation + sway (Float) after the drop. */}
        <Float speed={1.4} rotationIntensity={0.35} floatIntensity={0.7}>
          {/* Front cherry */}
          <CherryBody position={[-0.55, -0.45, 0.25]} radius={0.95} color={CHERRY_RED} />
          <Stem from={[-0.55, 0.38, 0.25]} mid={[-0.25, 1.15, 0.12]} to={[0.18, 1.75, 0]} />
          {/* Back cherry */}
          <CherryBody position={[0.75, -0.7, -0.35]} radius={0.78} color={CHERRY_DEEP} />
          <Stem from={[0.75, -0.02, -0.35]} mid={[0.55, 0.95, -0.18]} to={[0.18, 1.75, 0]} />
        </Float>
      </group>
    </group>
  );
}

export default function CherryScene() {
  return (
    <Canvas
      dpr={[1, 1.5]} /* brief §3 guardrail: DPR cap 1.5 */
      camera={{ position: [0, 0.4, 5.6], fov: 34 }}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      aria-hidden="true"
      eventSource={typeof document !== "undefined" ? document.body : undefined}
      style={{ background: "transparent", pointerEvents: "none" }}
    >
      <ambientLight intensity={0.55} />
      <directionalLight position={[4, 6, 5]} intensity={2.2} color="#fff4ea" />
      <directionalLight position={[-5, 2, -3]} intensity={0.7} color="#ffd9d2" />
      <pointLight position={[2.5, 3, 4]} intensity={18} color="#ffffff" />
      <CherryPair />
      <ContactShadows position={[0, -2.05, 0]} opacity={0.4} scale={9} blur={2.6} far={3.2} color="#260308" />
    </Canvas>
  );
}
