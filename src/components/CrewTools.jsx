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
    <div className="space-y-4">
      {/* DEPLOY block */}
      <div className="bg-brandBg border border-brandBorder rounded-xl p-3">
        <div className="text-xs uppercase tracking-wider text-slate-400 mb-2">Deploy</div>
        {deployed ? (
          <div className="space-y-2">
            <div className="text-sm text-slate-300">
              <span className="text-landGreen">●</span> Deployed {new Date(owner.deployed_at).toLocaleString()}
              {owner.deployed_by && <> by {owner.deployed_by}</>}
            </div>
            <button disabled={busy} onClick={() => act('undeploy', 'undo the deploy')}
              className="w-full bg-brandSurface border border-brandBorder text-slate-300 py-2 rounded-lg text-sm hover:border-red-400 disabled:opacity-50">
              ↶ Undo Deploy
            </button>
          </div>
        ) : (
          <button disabled={busy} onClick={() => act('deploy')}
            className="w-full bg-landGreen text-deepBlue font-semibold py-3 rounded-xl text-base disabled:opacity-50">
            {busy ? 'Working…' : 'Mark Deployed'}
          </button>
        )}
      </div>

      {/* RETRIEVE block — always visible. Allows retrieve-without-deploy with a confirm. */}
      <div className="bg-brandBg border border-brandBorder rounded-xl p-3">
        <div className="text-xs uppercase tracking-wider text-slate-400 mb-2">Retrieve</div>
        {retrieved ? (
          <div className="space-y-2">
            <div className="text-sm text-slate-300">
              <span className="text-emerald-500">●</span> Retrieved {new Date(owner.retrieved_at).toLocaleString()}
              {owner.retrieved_by && <> by {owner.retrieved_by}</>}
            </div>
            <button disabled={busy} onClick={() => act('unretrieve', 'undo the retrieval')}
              className="w-full bg-brandSurface border border-brandBorder text-slate-300 py-2 rounded-lg text-sm hover:border-red-400 disabled:opacity-50">
              ↶ Undo Retrieve
            </button>
          </div>
        ) : (
          <>
            <button
              disabled={busy}
              onClick={() => {
                if (!deployed) {
                  if (!confirm('This parcel hasn’t been marked Deployed. Mark it Retrieved anyway?')) return;
                }
                act('retrieve');
              }}
              className="w-full bg-dataBlue text-white font-semibold py-3 rounded-xl text-base disabled:opacity-50">
              {busy ? 'Working…' : 'Mark Retrieved'}
            </button>
            {!deployed && (
              <div className="mt-2 text-xs text-slate-500">
                Not yet deployed — confirm before marking retrieved.
              </div>
            )}
          </>
        )}
      </div>

      {err && <div className="text-sm text-red-400">{err}</div>}
    </div>
  );
}
