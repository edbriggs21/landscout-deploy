import React from 'react';
import { getMergedOpsSchema, collectSchemaKeys } from '../lib/ops-schema.js';

function fmt(val) {
  if (val === null || val === undefined || val === '') return null;
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  if (val === 'true') return 'Yes';
  if (val === 'false') return 'No';
  if (typeof val === 'object') return JSON.stringify(val);
  return String(val);
}

function fmtDate(val) {
  if (!val) return new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  try { return new Date(val).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); }
  catch { return String(val); }
}

function FieldRow({ label, value }) {
  return (
    <div className="mb-2">
      <div className="text-xs text-slate-400">{label}</div>
      <div className="text-sm text-white whitespace-pre-wrap">
        {value === null || value === undefined || value === ''
          ? <span className="text-slate-500">—</span>
          : value}
      </div>
    </div>
  );
}

export default function OpsInfoView({ owner, project }) {
  const schema = getMergedOpsSchema(project);
  const info = owner.ops_info || {};

  return (
    <div className="space-y-5">
      {schema.sections.map(sec => (
        <div key={sec.key}>
          <div className="text-sm uppercase tracking-wider text-slate-500 mb-2">{sec.label}</div>
          <div>
            {sec.fields.map(f => {
              // Hide conditional fields when parent toggle is off
              if (f.conditional) {
                const parentVal = info[f.conditional];
                const isOn = parentVal === true || parentVal === 'true';
                if (!isOn) return null;
              }

              if (f.type === 'owner_readonly') {
                const v = owner[f.source];
                return <FieldRow key={f.key} label={f.label} value={fmt(v)} />;
              }
              if (f.type === 'date_readonly') {
                return <FieldRow key={f.key} label={f.label} value={fmtDate(info[f.key])} />;
              }
              return <FieldRow key={f.key} label={f.label} value={fmt(info[f.key])} />;
            })}
          </div>
        </div>
      ))}

      {/* Surface any unknown keys (rare — would only happen for legacy data) */}
      {(() => {
        const known = collectSchemaKeys(schema);
        const extras = Object.keys(info).filter(k => !known.has(k) && !k.startsWith('_'));
        if (extras.length === 0) return null;
        return (
          <div>
            <div className="text-sm uppercase tracking-wider text-slate-500 mb-2">Other</div>
            {extras.map(k => <FieldRow key={k} label={k} value={fmt(info[k])} />)}
          </div>
        );
      })()}

      {info._ops_edit_approved_by && (
        <div className="text-xs text-slate-500 border-t border-brandBorder pt-3">
          Last approved edit by {info._ops_edit_approved_by} on {info._ops_edit_approved_at ? new Date(info._ops_edit_approved_at).toLocaleString() : ''}
        </div>
      )}
    </div>
  );
}
