'use client';

import React, { useMemo, useCallback } from 'react';
import { OrthographicCamera } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { MyDesk } from './MyDesk';
import { MainCharacter } from './MainCharacter';
import { DepartmentSpace, DEFAULT_PART_COLORS } from './DepartmentSpace';
import { useAgentStore } from '@/stores/agentStore';
import { usePartStore } from '@/stores/partStore';
import { useOfficeStore } from '@/stores/officeStore';
import { useAgentDetailStore } from '@/stores/agentDetailStore';
import type { AgentTreeNode } from '@/types/agent';

/**
 * Full 3D office scene layout:
 *   - OrthographicCamera with isometric-like angle
 *   - Ambient + Directional + Hemisphere lighting
 *   - Floor / ground plane
 *   - MyDesk (user's personal desk)
 *   - MainCharacter (secretary)
 *   - DepartmentSpaces[] (one per Part, with agent characters)
 *   - Empty expansion spaces (dotted outlines)
 */
export function OfficeScene() {
  const { tree } = useAgentStore();
  const { parts } = usePartStore();
  const { selectedCharacterId, selectCharacter, zoom } = useOfficeStore();
  const { openChat } = useOfficeStore();

  // Separate Main agent from department agents
  const mainAgent = useMemo(
    () => tree.find((a) => a.role === 'main'),
    [tree],
  );

  // Group non-main agents by partId
  const departmentGroups = useMemo(() => {
    const groups = new Map<string, AgentTreeNode[]>();
    function collectAgents(node: AgentTreeNode) {
      if (node.role !== 'main') {
        const partId = node.partId ?? 'unassigned';
        if (!groups.has(partId)) groups.set(partId, []);
        groups.get(partId)!.push(node);
      }
      node.children.forEach(collectAgents);
    }
    tree.forEach(collectAgents);
    return groups;
  }, [tree]);

  const handleMainClick = useCallback(() => {
    selectCharacter('main');
    openChat();
  }, [selectCharacter, openChat]);

  const handleAgentClick = useCallback(
    (agentId: string) => {
      selectCharacter(agentId);
      useAgentDetailStore.getState().openAgent(agentId);
    },
    [selectCharacter],
  );

  const handleEmptyClick = useCallback(() => {
    selectCharacter(null);
  }, [selectCharacter]);

  // Compute department positions in a row layout
  const departmentEntries = useMemo(() => {
    const entries: Array<{
      partId: string;
      partName: string;
      partColor: string;
      agents: AgentTreeNode[];
      position: [number, number, number];
    }> = [];

    let xOffset = -6;
    departmentGroups.forEach((agents, partId) => {
      const part = parts.find((p) => p.id === partId);
      const idx = entries.length;
      entries.push({
        partId,
        partName: part?.name ?? `Part ${idx + 1}`,
        partColor: part?.color ?? DEFAULT_PART_COLORS[idx % DEFAULT_PART_COLORS.length],
        agents,
        position: [xOffset, 0, -6] as [number, number, number],
      });
      xOffset += Math.max(agents.length * 2, 4) + 3;
    });

    return entries;
  }, [departmentGroups, parts]);

  return (
    <>
      {/* Scene background to match canvas */}
      <color attach="background" args={['#faf8ff']} />

      {/* Camera: Orthographic for isometric feel */}
      <OrthographicCamera
        makeDefault
        position={[15, 15, 15]}
        zoom={50 * zoom}
        near={0.1}
        far={1000}
      />

      {/* Lighting */}
      <ambientLight intensity={0.5} color="#f0e6ff" />
      <directionalLight
        position={[10, 15, 10]}
        intensity={0.8}
        color="#ffffff"
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-30}
        shadow-camera-right={30}
        shadow-camera-top={30}
        shadow-camera-bottom={-30}
      />
      <hemisphereLight
        args={['#b4a7d6', '#d5e8d4', 0.4]}
      />

      {/* Ground floor */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0, 0]}
        receiveShadow
        onClick={handleEmptyClick}
      >
        <planeGeometry args={[100, 100]} />
        <meshStandardMaterial
          color="#f8f5ff"
          roughness={0.9}
          metalness={0}
        />
      </mesh>

      {/* Grid pattern on floor */}
      <gridHelper
        args={[100, 50, '#e9e3f5', '#e9e3f5']}
        position={[0, 0.005, 0]}
      />

      {/* My Desk (user's space) - center back */}
      <MyDesk position={[0, 0, 3]} />

      {/* Main Character (secretary) - near user desk */}
      <MainCharacter
        position={[2.5, 0, 2.5]}
        status={
          mainAgent?.status === 'active'
            ? 'active'
            : mainAgent?.status === 'pending'
              ? 'pending'
              : 'idle'
        }
        statusMessage={mainAgent?.statusMessage}
        onClick={handleMainClick}
        isSelected={selectedCharacterId === 'main'}
      />

      {/* Department spaces */}
      {departmentEntries.map((dept) => (
        <DepartmentSpace
          key={dept.partId}
          partName={dept.partName}
          partColor={dept.partColor}
          position={dept.position}
          agents={dept.agents}
          onAgentClick={handleAgentClick}
          selectedAgentId={selectedCharacterId}
        />
      ))}

      {/* Empty expansion spaces (dotted outlines) when no departments */}
      {departmentEntries.length === 0 && (
        <>
          {[-6, 0, 6].map((x, i) => (
            <group key={`empty-${i}`} position={[x, 0, -6]}>
              <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
                <planeGeometry args={[4, 4]} />
                <meshBasicMaterial
                  color="#c4b5fd"
                  transparent
                  opacity={0.08}
                />
              </mesh>
              {/* Dashed border effect using 4 thin boxes */}
              {[
                { pos: [0, 0.02, -2] as const, size: [4, 0.01, 0.04] as const },
                { pos: [0, 0.02, 2] as const, size: [4, 0.01, 0.04] as const },
                { pos: [-2, 0.02, 0] as const, size: [0.04, 0.01, 4] as const },
                { pos: [2, 0.02, 0] as const, size: [0.04, 0.01, 4] as const },
              ].map((border, j) => (
                <mesh key={j} position={[...border.pos]}>
                  <boxGeometry args={[...border.size]} />
                  <meshBasicMaterial color="#c4b5fd" transparent opacity={0.3} />
                </mesh>
              ))}
            </group>
          ))}
        </>
      )}

      {/* Expansion markers when there are departments but room for more */}
      {departmentEntries.length > 0 && departmentEntries.length < 5 && (
        <group position={[
          departmentEntries.length * 8 - 6,
          0,
          -6,
        ]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
            <planeGeometry args={[4, 4]} />
            <meshBasicMaterial color="#c4b5fd" transparent opacity={0.06} />
          </mesh>
          {[
            { pos: [0, 0.02, -2] as const, size: [4, 0.01, 0.04] as const },
            { pos: [0, 0.02, 2] as const, size: [4, 0.01, 0.04] as const },
            { pos: [-2, 0.02, 0] as const, size: [0.04, 0.01, 4] as const },
            { pos: [2, 0.02, 0] as const, size: [0.04, 0.01, 4] as const },
          ].map((border, j) => (
            <mesh key={j} position={[...border.pos]}>
              <boxGeometry args={[...border.size]} />
              <meshBasicMaterial color="#c4b5fd" transparent opacity={0.2} />
            </mesh>
          ))}
        </group>
      )}
    </>
  );
}
