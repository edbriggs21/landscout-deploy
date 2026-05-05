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

function ownerCenter(o) {
  if (typeof o.geocoded_lat === 'number' && typeof o.geocoded_lng === 'number') {
    return { lat: o.geocoded_lat, lng: o.geocoded_lng };
  }
  return null;
}

export default function Schedule({ owners, role, code, onSelectOwner, onChanged, currentOwnerId }) {
  const [recomputing, setRecomputing] = useState(false);
  const [err, setErr] = useState('');

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

  const isReadOnly = role !== 'crew';

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

      <div className="flex items-center justify-between mb-2">
        <div className="text-sm text-slate-400">Recommended route</div>
        {!isReadOnly && (
          <button onClick={recompute} disabled={recomputing}
            className="text-xs bg-brandBg border border-brandBorder rounded px-2 py-1 text-slate-300 hover:border-landGreen disabled:opacity-50">
            {recomputing ? 'Recomputing…' : '↻ Recompute'}
          </button>
        )}
      </div>
      {err && <div className="text-sm text-red-400 mb-2">{err}</div>}

      {items.length === 0 ? (
        <div className="text-sm text-slate-500 bg-brandBg rounded p-3">
          No parcels in the schedule. Deploy or unblock a parcel to add it.
        </div>
      ) : (
        <ul className="space-y-1">
          {items.map(({ owner, distMi }, idx) => {
            const isCur = owner.id === currentOwnerId;
            const status = owner.deployed_at ? '🟢 in field'
                          : owner.deployment_readiness === 'blocked' ? '🔴 blocked'
                          : owner.deployment_readiness === 'needs_work' ? '🟠 needs work'
                          : owner.deployment_readiness === 'ready' ? '🔵 ready'
                          : '⚪ unscouted';
            return (
              <li key={owner.id}>
                <button onClick={() => onSelectOwner && onSelectOwner(owner.id)}
                  className={`w-full flex gap-3 p-2 rounded text-left text-sm
                    ${isCur ? 'bg-landGreen/15 border border-landGreen' : 'bg-brandBg border border-brandBorder hover:border-slate-500'}`}>
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
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
