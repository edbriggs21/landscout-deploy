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

  const renderField = (f) => {
    if (f.conditional) {
      const parentVal = values[f.conditional];
      const isOn = parentVal === true || parentVal === 'true';
      if (!isOn) return null;
    }

    const id = `f_${f.key}`;
    const v = values[f.key];
    const inputClass = "w-full bg-brandBg border border-brandBorder rounded-md p-2 text-sm text-white focus:border-landGreen focus:outline-none";

    let control;
    switch (f.type) {
      case 'text':
        control = <input id={id} type="text" placeholder={f.placeholder || ''} value={v ?? ''} onChange={e => setVal(f.key, e.target.value)} className={inputClass} />;
        break;
      case 'textarea':
        control = <textarea id={id} rows={3} placeholder={f.placeholder || ''} value={v ?? ''} onChange={e => setVal(f.key, e.target.value)} className={inputClass + ' resize-y'} />;
        break;
      case 'radio':
        control = (
          <div className="flex gap-3 flex-wrap">
            {(f.options || []).map(opt => (
              <label key={opt} className="flex items-center gap-1.5 text-sm text-white cursor-pointer">
                <input type="radio" name={id} value={opt} checked={v === opt} onChange={() => setVal(f.key, opt)} />
                {opt}
              </label>
            ))}
          </div>
        );
        break;
      case 'select':
        control = (
          <select id={id} value={v ?? ''} onChange={e => setVal(f.key, e.target.value)} className={inputClass}>
            <option value="">— Select —</option>
            {(f.options || []).map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </select>
        );
        break;
      case 'toggle': {
        const checked = v === true || v === 'true';
        control = (
          <label className="inline-flex items-center cursor-pointer">
            <input type="checkbox" checked={checked} onChange={e => setVal(f.key, e.target.checked)} className="sr-only peer" />
            <span className="w-10 h-6 bg-brandBorder peer-checked:bg-landGreen rounded-full relative transition-colors">
              <span className={`absolute top-0.5 ${checked ? 'right-0.5' : 'left-0.5'} w-5 h-5 bg-white rounded-full transition-all`}></span>
            </span>
          </label>
        );
        break;
      }
      case 'owner_readonly': {
        const ov = owner[f.source];
        control = (
          <div>
            <div className="text-sm text-white bg-brandBg border border-brandBorder rounded px-2 py-1.5">
              {ov || <span className="text-slate-500">—</span>}
            </div>
            <div className="text-xs text-slate-500 italic mt-0.5">From owner card — edit there to update</div>
          </div>
        );
        break;
      }
      case 'date_readonly': {
        const display = v ? new Date(v).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
        control = <div className="text-sm text-white py-1">{display}</div>;
        break;
      }
      default:
        control = <input id={id} type="text" value={v ?? ''} onChange={e => setVal(f.key, e.target.value)} className={inputClass} />;
    }

    return (
      <div key={f.key} className="mb-3">
        <label htmlFor={id} className="block text-xs text-slate-400 mb-1">{f.label}</label>
        {control}
      </div>
    );
  };

  return (
    <div className="space-y-5">
      {pendingExists && (
        <div className="bg-yellow-400/10 border border-yellow-400/40 text-yellow-200 text-sm rounded-lg p-3">
          <strong>Awaiting review.</strong> Your earlier edit is still pending approval. Changes here will replace it.
        </div>
      )}

      {schema.sections.map(sec => (
        <div key={sec.key}>
          <div className="text-sm uppercase tracking-wider text-slate-500 mb-2">{sec.label}</div>
          <div>
            {sec.fields.map(renderField)}
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
