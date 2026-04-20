'use client';

import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import type { AgentStatus } from '@/types/agent';
import * as THREE from 'three';

type StatusEffectsProps = {
  status: AgentStatus;
  position?: [number, number, number];
};

/**
 * Visual effects based on agent status:
 * - error: red glow ring pulsing
 * - pending: yellow pulsing icon
 * - retrying: orange spinning icon
 * - active/idle/stopped: no extra effect
 */
export function StatusEffects({ status, position = [0, 2.8, 0] }: StatusEffectsProps) {
  const ringRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (ringRef.current) {
      const t = clock.getElapsedTime();
      const scale = 1 + Math.sin(t * 3) * 0.2;
      ringRef.current.scale.set(scale, scale, scale);
      if (ringRef.current.material instanceof THREE.MeshBasicMaterial) {
        ringRef.current.material.opacity = 0.4 + Math.sin(t * 3) * 0.3;
      }
    }
  });

  if (status === 'error') {
    return (
      <group position={position}>
        <mesh ref={ringRef}>
          <ringGeometry args={[0.4, 0.55, 32]} />
          <meshBasicMaterial color="#ef4444" transparent opacity={0.6} side={THREE.DoubleSide} />
        </mesh>
        <Html center distanceFactor={10} style={{ pointerEvents: 'none' }}>
          <div style={{
            fontSize: '16px',
            filter: 'drop-shadow(0 0 4px rgba(239,68,68,0.6))',
          }}>
            !
          </div>
        </Html>
      </group>
    );
  }

  if (status === 'pending') {
    return (
      <group position={position}>
        <mesh ref={ringRef}>
          <ringGeometry args={[0.3, 0.42, 32]} />
          <meshBasicMaterial color="#f59e0b" transparent opacity={0.5} side={THREE.DoubleSide} />
        </mesh>
        <Html center distanceFactor={10} style={{ pointerEvents: 'none' }}>
          <div style={{
            fontSize: '14px',
            color: '#f59e0b',
            fontWeight: 'bold',
          }}>
            ?
          </div>
        </Html>
      </group>
    );
  }

  if (status === 'retrying') {
    return (
      <group position={position}>
        <mesh ref={ringRef}>
          <ringGeometry args={[0.3, 0.42, 32]} />
          <meshBasicMaterial color="#f97316" transparent opacity={0.5} side={THREE.DoubleSide} />
        </mesh>
      </group>
    );
  }

  return null;
}
