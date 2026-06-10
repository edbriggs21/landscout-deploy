import React, { useState, useRef, useEffect } from 'react';

// A small autocomplete search input, styled to match the slate header palette.
// Parent supplies `searchFn(query)` returning matches; `onPick(match)` fires
// when a result is selected (click, Enter). Each match: { key, kind?, label, sublabel? }.

const C = {
  bg: '#0d1117', surface: '#161b22', surface2: '#1c2330', border: '#2a3444',
  text: '#cdd9e5', bright: '#f0f6fc', muted: '#8b96a3', accent: '#9ACD32',
};

export default function SearchBox({
  placeholder = 'Search…',
  width = 220,
  searchFn,
  onPick,
}) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef(null);
  const triggerRef = useRef(null);

  const trimmed = q.trim();
  const matches = trimmed && searchFn ? (searchFn(trimmed) || []) : [];

  useEffect(() => { setActive(0); }, [q]);

  const close = () => { setOpen(false); setQ(''); try { inputRef.current && inputRef.current.blur(); } catch (_) {} };

  const pick = (m) => {
    if (!m) return;
    if (onPick) onPick(m);
    close();
  };

  const onKeyDown = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if (matches.length === 0) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(i => Math.min(i + 1, matches.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(i => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); pick(matches[active]); }
  };

  // Read the trigger's on-screen position when open, so the dropdown can be
  // rendered fixed and escape the header's overflow clip.
  const tRect = (open && triggerRef.current) ? triggerRef.current.getBoundingClientRect() : null;

  return (
    <div ref={triggerRef} style={{ position: 'relative', flexShrink: 0 }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6,
        padding: '4px 9px',
      }}>
        <span style={{ fontSize: 12, color: C.muted }}>🔍</span>
        <input
          ref={inputRef}
          type="text"
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          style={{
            width, background: 'transparent', border: 'none', outline: 'none',
            color: C.text, fontSize: 12, padding: 0, fontFamily: 'inherit',
          }}
        />
        {q && (
          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); setQ(''); try { inputRef.current && inputRef.current.focus(); } catch (_) {} }}
            style={{ background: 'transparent', border: 'none', color: C.muted, fontSize: 12, cursor: 'pointer', padding: 0, lineHeight: 1 }}
            title="Clear"
          >{'✕'}</button>
        )}
      </div>
      {open && matches.length > 0 && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 28 }} />
          <div style={{
            position: 'fixed', top: tRect ? tRect.bottom + 4 : 60, left: tRect ? tRect.left : 12, minWidth: width + 60, maxWidth: 360, zIndex: 29,
            background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8,
            boxShadow: '0 12px 28px rgba(0,0,0,0.6)', maxHeight: 320, overflowY: 'auto',
            fontFamily: '-apple-system, BlinkMacSystemFont, Inter, Segoe UI, sans-serif',
          }}>
            {matches.map((m, i) => (
              <button
                key={m.key}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); pick(m); }}
                onMouseEnter={() => setActive(i)}
                style={{
                  display: 'block', width: '100%', textAlign: 'left',
                  background: i === active ? C.surface2 : 'transparent',
                  border: 'none', borderBottom: `1px solid ${C.border}`,
                  padding: '7px 10px', cursor: 'pointer',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {m.kind && (
                    <span style={{
                      fontSize: 8, padding: '1px 5px', borderRadius: 3,
                      background: m.kind === 'node' ? '#3B82F6' : C.accent,
                      color: '#0d1117', fontWeight: 700,
                      textTransform: 'uppercase', letterSpacing: '0.05em',
                    }}>{m.kind}</span>
                  )}
                  <span style={{ color: C.bright, fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>{m.label}</span>
                </div>
                {m.sublabel && (
                  <div style={{ color: C.muted, fontSize: 10, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.sublabel}</div>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
