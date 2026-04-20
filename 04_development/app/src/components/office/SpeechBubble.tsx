'use client';

import React from 'react';
import { Html } from '@react-three/drei';

type SpeechBubbleProps = {
  text: string;
  visible?: boolean;
  position?: [number, number, number];
  color?: string;
};

export function SpeechBubble({
  text,
  visible = true,
  position = [0, 2.5, 0],
  color = '#ffffff',
}: SpeechBubbleProps) {
  if (!visible || !text) return null;

  return (
    <Html
      position={position}
      center
      distanceFactor={10}
      style={{ pointerEvents: 'none' }}
    >
      <div
        style={{
          background: color,
          color: '#1a1a2e',
          padding: '6px 12px',
          borderRadius: '12px',
          fontSize: '11px',
          fontWeight: 500,
          whiteSpace: 'nowrap',
          maxWidth: '160px',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          border: '1px solid rgba(0,0,0,0.08)',
          position: 'relative',
        }}
      >
        {text}
        <div
          style={{
            position: 'absolute',
            bottom: '-6px',
            left: '50%',
            transform: 'translateX(-50%)',
            width: 0,
            height: 0,
            borderLeft: '6px solid transparent',
            borderRight: '6px solid transparent',
            borderTop: `6px solid ${color}`,
          }}
        />
      </div>
    </Html>
  );
}
