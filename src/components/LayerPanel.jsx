import React, { useState } from 'react';

export default function LayerPanel({
  layers, visibleLayerIds, onToggle,
  parcelsVisible = true, onToggleParcels,
  ownerNumbersVisible = false, onToggleOwnerNumbers,
  onReorder,
}) {
  const [open, setOpen] = useState(false);

  // The legend lists layers top-of-map first, so the list reads the same way
  // the map is stacked. `layers` arrives bottom-to-top, so reverse it.
  const displayLayers = [...layers].reverse();

  // Swap a row with its neighbour and hand the new bottom-to-top order up.
  const reorderRow = (idx, dir) => {
    const target = idx + dir;
    if (target < 0 || target >= displayLayers.length) return;
    const next = displayLayers.slice();
    const tmp = next[idx];
    next[idx] = next[target];
    next[target] = tmp;
    onReorder([...next].reverse().map((l) => l.id));
  };

  return (
    <div className="absolute left-3 top-14 z-10 safe-top">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        title="Layers"
        className="bg-brandSurface/95 border border-brandBorder rounded-lg px-3 py-2 text-sm text-white shadow-lg flex items-center gap-2 hover:border-landGreen"
        style={{ backdropFilter: 'blur(6px)' }}
      >
        ☰ Layers <span className="text-xs text-slate-400">({(parcelsVisible ? 1 : 0) + (ownerNumbersVisible ? 1 : 0) + visibleLayerIds.size}/{layers.length + 2})</span>
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
          {onReorder && displayLayers.length > 1 && (
            <div className="px-3 py-1.5 text-[10px] text-slate-500 border-b border-brandBorder/40">
              Use ▲▼ to reorder — top of the list draws on top of the map.
            </div>
          )}
          <ul>
            {displayLayers.map((l, idx) => {
              const visible = visibleLayerIds.has(l.id);
              const swatch = l.color || '#9ACD32';
              return (
                <li key={l.id} className="border-b border-brandBorder/40 flex items-stretch">
                  <button
                    type="button"
                    onClick={() => onToggle(l.id)}
                    className={`flex-1 min-w-0 flex items-center gap-3 px-3 py-2 text-left text-sm hover:bg-brandBg ${visible ? '' : 'opacity-60'}`}
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
                  {onReorder && (
                    <div className="flex flex-col justify-center border-l border-brandBorder/40">
                      <button
                        type="button"
                        onClick={() => reorderRow(idx, -1)}
                        disabled={idx === 0}
                        title="Move up — draw on top"
                        className="px-2 flex-1 text-xs text-slate-300 hover:text-white hover:bg-brandBg disabled:opacity-20 disabled:hover:bg-transparent leading-none"
                      >▲</button>
                      <button
                        type="button"
                        onClick={() => reorderRow(idx, 1)}
                        disabled={idx === displayLayers.length - 1}
                        title="Move down"
                        className="px-2 flex-1 text-xs text-slate-300 hover:text-white hover:bg-brandBg disabled:opacity-20 disabled:hover:bg-transparent leading-none border-t border-brandBorder/40"
                      >▼</button>
                    </div>
                  )}
                </li>
              );
            })}
            <li className="border-b border-brandBorder/40">
              <button
                type="button"
                onClick={() => onToggleParcels && onToggleParcels()}
                className={`w-full flex items-center gap-3 px-3 py-2 text-left text-sm hover:bg-brandBg ${parcelsVisible ? '' : 'opacity-60'}`}
              >
                <span className="inline-block w-3 h-3 rounded-sm flex-shrink-0" style={{ background: '#3B82F6', border: '1px solid #1D4ED8' }} />
                <span className="flex-1 min-w-0">
                  <div className="text-white truncate">Parcels</div>
                  <div className="text-xs text-slate-500">owner parcel polygons</div>
                </span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${parcelsVisible ? 'bg-landGreen text-deepBlue font-semibold' : 'bg-brandBorder text-slate-400'}`}>
                  {parcelsVisible ? 'on' : 'off'}
                </span>
              </button>
            </li>
            <li className="last:border-b-0">
              <button
                type="button"
                onClick={() => onToggleOwnerNumbers && onToggleOwnerNumbers()}
                className={`w-full flex items-center gap-3 px-3 py-2 text-left text-sm hover:bg-brandBg ${ownerNumbersVisible ? '' : 'opacity-60'}`}
              >
                <span className="inline-flex w-3 h-3 rounded-full bg-deepBlue border border-landGreen items-center justify-center text-[7px] text-white flex-shrink-0">#</span>
                <span className="flex-1 min-w-0">
                  <div className="text-white truncate">Owner schedule numbers</div>
                  <div className="text-xs text-slate-500">small badges at parcel centroids</div>
                </span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${ownerNumbersVisible ? 'bg-landGreen text-deepBlue font-semibold' : 'bg-brandBorder text-slate-400'}`}>
                  {ownerNumbersVisible ? 'on' : 'off'}
                </span>
              </button>
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}
