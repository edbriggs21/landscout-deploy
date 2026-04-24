import React, { useMemo, useState } from 'react';
import * as api from '../api.js';
import { getMergedOpsSchema } from '../lib/ops-schema.js';

export default function OpsInfoEdit({ owner, project, code, name, onChanged }) {
  const schema = getMergedOpsSchema(project);
  const pendingExists = !!owner.ops_info_pending;

  const initialValues = useMemo(() => {
    const base = owner.ops_info_pending || owner.ops_info || {};
    return { ...base };
  }, [owner.id]); // eslint-disable-line

  const [values, setValues] = useState(initialValues);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState(false);

  const setVal = (k, v) => setValues(prev => ({ ...prev, [k]: v }));

  const save = async () => {
    setSaving(true); setErr(''); setOk(false);
    try {
      await api.updateOpsInfo({ code, owner_id: owner.id, ops_info_pending: values, updated_by: name });
      setOk(true);
      await onChanged();
    } catch (e) { setErr(e.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-5">
      {pendingExists && (
        <div className="bg-yellow-400/10 border border-yellow-400/40 text-yellow-200 text-sm rounded-lg p-3">
          <strong>Awaiting review.</strong> Your earlier edit is still pending approval. Changes here will replace it.
        </div>
      )}

      {schema.sections.map((sec, i) => (
        <div key={i}>
          <div className="text-sm uppercase tracking-wider text-slate-500 mb-2">{sec.title}</div>
          <div className="space-y-3">
            {sec.fields.map(f => (
              <div key={f.key}>
                <label className="block text-xs text-slate-400 mb-1">{f.label}</label>
                {f.type === 'textarea' ? (
                  <textarea rows={3} value={values[f.key] || ''}
                    onChange={e => setVal(f.key, e.target.value)}
                    className="w-full bg-brandBg border border-brandBorder rounded-md p-2 text-sm text-white" />
                ) : f.type === 'checkbox' ? (
                  <input type="checkbox" checked={!!values[f.key]}
                    onChange={e => setVal(f.key, e.target.checked)} />
                ) : (
                  <input type="text" value={values[f.key] || ''}
                    onChange={e => setVal(f.key, e.target.value)}
                    className="w-full bg-brandBg border border-brandBorder rounded-md p-2 text-sm text-white" />
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      {err && <div className="text-sm text-red-400">{err}</div>}
      {ok && <div className="text-sm text-green-400">Saved — waiting for team review.</div>}
      <button onClick={save} disabled={saving}
        className="bg-landGreen text-deepBlue font-semibold py-2 px-4 rounded-lg disabled:opacity-50">
        {saving ? 'Saving…' : (pendingExists ? 'Update proposal' : 'Submit for review')}
      </button>
    </div>
  );
}
