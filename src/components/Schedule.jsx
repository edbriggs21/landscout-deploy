import React, { useMemo, useState } from 'react';
import * as api from '../api.js';

// Approximate distance in miles between two lat/lng (haversine).
function haversineMi(a, b) {
  if (!a || !b) return null;
  const toRad = d => (d * Math.PI) / 180;
  const R = 3958.8; // miles
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat), lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Owner's parcel centroid — same logic as the server uses for routing.
// Falls back to geocoded coords (billing address) only if no parcels.
function ownerCenter(o) {
  const raw = o.parcels_data;
  const features = [];
  if (raw) {
    if (Array.isArray(raw)) features.push(...raw);
    else if (raw.type === 'FeatureCollection' && Array.isArray(raw.features)) features.push(...raw.features);
    else if (raw.type === 'Feature') features.push(raw);
    else if (raw.type && raw.coordinates) features.push({ type: 'Feature', geometry: raw });
  }
  let sx = 0, sy = 0, n = 0;
  const walk = (c) => {
    if (!Array.isArray(c)) return;
    if (typeof c[0] === 'number' && typeof c[1] === 'number') {
      sx += c[0]; sy += c[1]; n++;
    } else c.forEach(walk);
  };
  for (const f of features) walk(f.geometry && f.geometry.coordinates);
  if (n > 0) return { lng: sx / n, lat: sy / n };
  if (typeof o.geocoded_lat === 'number' && typeof o.geocoded_lng === 'number') {
    return { lat: o.geocoded_lat, lng: o.geocoded_lng };
  }
  return null;
}

