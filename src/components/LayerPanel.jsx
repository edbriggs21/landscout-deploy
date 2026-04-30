import React, { useState } from 'react';

export default function LayerPanel({ layers, visibleLayerIds, onToggle }) {
  const [open, setOpen] = useState(false);
  if (!layers || layers.length === 0) return null;

  return (
    <div className="absolute right-3 top-14 z-10 safe-top">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        title="Layers"
        className="bg-brandSurface/95 border border-brandBorder rounded-lg px-3 py-2 text-sm text-white shadow-lg flex items-center gap-2 hover:border-landGreen"
        style={{ backdropFilter: 'blur(6px)' }}
      >
        ☰ Layers <span className="text-xs text-slate-400">({visibleLayerIds.size}/{layers.length})</span>
      </button>
      {open && (
        <div
          className="mt-2 bg-brandSurface/97 border border-brandBorder rounded-lg shadow-2xl w-72 max-h-[60vh] overflow-y-auto"
          style={{ backdropFilter: 'blur(8px)' }}
        >
          <div className="px-3 py-2 text-xs uppercase tracking-wider text-slate-400 border-b border-brandBorder flex justify-between items-center">
            <span>Project layers</span>
            <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-white">✕</button>
          </div>
          <ul>
            {layers.map(l => {
              const visible = visibleLayerIds.has(l.id);
              const swatch = l.color || '#9ACD32';
              return (
                <li key={l.id} className="border-b border-brandBorder/40 last:border-b-0">
                  <button
                    type="button"
                    onClick={() => onToggle(l.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2 text-left text-sm hover:bg-brandBg ${visible ? '' : 'opacity-60'}`}
                  >
                    <span
                      className="inline-block w-3 h-3 rounded-sm flex-shrink-0"
                      style={{ background: swatch, border: `1px solid ${l.stroke_color || swatch}` }}
                    />
                    <span className="flex-1 min-w-0">
                      <div className="text-white truncate">{l.name}</div>
                      <div className="text-xs text-slate-500">
                        {l.geometry_type || '—'} · {l.feature_count || 0} feat.
                      </div>
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${visible ? 'bg-landGreen text-deepBlue font-semibold' : 'bg-brandBorder text-slate-400'}`}>
                      {visible ? 'on' : 'off'}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
