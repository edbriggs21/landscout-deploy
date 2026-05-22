import React, { useEffect, useState, useCallback } from 'react';
import * as api from '../api.js';

export default function NodesOnParcel({ owner, code, name, role, onChanged }) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [nodes, setNodes] = useState(null);
  const [busyKey, setBusyKey] = useState(null);
  const [editKey, setEditKey] = useState(null);
  const [editVal, setEditVal] = useState('');
  const [editErr, setEditErr] = useState('');
  const [editBusy, setEditBusy] = useState(false);

  const fetchNodes = useCallback(async () => {
    setErr('');
    setLoading(true);
    try {
      const res = await api.getOwnerNodes({ code, owner_id: owner.id });
      setNodes(res.nodes || []);
    } catch (e) {
      setErr(e.message || 'Failed to load nodes');
    } finally {
      setLoading(false);
    }
  }, [code, owner.id]);

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

  const act = async (node, action) => {
    const key = `${node.layer_id}::${node.label}`;
    setBusyKey(key); setErr('');
    try {
      await api.updateNodeStatus({
        code,
        layer_id: node.layer_id,
        feature_key: node.label,
        action,
        updated_by: name,
      });
      await fetchNodes();
      if (onChanged) await onChanged();
    } catch (e) {
      setErr(e.message || 'Update failed');
    } finally {
      setBusyKey(null);
    }
  };

  // --- node-number editing -------------------------------------------------
  const startEdit = (n) => {
    setEditKey(`${n.layer_id}::${n.label}`);
    setEditVal(n.node_number != null ? String(n.node_number) : '');
    setEditErr('');
  };
  const cancelEdit = () => { setEditKey(null); setEditVal(''); setEditErr(''); };
  const saveNumber = async (n) => {
    setEditBusy(true); setEditErr('');
    try {
      const v = String(editVal).trim();
      await api.setNodeNumber({
        code, line: n.line, sort: n.sort,
        node_number: v === '' ? null : Number(v),
      });
      setEditKey(null); setEditVal('');
      await fetchNodes();
      if (onChanged) await onChanged();
    } catch (e) {
      setEditErr(e.message || 'Could not save the number');
    } finally {
      setEditBusy(false);
    }
  };

  if (loading && !nodes) {
    return <div className="text-xs text-slate-500">Computing nodes on this parcel…</div>;
  }
  if (err && !nodes) {
    return <div className="text-xs text-red-400">{err}</div>;
  }
  if (!nodes || nodes.length === 0) {
    return <div className="text-xs text-slate-500">No nodes fall on this parcel.</div>;
  }

  const totalCount = nodes.length;
  const deployedCount = nodes.filter(n => n.deployed_at).length;
  const retrievedCount = nodes.filter(n => n.retrieved_at).length;

  const byLayer = nodes.reduce((acc, n) => {
    const k = n.layer_name || '—';
    if (!acc[k]) acc[k] = { color: n.layer_color, items: [] };
    acc[k].items.push(n);
    return acc;
  }, {});

  const canEdit = role === 'scout' || role === 'crew';

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div className="bg-brandBg border border-brandBorder rounded p-2">
          <div className="text-slate-500 uppercase tracking-wider">Total</div>
          <div className="text-white font-semibold text-base">{totalCount}</div>
        </div>
        <div className="bg-brandBg border border-brandBorder rounded p-2">
          <div className="text-slate-500 uppercase tracking-wider">Deployed</div>
          <div className="text-landGreen font-semibold text-base">{deployedCount} / {totalCount}</div>
        </div>
        <div className="bg-brandBg border border-brandBorder rounded p-2">
          <div className="text-slate-500 uppercase tracking-wider">Retrieved</div>
          <div className="text-emerald-500 font-semibold text-base">{retrievedCount} / {totalCount}</div>
        </div>
      </div>

      {err && <div className="text-xs text-red-400">{err}</div>}

      {Object.entries(byLayer).map(([layerName, { color, items }]) => (
        <div key={layerName}>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-block w-3 h-3 rounded-sm flex-shrink-0" style={{ background: color || '#9ACD32' }}></span>
            <span className="text-sm text-white font-medium">{layerName}</span>
            <span className="text-xs text-slate-500">{items.length}</span>
          </div>
          <ul className="text-xs space-y-1">
            {items.map((n, i) => {
              const key = `${n.layer_id}::${n.label}`;
              const busy = busyKey === key;
              const deployed = !!n.deployed_at;
              const retrieved = !!n.retrieved_at;
              const pill = retrieved
                ? <span className="px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 text-[10px] font-medium">retrieved</span>
                : deployed
                  ? <span className="px-1.5 py-0.5 rounded-full bg-landGreen/15 text-landGreen text-[10px] font-medium">deployed</span>
                  : <span className="px-1.5 py-0.5 rounded-full bg-slate-700/40 text-slate-400 text-[10px] font-medium">untouched</span>;
              return (
                <li key={i} className="bg-brandBg border border-brandBorder/40 rounded p-2 flex flex-col gap-1">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    {editKey === key ? (
                      <span className="flex items-center gap-1">
                        <span className="text-slate-400 text-xs">#</span>
                        <input
                          type="number" value={editVal} autoFocus
                          onChange={(e) => setEditVal(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') saveNumber(n); if (e.key === 'Escape') cancelEdit(); }}
                          placeholder="blank = none"
                          className="w-24 bg-brandSurface border border-landGreen rounded px-1 py-0.5 text-white text-xs font-mono"
                        />
                        <button onClick={() => saveNumber(n)} disabled={editBusy}
                          className="text-[11px] bg-landGreen text-deepBlue font-semibold px-2 py-0.5 rounded disabled:opacity-50">{editBusy ? '…' : 'Save'}</button>
                        <button onClick={cancelEdit} disabled={editBusy}
                          className="text-[11px] text-slate-400 px-1 hover:text-white">Cancel</button>
                      </span>
                    ) : (
                      <>
                        <span className="text-white font-mono font-semibold">#{n.node_number != null ? n.node_number : '—'}</span>
                        {canEdit && n.line != null && n.sort != null && (
                          <button onClick={() => startEdit(n)} title="Edit node number"
                            className="text-slate-500 hover:text-landGreen text-[11px]">✏️</button>
                        )}
                      </>
                    )}
                    <span className="text-slate-400 font-mono text-[10px]">{n.label || ''}</span>
                    {pill}
                    <span className="text-slate-500 ml-auto">{n.lat.toFixed(5)}, {n.lng.toFixed(5)}</span>
                    <button
                      onClick={() => navigator.clipboard.writeText(`${n.lat}, ${n.lng}`)}
                      title="Copy coordinates"
                      className="text-slate-500 hover:text-white text-xs"
                    >📋</button>
                  </div>
                  {editKey === key && editErr && (
                    <div className="text-[10px] text-red-400">{editErr}</div>
                  )}
                  {canEdit && (
                    <div className="flex gap-1 flex-wrap">
                      {!deployed && !retrieved && (
                        <>
                          <button
                            onClick={() => act(n, 'deploy')}
                            disabled={busy}
                            className="text-[11px] bg-landGreen text-deepBlue font-semibold px-2 py-1 rounded disabled:opacity-50"
                          >{busy ? '…' : 'Deploy'}</button>
                          <button
                            onClick={() => { if (confirm('Mark node #' + n.node_number + ' (' + n.label + ') retrieved without first marking deploy?')) act(n, 'retrieve'); }}
                            disabled={busy}
                            className="text-[11px] bg-brandSurface border border-brandBorder text-slate-400 px-2 py-1 rounded disabled:opacity-50 hover:border-landGreen"
                          >Mark retrieved</button>
                        </>
                      )}
                      {deployed && !retrieved && (
                        <>
                          <button
                            onClick={() => act(n, 'retrieve')}
                            disabled={busy}
                            className="text-[11px] bg-dataBlue text-white font-semibold px-2 py-1 rounded disabled:opacity-50"
                          >{busy ? '…' : 'Retrieve'}</button>
                          <button
                            onClick={() => { if (confirm('Undo deploy for node #' + n.node_number + ' (' + n.label + ')?')) act(n, 'undeploy'); }}
                            disabled={busy}
                            className="text-[11px] bg-brandSurface border border-brandBorder text-slate-300 px-2 py-1 rounded disabled:opacity-50 hover:border-red-400"
                          >Undo deploy</button>
                        </>
                      )}
                      {retrieved && (
                        <button
                          onClick={() => { if (confirm('Undo retrieve for node #' + n.node_number + ' (' + n.label + ')?')) act(n, 'unretrieve'); }}
                          disabled={busy}
                          className="text-[11px] bg-brandSurface border border-brandBorder text-slate-300 px-2 py-1 rounded disabled:opacity-50 hover:border-red-400"
                        >Undo retrieve</button>
                      )}
                    </div>
                  )}
                  {(n.deployed_at || n.retrieved_at) && (
                    <div className="text-[10px] text-slate-500 flex flex-col">
                      {n.deployed_at && <span>deployed {new Date(n.deployed_at).toLocaleString()} by {n.deployed_by || '—'}</span>}
                      {n.retrieved_at && <span>retrieved {new Date(n.retrieved_at).toLocaleString()} by {n.retrieved_by || '—'}</span>}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
