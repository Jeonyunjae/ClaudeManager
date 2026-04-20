'use client';

import React from 'react';
import { Html } from '@react-three/drei';
import { AgentCharacter } from './AgentCharacter';
import type { AgentTreeNode } from '@/types/agent';
import * as THREE from 'three';

type DepartmentSpaceProps = {
  partName: string;
  partColor: string;
  position: [number, number, number];
  agents: AgentTreeNode[];
  onAgentClick: (agentId: string) => void;
  selectedAgentId: string | null;
};

const DEFAULT_PART_COLORS = [
  '#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444',
  '#ec4899', '#06b6d4', '#84cc16',
];

/**
 * A department (Part) space in the 3D office.
 * Contains a colored carpet, sign, desks, and team agent characters.
 */
export function DepartmentSpace({
  partName,
  partColor,
  position,
  agents,
  onAgentClick,
  selectedAgentId,
}: DepartmentSpaceProps) {
  // Layout agents in a grid within the department
  const agentPositions = agents.map((_, i) => {
    const cols = Math.ceil(Math.sqrt(agents.length));
    const row = Math.floor(i / cols);
    const col = i % cols;
    return [col * 2.0 - (cols - 1), 0, row * 2.0 + 1.0] as [number, number, number];
  });

  return (
    <group position={position}>
      {/* Department carpet */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 1.5]} receiveShadow>
        <planeGeometry args={[
          Math.max(agents.length * 2, 4) + 2,
          Math.max(Math.ceil(agents.length / 3) * 2, 3) + 2,
        ]} />
        <meshStandardMaterial
          color={partColor}
          transparent
          opacity={0.15}
          roughness={0.9}
        />
      </mesh>

      {/* Carpet border */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 1.5]}>
        <ringGeometry args={[
          Math.max(agents.length, 2) + 0.5,
          Math.max(agents.length, 2) + 0.6,
          4,
        ]} />
        <meshBasicMaterial color={partColor} transparent opacity={0.3} side={THREE.DoubleSide} />
      </mesh>

      {/* Department sign */}
      <group position={[0, 0, -0.8]}>
        {/* Sign pole */}
        <mesh position={[0, 0.75, 0]}>
          <cylinderGeometry args={[0.04, 0.04, 1.5, 8]} />
          <meshStandardMaterial color="#6b7280" roughness={0.4} metalness={0.5} />
        </mesh>
        {/* Sign board */}
        <mesh position={[0, 1.6, 0]}>
          <boxGeometry args={[2.0, 0.5, 0.06]} />
          <meshStandardMaterial color={partColor} roughness={0.5} metalness={0.1} />
        </mesh>
        {/* Sign label */}
        <Html
          position={[0, 1.6, 0.04]}
          center
          distanceFactor={10}
          style={{ pointerEvents: 'none' }}
        >
          <div style={{
            color: '#ffffff',
            fontWeight: 'bold',
            fontSize: '13px',
            whiteSpace: 'nowrap',
            textShadow: '0 1px 3px rgba(0,0,0,0.3)',
          }}>
            {partName}
          </div>
        </Html>
      </group>

      {/* Desks for each agent */}
      {agentPositions.map((pos, i) => (
        <group key={`desk-${i}`} position={pos}>
          {/* Small desk */}
          <mesh position={[0, 0.3, -0.3]} castShadow receiveShadow>
            <boxGeometry args={[0.9, 0.05, 0.5]} />
            <meshStandardMaterial color="#d4a574" roughness={0.7} metalness={0.05} />
          </mesh>
          {/* Desk legs */}
          <mesh position={[-0.35, 0.15, -0.5]} castShadow>
            <cylinderGeometry args={[0.02, 0.02, 0.3, 6]} />
            <meshStandardMaterial color="#8b6f47" roughness={0.8} />
          </mesh>
          <mesh position={[0.35, 0.15, -0.5]} castShadow>
            <cylinderGeometry args={[0.02, 0.02, 0.3, 6]} />
            <meshStandardMaterial color="#8b6f47" roughness={0.8} />
          </mesh>
          <mesh position={[-0.35, 0.15, -0.1]} castShadow>
            <cylinderGeometry args={[0.02, 0.02, 0.3, 6]} />
            <meshStandardMaterial color="#8b6f47" roughness={0.8} />
          </mesh>
          <mesh position={[0.35, 0.15, -0.1]} castShadow>
            <cylinderGeometry args={[0.02, 0.02, 0.3, 6]} />
            <meshStandardMaterial color="#8b6f47" roughness={0.8} />
          </mesh>
          {/* Small monitor on desk */}
          <mesh position={[0, 0.48, -0.4]} castShadow>
            <boxGeometry args={[0.3, 0.2, 0.02]} />
            <meshStandardMaterial color="#1a1a2e" roughness={0.3} metalness={0.4} />
          </mesh>
        </group>
      ))}

      {/* Agent characters */}
      {agents.map((agent, i) => (
        <AgentCharacter
          key={agent.id}
          id={agent.id}
          name={agent.name}
          role={agent.role}
          status={agent.status}
          statusMessage={agent.statusMessage}
          position={agentPositions[i] ?? [0, 0, 0]}
          color={partColor}
          onClick={onAgentClick}
          isSelected={selectedAgentId === agent.id}
        />
      ))}

      {/* Empty space marker if no agents */}
      {agents.length === 0 && (
        <Html position={[0, 0.5, 1]} center distanceFactor={10}>
          <div style={{
            color: '#9ca3af',
            fontSize: '11px',
            fontStyle: 'italic',
          }}>
            (empty)
          </div>
        </Html>
      )}
    </group>
  );
}

export { DEFAULT_PART_COLORS };
