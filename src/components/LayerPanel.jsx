import React, { useState, useRef } from 'react';

// Layers control for the app header: a slate trigger button with a drop-down
// list of project layers. Layers can be toggled and reordered (top of the
// list draws on top of the map).

const C = {
  bg: '#0d1117', surface: '#161b22', surface2: '#1c2330', border: '#2a3444',
  text: '#cdd9e5', bright: '#f0f6fc', muted: '#8b96a3', dim: '#5b6675', accent: '#9ACD32',
};

export default function LayerPanel({
  layers = [], visibleLayerIds, onToggle,
  parcelsVisible = true, onToggleParcels,
  ownerNumbersVisible = false, onToggleOwnerNumbers,
  onReorder,
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef(null);
  const vis = visibleLayerIds || new Set();

  // The list reads top-of-map first; `layers` arrives bottom-to-top.
  const displayLayers = [...layers].reverse();

  const reorderRow = (idx, dir) => {
    const target = idx + dir;
    if (target < 0 || target >= displayLayers.length) return;
    const next = displayLayers.slice();
    const tmp = next[idx];
    next[idx] = next[target];
    next[target] = tmp;
    onReorder([...next].reverse().map((l) => l.id));
  };

  const onCount = (parcelsVisible ? 1 : 0) + (ownerNumbersVisible ? 1 : 0) + vis.size;

  const pill = (active) => ({
    fontSize: 9, padding: '1px 7px', borderRadius: 999,
    background: active ? C.accent : C.border,
    color: active ? '#0d1117' : C.muted,
    fontWeight: active ? 700 : 500,
  });

  const toggleRow = (key, label, sub, swatch, isOn, onClick) => (
    <div key={key} style={{ display: 'flex', alignItems: 'stretch', borderBottom: `1px solid ${C.border}` }}>
      <button
        type="button"
        onClick={onClick}
        style={{
          flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 9,
          padding: '7px 10px', textAlign: 'left', background: 'transparent', border: 'none',
          cursor: 'pointer', opacity: isOn ? 1 : 0.6,
        }}
      >
        {swatch}
        <span style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: C.bright, fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</div>
          <div style={{ color: C.dim, fontSize: 10 }}>{sub}</div>
        </span>
        <span style={pill(isOn)}>{isOn ? 'on' : 'off'}</span>
      </button>
    </div>
  );

  const r = (open && triggerRef.current) ? triggerRef.current.getBoundingClientRect() : null;

  return (
    <div style={{ position: 'relative', flexShrink: 0 }}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        title="Layers"
        style={{
          background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6,
          padding: '4px 9px', display: 'flex', alignItems: 'center', gap: 6,
          cursor: 'pointer', whiteSpace: 'nowrap',
        }}
      >
        <span style={{ fontSize: 13, color: C.text }}>☰</span>
        <span style={{ fontSize: 12, color: C.text }}>Layers</span>
        <span style={{ fontSize: 10, color: C.muted }}>{onCount}/{layers.length + 2}</span>
      </button>

      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 29 }} />
          <div style={{
            position: 'fixed', top: r ? r.bottom + 6 : 60, left: r ? r.left : 12, width: 290, zIndex: 30,
            background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8,
            boxShadow: '0 12px 28px rgba(0,0,0,0.6)', maxHeight: '70vh', overflowY: 'auto',
            fontFamily: '-apple-system, BlinkMacSystemFont, Inter, Segoe UI, sans-serif',
          }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '8px 10px', borderBottom: `1px solid ${C.border}`,
              fontSize: 10, letterSpacing: '0.08em', color: C.muted, textTransform: 'uppercase',
            }}>
              <span>Project layers</span>
              <button onClick={() => setOpen(false)} style={{ background: 'transparent', border: 'none', color: C.muted, cursor: 'pointer', fontSize: 12 }}>✕</button>
            </div>

            {onReorder && displayLayers.length > 1 && (
              <div style={{ padding: '6px 10px', fontSize: 10, color: C.dim, borderBottom: `1px solid ${C.border}` }}>
                Use ▲▼ to reorder — top of the list draws on top of the map.
              </div>
            )}

            {displayLayers.map((l, idx) => {
              const visible = vis.has(l.id);
              const swatchColor = l.color || C.accent;
              return (
                <div key={l.id} style={{ display: 'flex', alignItems: 'stretch', borderBottom: `1px solid ${C.border}` }}>
                  <button
                    type="button"
                    onClick={() => onToggle && onToggle(l.id)}
                    style={{
                      flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 9,
                      padding: '7px 10px', textAlign: 'left', background: 'transparent', border: 'none',
                      cursor: 'pointer', opacity: visible ? 1 : 0.6,
                    }}
                  >
                    <span style={{
                      width: 12, height: 12, borderRadius: 3, flexShrink: 0,
                      background: swatchColor, border: `1px solid ${l.stroke_color || swatchColor}`,
                    }} />
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ color: C.bright, fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.name}</div>
                      <div style={{ color: C.dim, fontSize: 10 }}>{(l.geometry_type || '—')} · {l.feature_count || 0} feat.</div>
                    </span>
                    <span style={pill(visible)}>{visible ? 'on' : 'off'}</span>
                  </button>
                  {onReorder && (
                    <div style={{ display: 'flex', flexDirection: 'column', borderLeft: `1px solid ${C.border}` }}>
                      <button
                        type="button" onClick={() => reorderRow(idx, -1)} disabled={idx === 0}
                        title="Move up — draw on top"
                        style={{ flex: 1, padding: '0 8px', fontSize: 10, background: 'transparent', border: 'none', color: C.text, cursor: idx === 0 ? 'default' : 'pointer', opacity: idx === 0 ? 0.2 : 1 }}
                      >▲</button>
                      <button
                        type="button" onClick={() => reorderRow(idx, 1)} disabled={idx === displayLayers.length - 1}
                        title="Move down"
                        style={{ flex: 1, padding: '0 8px', fontSize: 10, background: 'transparent', border: 'none', borderTop: `1px solid ${C.border}`, color: C.text, cursor: idx === displayLayers.length - 1 ? 'default' : 'pointer', opacity: idx === displayLayers.length - 1 ? 0.2 : 1 }}
                      >▼</button>
                    </div>
                  )}
                </div>
              );
            })}

            {toggleRow(
              'parcels', 'Parcels', 'owner parcel polygons',
              <span style={{ width: 12, height: 12, borderRadius: 3, flexShrink: 0, background: '#3B82F6', border: '1px solid #1D4ED8' }} />,
              parcelsVisible, () => onToggleParcels && onToggleParcels(),
            )}
            {toggleRow(
              'owner-numbers', 'Owner schedule numbers', 'badges at parcel centroids',
              <span style={{ width: 12, height: 12, borderRadius: '50%', flexShrink: 0, background: '#0B2A4A', border: `1px solid ${C.accent}`, color: '#fff', fontSize: 7, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>#</span>,
              ownerNumbersVisible, () => onToggleOwnerNumbers && onToggleOwnerNumbers(),
            )}
          </div>
        </>
      )}
    </div>
  );
}
