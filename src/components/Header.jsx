import React from 'react';
import LayerPanel from './LayerPanel.jsx';
import SearchBox from './SearchBox.jsx';

// App header, styled to match the Node Placement Schedule panel: dark slate
// surfaces, hairline borders, small uppercase labels. Houses the project,
// layers, basemap toggle, node counts, share-location, and user status.

const C = {
  bg: '#0d1117', surface: '#161b22', border: '#2a3444',
  text: '#cdd9e5', bright: '#f0f6fc', muted: '#8b96a3', accent: '#9ACD32',
};
const pill = {
  background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6,
  padding: '4px 9px', display: 'flex', alignItems: 'center', gap: 6,
  whiteSpace: 'nowrap', flexShrink: 0,
};
const btn = { ...pill, cursor: 'pointer' };
const lbl = {
  fontSize: 8, letterSpacing: '0.09em', color: C.muted,
  textTransform: 'uppercase', lineHeight: 1,
};

function Stat({ dot, value }) {
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: dot, display: 'inline-block' }} />
      <span style={{ fontSize: 13, fontWeight: 700, color: C.bright }}>{value}</span>
    </span>
  );
}

export default function Header({
  project, nodeStats, role, name,
  shareLocation, onToggleShareLocation, locationError,
  basemap, onCycleBasemap,
  onExport,
  search,
  rightInset = 0,
  layerProps = {},
}) {
  const [exporting, setExporting] = React.useState(false);
  const handleExport = async () => {
    if (!onExport || exporting) return;
    setExporting(true);
    try { await onExport(); }
    finally { setExporting(false); }
  };
  return (
    <div style={{
      position: 'absolute', top: 0, left: 0, right: rightInset, height: 56, zIndex: 20,
      background: C.bg, borderBottom: `1px solid ${C.border}`,
      display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px',
      fontFamily: '-apple-system, BlinkMacSystemFont, Inter, Segoe UI, sans-serif',
      transition: 'right 200ms ease', overflowX: 'auto', overflowY: 'visible',
    }}>
      {/* Brand + project */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0 }}>
        <span style={{ width: 10, height: 10, background: C.accent, display: 'inline-block', flexShrink: 0 }} />
        <div>
          <div style={lbl}>Project</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: C.bright, lineHeight: 1.15, whiteSpace: 'nowrap' }}>
            {(project && project.name) || 'LandScout Deploy'}
          </div>
        </div>
      </div>

      {/* Layers */}
      <LayerPanel {...layerProps} />

      {/* Basemap toggle */}
      <button
        type="button"
        onClick={onCycleBasemap}
        title={basemap === 'satellite' ? 'Switch to the streets map' : 'Switch to the satellite map'}
        style={btn}
      >
        <span style={{ fontSize: 13 }}>{basemap === 'satellite' ? '🛰️' : '🗺️'}</span>
        <span style={{ fontSize: 12, color: C.text }}>{basemap === 'satellite' ? 'Satellite' : 'Streets'}</span>
      </button>

      {search && search.searchFn && (
        <SearchBox
          placeholder={search.placeholder || 'Search owner or node #'}
          searchFn={search.searchFn}
          onPick={search.onPick}
        />
      )}

      <div style={{ flex: 1, minWidth: 8 }} />

      {/* Node counts */}
      {nodeStats && (
        <div style={pill}>
          <span style={lbl}>Nodes</span>
          <Stat dot="#94A3B8" value={nodeStats.total} />
          <Stat dot="#FACC15" value={nodeStats.deployed} />
          <Stat dot="#10B981" value={nodeStats.retrieved} />
        </div>
      )}

      {/* Export CSV */}
      {onExport && (
        <button
          type="button"
          onClick={handleExport}
          disabled={exporting}
          title="Download nodes report as CSV"
          style={{ ...btn, opacity: exporting ? 0.6 : 1, cursor: exporting ? 'wait' : 'pointer' }}
        >
          <span style={{ fontSize: 13 }}>📥</span>
          <span style={{ fontSize: 12, color: C.text }}>{exporting ? 'Exporting…' : 'Export CSV'}</span>
        </button>
      )}

      {/* Share location */}
      <button
        type="button"
        onClick={onToggleShareLocation}
        title={shareLocation
          ? (locationError ? 'Location sharing on — ' + locationError : 'Location sharing on — tap to stop')
          : 'Share my location with the team'}
        style={{
          ...btn,
          background: shareLocation ? C.accent : C.surface,
          borderColor: shareLocation ? C.accent : C.border,
        }}
      >
        <span style={{
          width: 7, height: 7, borderRadius: '50%', display: 'inline-block',
          background: shareLocation ? '#0d1117' : C.muted,
        }} />
        <span style={{
          fontSize: 12, fontWeight: shareLocation ? 700 : 400,
          color: shareLocation ? '#0d1117' : C.text,
        }}>{shareLocation ? 'Sharing' : 'Share location'}</span>
      </button>

      {/* User status */}
      <div style={pill}>
        <span style={{
          width: 8, height: 8, borderRadius: '50%', display: 'inline-block', flexShrink: 0,
          background: role === 'crew' ? C.accent : '#25A7FF',
        }} />
        <div>
          <div style={lbl}>{role || 'user'}</div>
          <div style={{ fontSize: 12, color: C.bright, lineHeight: 1.15, whiteSpace: 'nowrap' }}>{name || '—'}</div>
        </div>
      </div>
    </div>
  );
}
