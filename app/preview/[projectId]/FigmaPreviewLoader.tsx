"use client";

import React, { useEffect, useState } from 'react';
import type { FigmaLayer, FigmaPage } from '@/lib/stores/figmaStore';
import PrototypePreview from '@/components/figma/PrototypePreview';

interface FigmaFileData {
  fileId: string | null;
  fileName?: string;
  pages?: FigmaPage[];
  layers?: Record<string, FigmaLayer[]>;
}

interface Props {
  projectId: string;
}

export default function FigmaPreviewLoader({ projectId }: Props) {
  const [data, setData] = useState<FigmaFileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/figma-file?projectId=${projectId}`)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(d => { setData(d); setLoading(false); })
      .catch(() => { setError('Failed to load design'); setLoading(false); });
  }, [projectId]);

  if (loading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', background: '#111', color: '#555',
        fontFamily: 'Inter, sans-serif', fontSize: 14,
      }}>
        Loading prototype…
      </div>
    );
  }

  if (error || !data?.layers) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', background: '#111', color: '#555',
        fontFamily: 'Inter, sans-serif', fontSize: 14, flexDirection: 'column', gap: 8,
      }}>
        <div style={{ fontSize: 32 }}>🎨</div>
        <div>{error ?? 'No design saved for this project yet'}</div>
        <div style={{ fontSize: 11, color: '#444' }}>
          Open the Figma editor and save your design first
        </div>
      </div>
    );
  }

  const activePageId = data.pages?.[0]?.id ?? '';

  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden' }}>
      <PrototypePreview
        standaloneData={{
          pages: data.pages,
          layers: data.layers,
          activePageId,
          fileName: data.fileName,
        }}
      />
    </div>
  );
}
