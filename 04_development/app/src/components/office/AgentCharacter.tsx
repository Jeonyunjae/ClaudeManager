'use client';

import React, { useRef, useCallback } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { AgentStatus, AgentRole } from '@/types/agent';
import { SpeechBubble } from './SpeechBubble';
import { StatusEffects } from './StatusEffects';

type AgentCharacterProps = {
  id: string;
  name: string;
  role: AgentRole;
  status: AgentStatus;
  statusMessage?: string;
  position: [number, number, number];
  color?: string;
  onClick?: (id: string) => void;
  isSelected?: boolean;
};

const STATUS_COLORS: Record<AgentStatus, string> = {
  active: '#22c55e',
  idle: '#94a3b8',
  pending: '#f59e0b',
  error: '#ef4444',
  stopped: '#6b7280',
  retrying: '#f97316',
};

const ROLE_SIZES: Record<AgentRole, { bodyH: number; headR: number; scale: number }> = {
  main: { bodyH: 1.2, headR: 0.45, scale: 1.2 },
  part: { bodyH: 1.0, headR: 0.4, scale: 1.1 },
  sub: { bodyH: 0.9, headR: 0.35, scale: 1.0 },
  instance: { bodyH: 0.8, headR: 0.3, scale: 0.9 },
};

export function AgentCharacter({
  id,
  name,
  role,
  status,
  statusMessage,
  position,
  color = '#8b5cf6',
  onClick,
  isSelected = false,
}: AgentCharacterProps) {
  const groupRef = useRef<THREE.Group>(null);
  const bodyRef = useRef<THREE.Mesh>(null);
  const headRef = useRef<THREE.Mesh>(null);

  const size = ROLE_SIZES[role];
  const statusColor = STATUS_COLORS[status];

  // Animations based on status
  useFrame(({ clock }) => {
    if (!groupRef.current || !bodyRef.current || !headRef.current) return;
    const t = clock.getElapsedTime();

    if (status === 'active') {
      // Typing animation: subtle body bob
      bodyRef.current.position.y = size.bodyH / 2 + Math.sin(t * 6) * 0.03;
      headRef.current.rotation.x = Math.sin(t * 4) * 0.05;
    } else if (status === 'idle') {
      // Stretching / breathing
      const breathe = 1 + Math.sin(t * 1.5) * 0.02;
      bodyRef.current.scale.set(1, breathe, 1);
      headRef.current.position.y = size.bodyH + size.headR + Math.sin(t * 1.5) * 0.02;
    } else if (status === 'pending') {
      // Slight sway side to side
      groupRef.current.rotation.y = Math.sin(t * 2) * 0.1;
    } else if (status === 'error') {
      // Shake
      groupRef.current.position.x = position[0] + Math.sin(t * 15) * 0.03;
    } else if (status === 'stopped') {
      // Slump / lean forward
      headRef.current.rotation.x = 0.3;
      headRef.current.position.y = size.bodyH + size.headR - 0.1;
    } else {
      // Reset
      bodyRef.current.position.y = size.bodyH / 2;
      headRef.current.rotation.x = 0;
    }

    // Selection highlight pulse
    if (isSelected && groupRef.current) {
      const pulse = 1 + Math.sin(t * 4) * 0.03;
      groupRef.current.scale.set(
        size.scale * pulse,
        size.scale * pulse,
        size.scale * pulse,
      );
    }
  });

  const handleClick = useCallback(
    (e: THREE.Event & { stopPropagation?: () => void }) => {
      if (e.stopPropagation) e.stopPropagation();
      onClick?.(id);
    },
    [id, onClick],
  );

  return (
    <group ref={groupRef} position={position} scale={size.scale}>
      {/* Shadow on ground */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <circleGeometry args={[0.4, 32]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.1} />
      </mesh>

      {/* Body (cylinder) */}
      <mesh
        ref={bodyRef}
        position={[0, size.bodyH / 2, 0]}
        onClick={handleClick}
        castShadow
      >
        <cylinderGeometry args={[0.3, 0.35, size.bodyH, 16]} />
        <meshStandardMaterial color={color} roughness={0.6} metalness={0.1} />
      </mesh>

      {/* Head (sphere) */}
      <mesh
        ref={headRef}
        position={[0, size.bodyH + size.headR, 0]}
        onClick={handleClick}
        castShadow
      >
        <sphereGeometry args={[size.headR, 16, 16]} />
        <meshStandardMaterial color="#fde68a" roughness={0.5} metalness={0.05} />
      </mesh>

      {/* Status indicator dot above head */}
      <mesh position={[0, size.bodyH + size.headR * 2 + 0.15, 0]}>
        <sphereGeometry args={[0.08, 8, 8]} />
        <meshBasicMaterial color={statusColor} />
      </mesh>

      {/* Name label */}
      <SpeechBubble
        text={name}
        visible={true}
        position={[0, size.bodyH + size.headR * 2 + 0.5, 0]}
        color="rgba(255,255,255,0.9)"
      />

      {/* Status message bubble */}
      <SpeechBubble
        text={statusMessage ?? ''}
        visible={!!statusMessage && (status === 'active' || status === 'pending')}
        position={[0.8, size.bodyH + size.headR + 0.3, 0]}
        color={status === 'pending' ? '#fef3c7' : '#ffffff'}
      />

      {/* Status effects (error glow, pending icon, etc) */}
      <StatusEffects
        status={status}
        position={[0, size.bodyH + size.headR * 2 + 0.8, 0]}
      />

      {/* Selection ring */}
      {isSelected && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
          <ringGeometry args={[0.5, 0.6, 32]} />
          <meshBasicMaterial color={color} transparent opacity={0.6} side={THREE.DoubleSide} />
        </mesh>
      )}
    </group>
  );
}
