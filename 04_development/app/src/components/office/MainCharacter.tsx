'use client';

import React, { useRef, useCallback } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { SpeechBubble } from './SpeechBubble';

type MainCharacterProps = {
  position: [number, number, number];
  status?: 'idle' | 'active' | 'pending';
  statusMessage?: string;
  onClick?: () => void;
  isSelected?: boolean;
};

/**
 * Main (secretary) character - larger, distinct color (deep purple).
 * Clicking opens the chat popup.
 */
export function MainCharacter({
  position,
  status = 'idle',
  statusMessage,
  onClick,
  isSelected = false,
}: MainCharacterProps) {
  const groupRef = useRef<THREE.Group>(null);
  const bodyRef = useRef<THREE.Mesh>(null);
  const headRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (!groupRef.current || !bodyRef.current || !headRef.current) return;
    const t = clock.getElapsedTime();

    if (status === 'active') {
      // Subtle nod when active (typing/processing)
      headRef.current.rotation.x = Math.sin(t * 3) * 0.08;
      bodyRef.current.position.y = 0.65 + Math.sin(t * 4) * 0.02;
    } else if (status === 'pending') {
      // Approach user desk animation: gentle bobbing + look around
      groupRef.current.rotation.y = Math.sin(t * 1.5) * 0.15;
      bodyRef.current.position.y = 0.65 + Math.sin(t * 2) * 0.03;
    } else {
      // Idle: gentle breathing
      const breathe = 1 + Math.sin(t * 1.2) * 0.015;
      bodyRef.current.scale.set(1, breathe, 1);
      headRef.current.rotation.x = 0;
    }

    // Selection highlight pulse
    if (isSelected) {
      const pulse = 1.2 + Math.sin(t * 4) * 0.04;
      groupRef.current.scale.set(pulse, pulse, pulse);
    } else {
      groupRef.current.scale.set(1.2, 1.2, 1.2);
    }
  });

  const handleClick = useCallback(
    (e: THREE.Event & { stopPropagation?: () => void }) => {
      if (e.stopPropagation) e.stopPropagation();
      onClick?.();
    },
    [onClick],
  );

  return (
    <group ref={groupRef} position={position}>
      {/* Ground shadow */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <circleGeometry args={[0.5, 32]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.12} />
      </mesh>

      {/* Body - taller, more distinguished */}
      <mesh
        ref={bodyRef}
        position={[0, 0.65, 0]}
        onClick={handleClick}
        castShadow
      >
        <cylinderGeometry args={[0.35, 0.4, 1.3, 16]} />
        <meshStandardMaterial color="#7c3aed" roughness={0.5} metalness={0.15} />
      </mesh>

      {/* Head */}
      <mesh
        ref={headRef}
        position={[0, 1.75, 0]}
        onClick={handleClick}
        castShadow
      >
        <sphereGeometry args={[0.5, 16, 16]} />
        <meshStandardMaterial color="#fde68a" roughness={0.4} metalness={0.05} />
      </mesh>

      {/* Crown / hat to distinguish Main */}
      <mesh position={[0, 2.25, 0]}>
        <coneGeometry args={[0.2, 0.3, 8]} />
        <meshStandardMaterial color="#a855f7" roughness={0.4} metalness={0.2} />
      </mesh>

      {/* Status dot */}
      <mesh position={[0, 2.6, 0]}>
        <sphereGeometry args={[0.1, 8, 8]} />
        <meshBasicMaterial
          color={status === 'active' ? '#22c55e' : status === 'pending' ? '#f59e0b' : '#94a3b8'}
        />
      </mesh>

      {/* Name label */}
      <SpeechBubble
        text="Main"
        visible={true}
        position={[0, 3.0, 0]}
        color="rgba(124,58,237,0.1)"
      />

      {/* Status message */}
      <SpeechBubble
        text={statusMessage ?? ''}
        visible={!!statusMessage}
        position={[1, 2.0, 0]}
        color={status === 'pending' ? '#fef3c7' : '#f5f3ff'}
      />

      {/* Selection ring */}
      {isSelected && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
          <ringGeometry args={[0.55, 0.7, 32]} />
          <meshBasicMaterial color="#7c3aed" transparent opacity={0.5} side={THREE.DoubleSide} />
        </mesh>
      )}
    </group>
  );
}
