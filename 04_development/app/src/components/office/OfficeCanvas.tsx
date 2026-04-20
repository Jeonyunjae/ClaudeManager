'use client';

import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { OfficeScene } from './OfficeScene';

function LoadingFallback3D() {
  return (
    <mesh>
      <boxGeometry args={[1, 1, 1]} />
      <meshBasicMaterial color="#c4b5fd" wireframe />
    </mesh>
  );
}

/**
 * Main Canvas wrapper for the 3D office workspace.
 * Handles Suspense boundaries, loading fallback, and Canvas setup.
 * This component should be imported via dynamic() with ssr: false.
 */
export default function OfficeCanvas() {
  return (
    <div className="w-full h-full relative">
      <Canvas
        shadows
        gl={{
          antialias: true,
          toneMapping: 3, // ACESFilmicToneMapping
          toneMappingExposure: 1.2,
          alpha: false,
        }}
        style={{ background: '#faf8ff' }}
        dpr={[1, 2]}
        performance={{ min: 0.5 }}
      >
        <Suspense fallback={<LoadingFallback3D />}>
          <OfficeScene />
        </Suspense>
        <OrbitControls
          enablePan={true}
          enableZoom={true}
          enableRotate={true}
          maxPolarAngle={Math.PI / 2.5}
          minPolarAngle={Math.PI / 6}
          maxZoom={120}
          minZoom={20}
          target={[0, 0, 0]}
          makeDefault
        />
      </Canvas>
    </div>
  );
}
