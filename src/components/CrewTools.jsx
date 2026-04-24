import React, { useState } from 'react';
import * as api from '../api.js';

export default function CrewTools({ owner, code, name, onChanged }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const act = async (action, requireConfirm) => {
    if (requireConfirm && !confirm(`Are you sure you want to ${requireConfirm}?`)) return;
    setBusy(true); setErr('');
    try {
      await api.updateStatus({ code, owner_id: owner.id, action, updated_by: name });
      await onChanged();
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };

  const deployed = !!owner.deployed_at;
  const retrieved = !!owner.retrieved_at;

  return (
    <div>
      {!deployed && !retrieved && (
        <button disabled={busy} onClick={() => act('deploy')}
          className="w-full bg-landGreen text-deepBlue font-semibold py-4 rounded-xl text-lg disabled:opacity-50">
          {busy ? 'Working…' : 'Mark Deployed'}
        </button>
      )}

      {deployed && !retrieved && (
        <div className="space-y-3">
          <div className="text-sm text-slate-300">
            Deployed {new Date(owner.deployed_at).toLocaleString()} by {owner.deployed_by || '—'}
          </div>
          <button disabled={busy} onClick={() => act('retrieve')}
            className="w-full bg-dataBlue text-white font-semibold py-4 rounded-xl text-lg disabled:opacity-50">
            {busy ? 'Working…' : 'Mark Retrieved'}
          </button>
          <button disabled={busy} onClick={() => act('undeploy', 'undo the deploy')}
            className="w-full bg-brandBg border border-brandBorder text-slate-300 py-2 rounded-lg text-sm">
            Undo Deploy
          </button>
        </div>
      )}

      {retrieved && (
        <div className="space-y-3">
          <div className="text-sm text-slate-300">
            Deployed {new Date(owner.deployed_at).toLocaleString()} by {owner.deployed_by || '—'}
          </div>
          <div className="text-sm text-slate-300">
            Retrieved {new Date(owner.retrieved_at).toLocaleString()} by {owner.retrieved_by || '—'}
          </div>
          <button disabled={busy} onClick={() => act('unretrieve', 'undo the retrieval')}
            className="w-full bg-brandBg border border-brandBorder text-slate-300 py-2 rounded-lg text-sm">
            Undo Retrieve
          </button>
        </div>
      )}

      {err && <div className="mt-2 text-sm text-red-400">{err}</div>}
    </div>
  );
}
