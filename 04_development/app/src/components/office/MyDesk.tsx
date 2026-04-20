'use client';

import React from 'react';
import * as THREE from 'three';

type MyDeskProps = {
  position?: [number, number, number];
};

/**
 * User's desk area with a simple avatar and desk geometry.
 * Represents the "CEO room" - a small personal space.
 */
export function MyDesk({ position = [0, 0, 0] }: MyDeskProps) {
  return (
    <group position={position}>
      {/* Desk surface */}
      <mesh position={[0, 0.45, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.8, 0.08, 0.9]} />
        <meshStandardMaterial color="#d4a574" roughness={0.7} metalness={0.05} />
      </mesh>

      {/* Desk legs */}
      {[
        [-0.8, 0.22, -0.35],
        [0.8, 0.22, -0.35],
        [-0.8, 0.22, 0.35],
        [0.8, 0.22, 0.35],
      ].map((pos, i) => (
        <mesh key={i} position={pos as [number, number, number]} castShadow>
          <cylinderGeometry args={[0.03, 0.03, 0.44, 8]} />
          <meshStandardMaterial color="#8b6f47" roughness={0.8} />
        </mesh>
      ))}

      {/* Monitor */}
      <mesh position={[0, 0.72, -0.2]} castShadow>
        <boxGeometry args={[0.6, 0.4, 0.03]} />
        <meshStandardMaterial color="#1a1a2e" roughness={0.3} metalness={0.4} />
      </mesh>
      {/* Monitor screen glow */}
      <mesh position={[0, 0.72, -0.18]}>
        <planeGeometry args={[0.5, 0.3]} />
        <meshBasicMaterial color="#818cf8" transparent opacity={0.3} />
      </mesh>
      {/* Monitor stand */}
      <mesh position={[0, 0.52, -0.2]} castShadow>
        <cylinderGeometry args={[0.04, 0.06, 0.08, 8]} />
        <meshStandardMaterial color="#374151" roughness={0.5} metalness={0.3} />
      </mesh>

      {/* Chair */}
      <mesh position={[0, 0.35, 0.7]} castShadow>
        <boxGeometry args={[0.5, 0.06, 0.5]} />
        <meshStandardMaterial color="#4c1d95" roughness={0.6} metalness={0.1} />
      </mesh>
      {/* Chair back */}
      <mesh position={[0, 0.6, 0.95]} castShadow>
        <boxGeometry args={[0.5, 0.5, 0.06]} />
        <meshStandardMaterial color="#4c1d95" roughness={0.6} metalness={0.1} />
      </mesh>

      {/* User avatar (simple) - small sitting figure */}
      <mesh position={[0, 0.55, 0.7]} castShadow>
        <cylinderGeometry args={[0.15, 0.18, 0.4, 12]} />
        <meshStandardMaterial color="#6366f1" roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.9, 0.7]} castShadow>
        <sphereGeometry args={[0.18, 12, 12]} />
        <meshStandardMaterial color="#fde68a" roughness={0.5} />
      </mesh>

      {/* Name plate */}
      <mesh position={[0.7, 0.5, 0]} castShadow>
        <boxGeometry args={[0.35, 0.12, 0.06]} />
        <meshStandardMaterial color="#f3e8ff" roughness={0.5} />
      </mesh>
    </group>
  );
}
