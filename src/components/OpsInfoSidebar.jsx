import React from 'react';
import OpsInfoView from './OpsInfoView.jsx';

// Fixed left-of-PlanSidebar collapsible panel showing one owner's ops info.
// Reuses the existing OpsInfoView component so the rendering matches what
// shows up inside ParcelDetail.
export default function OpsInfoSidebar({ open, onClose, offsetRightPx, owner, project, code, name, role, onChanged }) {
  if (!open || !owner) return null;
  return (
    <div
      className="fixed top-0 bottom-0 z-20 overflow-y-auto"
      style={{
        right: offsetRightPx + 'px',
        width: '360px',
        background: '#161b22',
        borderLeft: '1px solid #2a3444',
        color: '#cdd9e5',
        fontFamily: '-apple-system, BlinkMacSystemFont, Inter, sans-serif',
      }}
    >
      {/* Header */}
      <div style={{ position: 'sticky', top: 0, padding: '12px 14px', borderBottom: '1px solid #2a3444', background: '#161b22', zIndex: 5, display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, letterSpacing: '0.08em', color: '#8b96a3', textTransform: 'uppercase' }}>Ops Info</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#f0f6fc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{owner.owner_name || owner.name || '—'}</div>
        </div>
        <button onClick={onClose} style={{ background: 'transparent', border: '1px solid #2a3444', color: '#cdd9e5', padding: '3px 9px', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>✕</button>
      </div>
      <div style={{ padding: 12 }}>
        <OpsInfoView owner={owner} project={project} code={code} name={name} role={role} onChanged={onChanged} />
      </div>
    </div>
  );
}
