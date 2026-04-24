import React from 'react';
import { getMergedOpsSchema, collectSchemaKeys } from '../lib/ops-schema.js';

function renderValue(val) {
  if (val === null || val === undefined || val === '') return <span className="text-slate-500">—</span>;
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  if (typeof val === 'object') return <pre className="text-xs">{JSON.stringify(val, null, 2)}</pre>;
  return String(val);
}

export default function OpsInfoView({ owner, project }) {
  const schema = getMergedOpsSchema(project);
  const info = owner.ops_info || {};

  const schemaKeys = collectSchemaKeys(schema);
  const extras = Object.keys(info).filter(k => !schemaKeys.has(k) && !k.startsWith('_'));

  return (
    <div className="space-y-5">
      {schema.sections.map((sec, i) => (
        <div key={i}>
          <div className="text-sm uppercase tracking-wider text-slate-500 mb-2">{sec.title}</div>
          <div className="space-y-2">
            {sec.fields.map(f => (
              <div key={f.key}>
                <div className="text-xs text-slate-400">{f.label}</div>
                <div className="text-sm text-white whitespace-pre-wrap">{renderValue(info[f.key])}</div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {extras.length > 0 && (
        <div>
          <div className="text-sm uppercase tracking-wider text-slate-500 mb-2">Other</div>
          <div className="space-y-2">
            {extras.map(k => (
              <div key={k}>
                <div className="text-xs text-slate-400">{k}</div>
                <div className="text-sm text-white whitespace-pre-wrap">{renderValue(info[k])}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {info._ops_edit_approved_by && (
        <div className="text-xs text-slate-500 border-t border-brandBorder pt-3">
          Last approved edit by {info._ops_edit_approved_by} on {new Date(info._ops_edit_approved_at).toLocaleString()}
        </div>
      )}
    </div>
  );
}