export default function Schedule({ owners, role, code, name, project, onSelectOwner, onChanged, currentOwnerId, onRequestPickStart }) {
  const [recomputing, setRecomputing] = useState(false);
  const [reordering, setReordering] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [err, setErr] = useState('');
  const [query, setQuery] = useState('');

  // Derive the schedule list from current owners + their deployment_order
  const items = useMemo(() => {
    const scheduled = (owners || [])
      .filter(o => o.deployment_order != null)
      .sort((a, b) => a.deployment_order - b.deployment_order);
    let prev = null;
    return scheduled.map(o => {
      const c = ownerCenter(o);
      const distMi = prev ? haversineMi(prev, c) : null;
      if (c) prev = c;
      return { owner: o, distMi };
    });
  }, [owners]);

  // Search-filtered view of the route list. Empty query -> show all.
  const visibleItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(({ owner }) => {
      const name = (owner.owner_name || owner.name || '').toLowerCase();
      return name.includes(q);
    });
  }, [items, query]);

  const inFieldCount = (owners || []).filter(o => o.deployed_at && !o.retrieved_at).length;
  const doneCount = (owners || []).filter(o => o.retrieved_at).length;
  const blockedCount = (owners || []).filter(o => o.deployment_readiness === 'blocked').length;

  const recompute = async () => {
    setRecomputing(true); setErr('');
    try {
      await api.recomputeSchedule(code);
      await onChanged();
    } catch (e) { setErr(e.message); }
    finally { setRecomputing(false); }
  };

  // Move item at index `idx` by `delta` positions (e.g. -1 = up, +1 = down).
  // Builds the new full ordered_ids array and pushes to the server.
  const moveItem = async (idx, delta) => {
    const newIdx = idx + delta;
    if (newIdx < 0 || newIdx >= items.length) return;
    setReordering(true); setErr('');
    try {
      const ordered_ids = items.map(it => it.owner.id);
      const [moved] = ordered_ids.splice(idx, 1);
      ordered_ids.splice(newIdx, 0, moved);
      await api.reorderSchedule({ code, ordered_ids, updated_by: name });
      await onChanged();
    } catch (e) { setErr(e.message); }
    finally { setReordering(false); }
  };

  const resetToAuto = async () => {
    if (!confirm('Restore the auto-computed schedule? Your manual reordering will be lost.')) return;
    setResetting(true); setErr('');
    try {
      await api.resetSchedule({ code, updated_by: name });
      await onChanged();
    } catch (e) { setErr(e.message); }
    finally { setResetting(false); }
  };

  const isReadOnly = role !== 'crew';

  const start = project && project.deployment_start;
  const [startBusy, setStartBusy] = useState(false);

  const useGps = async () => {
    if (!navigator.geolocation) { alert('Geolocation not supported on this device.'); return; }
    setStartBusy(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          await api.setStartPoint({
            code,
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            label: `My location ±${Math.round(pos.coords.accuracy)}m`,
            updated_by: name,
          });
          await onChanged();
        } catch (e) { alert(e.message); }
        finally { setStartBusy(false); }
      },
      (e) => { alert('Could not get GPS fix: ' + e.message); setStartBusy(false); },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  const clearStart = async () => {
    if (!confirm('Reset start point to default (auto)?')) return;
    setStartBusy(true);
    try {
      await api.setStartPoint({ code, clear: true, updated_by: name });
      await onChanged();
    } catch (e) { alert(e.message); }
    finally { setStartBusy(false); }
  };

  return (
    <div>
      {/* Stats strip */}
      <div className="grid grid-cols-4 gap-2 mb-3 text-xs">
        <div className="bg-brandBg rounded p-2">
          <div className="text-slate-500 uppercase">Up next</div>
          <div className="text-white font-semibold text-lg">{items.length}</div>
        </div>
        <div className="bg-brandBg rounded p-2">
          <div className="text-slate-500 uppercase">In field</div>
          <div className="text-landGreen font-semibold text-lg">{inFieldCount}</div>
        </div>
        <div className="bg-brandBg rounded p-2">
          <div className="text-slate-500 uppercase">Done</div>
          <div className="text-emerald-500 font-semibold text-lg">{doneCount}</div>
        </div>
        <div className="bg-brandBg rounded p-2">
          <div className="text-slate-500 uppercase">Blocked</div>
          <div className="text-red-400 font-semibold text-lg">{blockedCount}</div>
        </div>
      </div>

      {/* Start point card */}
      <div className="bg-brandBg border border-brandBorder rounded p-3 mb-3">
        <div className="flex items-center justify-between mb-1">
          <div className="text-sm text-slate-400">Start point</div>
          {!isReadOnly && start && (
            <button onClick={clearStart} disabled={startBusy} className="text-xs text-slate-400 hover:text-red-400 disabled:opacity-50">Reset</button>
          )}
        </div>
        {start ? (
          <div>
            <div className="text-white text-sm">{start.label || `${start.lat.toFixed(5)}, ${start.lng.toFixed(5)}`}</div>
            <div className="text-xs text-slate-500">
              {start.lat.toFixed(5)}, {start.lng.toFixed(5)}
              {start.updated_by && <> · set by {start.updated_by}</>}
            </div>
          </div>
        ) : (
          <div className="text-xs text-slate-500">Auto (most recent deploy, or southernmost parcel if none yet)</div>
        )}
        {!isReadOnly && (
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              onClick={useGps}
              disabled={startBusy}
              className="text-xs bg-brandSurface border border-brandBorder rounded px-2 py-1 text-slate-200 hover:border-landGreen disabled:opacity-50"
            >
              {startBusy ? '…' : '📍 Use my location'}
            </button>
            <button
              onClick={() => onRequestPickStart && onRequestPickStart()}
              disabled={startBusy}
              className="text-xs bg-brandSurface border border-brandBorder rounded px-2 py-1 text-slate-200 hover:border-landGreen disabled:opacity-50"
            >
              🗺️ Pick on map
            </button>
          </div>
        )}
      </div>

      {/* Manual-mode banner */}
      {project && project.schedule_manual && (
        <div className="bg-yellow-400/10 border border-yellow-400/40 rounded p-2 mb-2 flex items-center justify-between gap-2">
          <div className="text-xs text-yellow-200">
            <strong>Manual order.</strong> Auto-recompute paused.
            {project.schedule_manual_updated_by && <span className="text-yellow-300/70"> · set by {project.schedule_manual_updated_by}</span>}
          </div>
          {!isReadOnly && (
            <button onClick={resetToAuto} disabled={resetting}
              className="text-xs bg-brandBg border border-brandBorder rounded px-2 py-1 text-slate-200 hover:border-landGreen disabled:opacity-50">
              {resetting ? '…' : '↻ Restore auto-schedule'}
            </button>
          )}
        </div>
      )}

      <div className="flex items-center justify-between mb-2">
        <div className="text-sm text-slate-400">{project && project.schedule_manual ? 'Manual route' : 'Recommended route'}</div>
        {!isReadOnly && !(project && project.schedule_manual) && (
          <button onClick={recompute} disabled={recomputing}
            className="text-xs bg-brandBg border border-brandBorder rounded px-2 py-1 text-slate-300 hover:border-landGreen disabled:opacity-50">
            {recomputing ? 'Recomputing…' : '↻ Recompute'}
          </button>
        )}
      </div>
      {err && <div className="text-sm text-red-400 mb-2">{err}</div>}

      {/* Landowner search */}
      <div className="mb-2">
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search landowners…"
            className="w-full bg-brandBg border border-brandBorder rounded p-2 pl-7 text-sm text-white placeholder:text-slate-500 focus:border-landGreen focus:outline-none"
          />
          <span className="absolute left-2 top-2.5 text-slate-500 text-sm">🔎</span>
          {query && (
            <button onClick={() => setQuery('')}
              className="absolute right-2 top-1.5 text-slate-400 hover:text-white text-sm px-1">✕</button>
          )}
        </div>
        {query && (
          <div className="text-xs text-slate-500 mt-1">
            {visibleItems.length === 0
              ? <>No matches for <strong>{query}</strong> in the route.</>
              : <>{visibleItems.length} match{visibleItems.length === 1 ? '' : 'es'}</>}
          </div>
        )}
      </div>

      {items.length === 0 ? (
        <div className="text-sm text-slate-500 bg-brandBg rounded p-3">
          No parcels in the schedule. Deploy or unblock a parcel to add it.
        </div>
      ) : (
        <ul className="space-y-1">
          {visibleItems.map(({ owner, distMi }, idx) => {
            const isCur = owner.id === currentOwnerId;
            const status = owner.deployed_at ? '🟢 in field'
                          : owner.deployment_readiness === 'blocked' ? '🔴 blocked'
                          : owner.deployment_readiness === 'needs_work' ? '🟠 needs work'
                          : owner.deployment_readiness === 'ready' ? '🔵 ready'
                          : '⚪ unscouted';
            // Disable reorder while a search query is active — the index in
            // visibleItems isn't the real schedule index, so up/down would
            // produce incorrect rewrites of ordered_ids.
            const filtering = !!query.trim();
            const canUp = !filtering && idx > 0;
            const canDown = !filtering && idx < items.length - 1;
            return (
              <li key={owner.id} className={`flex gap-1 items-stretch rounded
                ${isCur ? 'bg-landGreen/15 border border-landGreen' : 'bg-brandBg border border-brandBorder'}`}>
                <button onClick={() => onSelectOwner && onSelectOwner(owner.id)}
                  className="flex-1 min-w-0 flex gap-3 p-2 text-left text-sm hover:bg-brandBg">
                  <span className={`flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-full text-xs font-bold
                    ${idx === 0 ? 'bg-landGreen text-deepBlue' : 'bg-brandBorder text-white'}`}>
                    {owner.deployment_order}
                  </span>
                  <span className="flex-1 min-w-0">
                    <div className="text-white truncate">{owner.owner_name || owner.name || '—'}</div>
                    <div className="text-xs text-slate-400">
                      {status}
                      {distMi != null && <span> · {distMi.toFixed(1)} mi from prev</span>}
                    </div>
                  </span>
                </button>
                {!isReadOnly && (
                  <div className="flex flex-col border-l border-brandBorder/60">
                    <button
                      onClick={() => moveItem(idx, -1)}
                      disabled={!canUp || reordering}
                      title="Move up"
                      className="px-2 flex-1 text-slate-300 hover:text-landGreen disabled:opacity-25 text-xs"
                    >▲</button>
                    <button
                      onClick={() => moveItem(idx, +1)}
                      disabled={!canDown || reordering}
                      title="Move down"
                      className="px-2 flex-1 text-slate-300 hover:text-landGreen disabled:opacity-25 text-xs border-t border-brandBorder/40"
                    >▼</button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
