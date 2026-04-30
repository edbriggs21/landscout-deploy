import React, { useState } from 'react';
import * as api from '../api.js';

function Readiness({ owner, code, name, onChanged }) {
  // null/undefined readiness means "unset". Tap-again-to-deselect lets scouts reset.
  const [readiness, setReadiness] = useState(owner.deployment_readiness || null);
  const [notes, setNotes] = useState(owner.deployment_readiness_notes || '');
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [err, setErr] = useState('');

  const save = async () => {
    setSaving(true); setErr('');
    try {
      await api.updateReadiness({ code, owner_id: owner.id, readiness, notes, updated_by: name });
      await onChanged();
    } catch (e) { setErr(e.message); }
    finally { setSaving(false); }
  };

  const clearReadiness = async () => {
    if (!confirm('Clear readiness back to "not yet scouted"?')) return;
    setClearing(true); setErr('');
    try {
      // Send readiness=null to wipe the field server-side
      await api.updateReadiness({ code, owner_id: owner.id, readiness: null, notes: '', updated_by: name });
      setReadiness(null);
      setNotes('');
      await onChanged();
    } catch (e) { setErr(e.message); }
    finally { setClearing(false); }
  };

  const opts = [
    { v: 'ready', label: 'Ready', desc: 'Good to go', color: 'bg-dataBlue/20 border-dataBlue' },
    { v: 'needs_work', label: 'Needs work', desc: 'Fixable issue', color: 'bg-yellow-400/10 border-yellow-400' },
    { v: 'blocked', label: 'Blocked', desc: 'Cannot deploy yet', color: 'bg-red-400/10 border-red-400' },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm text-slate-400">Readiness</div>
        {readiness === null && <div className="text-xs text-slate-500">(not yet scouted)</div>}
      </div>
      <div className="grid grid-cols-3 gap-2 mb-3">
        {opts.map(o => (
          <button
            key={o.v}
            onClick={() => setReadiness(prev => prev === o.v ? null : o.v)}
            className={
              'rounded-lg p-3 border text-left ' +
              (readiness === o.v ? o.color : 'border-brandBorder bg-brandBg')
            }>
            <div className="text-white font-medium text-sm">{o.label}</div>
            <div className="text-xs text-slate-400">{o.desc}</div>
          </button>
        ))}
      </div>
      <div className="text-sm text-slate-400 mb-1">Notes</div>
      <textarea
        value={notes}
        onChange={e => setNotes(e.target.value)}
        rows={3}
        placeholder="What did you see? Anything the crew should know?"
        className="w-full bg-brandBg border border-brandBorder rounded-lg p-3 text-sm text-white"
      />
      {err && <div className="mt-2 text-sm text-red-400">{err}</div>}
      <div className="mt-3 flex gap-2 flex-wrap items-center">
        <button
          onClick={save}
          disabled={saving || clearing || readiness === null}
          title={readiness === null ? 'Pick a readiness value first, or use Clear to wipe' : ''}
          className="bg-landGreen text-deepBlue font-semibold py-2 px-4 rounded-lg disabled:opacity-50">
          {saving ? 'Saving…' : 'Save readiness'}
        </button>
        {(owner.deployment_readiness || readiness) && (
          <button
            onClick={clearReadiness}
            disabled={saving || clearing}
            className="bg-brandBg border border-brandBorder text-slate-300 py-2 px-4 rounded-lg text-sm disabled:opacity-50">
            {clearing ? 'Clearing…' : 'Clear'}
          </button>
        )}
      </div>
      {owner.deployment_readiness_updated_at && (
        <div className="mt-2 text-xs text-slate-500">
          Last updated {new Date(owner.deployment_readiness_updated_at).toLocaleString()} by {owner.deployment_readiness_updated_by || '—'}
        </div>
      )}
    </div>
  );
}

function ReadinessReadOnly({ owner }) {
  const labels = { ready: 'Ready', needs_work: 'Needs work', blocked: 'Blocked' };
  return (
    <div>
      <div className="text-sm text-slate-400 mb-1">Scout readiness</div>
      {owner.deployment_readiness
        ? <div className="text-white font-medium">{labels[owner.deployment_readiness]}</div>
        : <div className="text-slate-500">Not yet scouted</div>}
      {owner.deployment_readiness_notes && (
        <div className="mt-1 text-sm text-slate-300 whitespace-pre-wrap">{owner.deployment_readiness_notes}</div>
      )}
      {owner.deployment_readiness_updated_at && (
        <div className="mt-1 text-xs text-slate-500">
          Updated {new Date(owner.deployment_readiness_updated_at).toLocaleString()} by {owner.deployment_readiness_updated_by || '—'}
        </div>
      )}
    </div>
  );
}

function AccessPoints({ owner, code, name, points, onChanged, onRequestDropPin }) {
  const [adding, setAdding] = useState(false);
  const [err, setErr] = useState('');

  const useGps = async () => {
    setErr('');
    if (!navigator.geolocation) { setErr('Geolocation not supported on this device.'); return; }
    setAdding(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          await api.addAccessPoint({
            code, owner_id: owner.id,
            lat: pos.coords.latitude, lng: pos.coords.longitude,
            label: `GPS ±${Math.round(pos.coords.accuracy)}m`,
            created_by: name,
          });
          await onChanged();
        } catch (e) { setErr(e.message); }
        finally { setAdding(false); }
      },
      (e) => { setErr('Could not get GPS fix: ' + e.message); setAdding(false); },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  const remove = async (id) => {
    if (!confirm('Delete this access point?')) return;
    try {
      await api.deleteAccessPoint({ code, access_point_id: id });
      await onChanged();
    } catch (e) { alert(e.message); }
  };

  return (
    <div>
      <div className="text-sm text-slate-400 mb-2">Access points ({points.length})</div>
      <div className="space-y-1 mb-3">
        {points.length === 0 && <div className="text-sm text-slate-500">No pins yet.</div>}
        {points.map(p => (
          <div key={p.id} className="flex items-center justify-between bg-brandBg border border-brandBorder rounded-md px-3 py-2">
            <div className="text-sm">
              <div className="text-white">{p.label || 'Pin'}</div>
              <div className="text-xs text-slate-400">{p.lat.toFixed(5)}, {p.lng.toFixed(5)} · by {p.created_by || '—'}</div>
            </div>
            {p.created_by === name && (
              <button onClick={() => remove(p.id)} className="text-xs text-red-400">Delete</button>
            )}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button onClick={useGps} disabled={adding}
          className="bg-landGreen text-deepBlue font-semibold py-2 rounded-lg disabled:opacity-50">
          {adding ? 'Locating…' : 'Use current location'}
        </button>
        <button onClick={onRequestDropPin}
          className="bg-brandBg border border-brandBorder text-white font-medium py-2 rounded-lg">
          Tap on map
        </button>
      </div>
      {err && <div className="mt-2 text-sm text-red-400">{err}</div>}
    </div>
  );
}

const ScoutTools = { Readiness, ReadinessReadOnly, AccessPoints };
export default ScoutTools;
