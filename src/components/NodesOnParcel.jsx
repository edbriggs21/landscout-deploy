import React, { useEffect, useState } from 'react';
import * as api from '../api.js';

export default function NodesOnParcel({ owner, code }) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [nodes, setNodes] = useState(null); // null = not yet fetched

  useEffect(() => {
    let cancelled = false;
    setNodes(null); setErr(''); setLoading(true);
    (async () => {
      try {
        const res = await api.getOwnerNodes({ code, owner_id: owner.id });
        if (!cancelled) setNodes(res.nodes || []);
      } catch (e) {
        if (!cancelled) setErr(e.message || 'Failed to load nodes');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [owner.id, code]);

  if (loading) {
    return <div className="text-xs text-slate-500">Computing nodes on this parcel…</div>;
  }
  if (err) {
    return <div className="text-xs text-red-400">{err}</div>;
  }
  if (!nodes || nodes.length === 0) {
    return <div className="text-xs text-slate-500">No nodes fall on this parcel.</div>;
  }

  // Group by layer
  const byLayer = nodes.reduce((acc, n) => {
    const k = n.layer_name || '—';
    if (!acc[k]) acc[k] = { color: n.layer_color, items: [] };
    acc[k].items.push(n);
    return acc;
  }, {});

  return (
    <div className="space-y-3">
      {Object.entries(byLayer).map(([layerName, { color, items }]) => (
        <div key={layerName}>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-block w-3 h-3 rounded-sm flex-shrink-0" style={{ background: color || '#9ACD32' }}></span>
            <span className="text-sm text-white font-medium">{layerName}</span>
            <span className="text-xs text-slate-500">{items.length}</span>
          </div>
          <ul className="text-xs space-y-0.5">
            {items.map((n, i) => (
              <li key={i} className="flex items-baseline gap-2 bg-brandBg border border-brandBorder/40 rounded px-2 py-1">
                <span className="text-white font-mono">{n.label || '—'}</span>
                <span className="text-slate-400 ml-auto">{n.lat.toFixed(5)}, {n.lng.toFixed(5)}</span>
                <button
                  onClick={() => navigator.clipboard.writeText(`${n.lat}, ${n.lng}`)}
                  title="Copy coordinates"
                  className="text-slate-500 hover:text-white text-xs"
                >📋</button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
