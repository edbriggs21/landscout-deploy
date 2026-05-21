import React, { useEffect, useState } from 'react';
import * as api from '../api.js';

// Shared stop editor modal — used by both PlanSidebar and ScheduleBoard.

// The Monday (YYYY-MM-DD) of the week containing an arbitrary ISO date.
export function mondayOfDate(iso) {
  if (!iso) return iso;
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const dow = dt.getUTCDay();             // 0 Sun .. 6 Sat
  const back = dow === 0 ? 6 : dow - 1;   // days back to Monday
  dt.setUTCDate(dt.getUTCDate() - back);
  return dt.toISOString().slice(0, 10);
}

export default function StopEditor({ stop, weekDates, code, onCancel, onSave, onDelete }) {
  const [form, setForm] = useState(stop);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [nodes, setNodes] = useState([]);
  const [nodeQuery, setNodeQuery] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  useEffect(() => {
    let cancelled = false;
    api.listAllNodes({ code })
      .then(res => { if (!cancelled) setNodes(res.nodes || []); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [code]);
  const selectedNode = nodes.find(n => n.node_number === Number(form.node_number));
  const filteredNodes = (() => {
    const q = nodeQuery.trim().toLowerCase();
    if (!q) return nodes.slice(0, 60);
    return nodes.filter(n =>
      String(n.node_number).includes(q) ||
      (n.label || '').toLowerCase().includes(q) ||
      (n.owner_name || '').toLowerCase().includes(q)
    ).slice(0, 60);
  })();
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));
  const save = async () => {
    if (!form.node_number) { setErr('Node # is required.'); return; }
    setErr(''); setBusy(true);
    try { await onSave(form); }
    catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-auto" style={{ background: 'rgba(0,0,0,0.5)' }}>
      <div style={{ background: '#161b22', border: '1px solid #2a3444', color: '#cdd9e5', width: '92%', maxWidth: 440, borderRadius: 10, padding: 16, fontFamily: '-apple-system, BlinkMacSystemFont, Inter, sans-serif' }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#f0f6fc', marginBottom: 10 }}>{stop.id ? 'Edit stop' : 'New stop'}</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <Field label="Day"><input type="date" value={form.day_date || ''}
            onChange={(e) => { const d = e.target.value; setForm(f => ({ ...f, day_date: d, week_start_date: d ? mondayOfDate(d) : f.week_start_date })); }}
            style={inp} /></Field>
          <Field label="Time"><input type="time" value={(form.scheduled_time || '').slice(0,5)} onChange={set('scheduled_time')} style={inp} /></Field>
          <Field label="Action"><select value={form.action} onChange={set('action')} style={inp}><option value="deploy">Deploy</option><option value="retrieve">Retrieve</option></select></Field>
          <Field label="Node">
            <div style={{ position: 'relative' }}>
              <button type="button" onClick={() => setPickerOpen(o => !o)}
                style={{ ...inp, textAlign: 'left', cursor: 'pointer' }}>
                {form.node_number
                  ? `#${form.node_number}${selectedNode ? ' · ' + (selectedNode.owner_name || selectedNode.label || '') : ''}`
                  : 'Pick a node…'}
              </button>
              {pickerOpen && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, background: '#0d1117', border: '1px solid #2a3444', borderRadius: 6, marginTop: 2, maxHeight: 240, overflowY: 'auto', boxShadow: '0 8px 20px rgba(0,0,0,0.6)' }}>
                  <input autoFocus type="text" value={nodeQuery} onChange={e => setNodeQuery(e.target.value)}
                    placeholder="Search number / owner / label"
                    style={{ ...inp, borderRadius: 0, borderLeft: 'none', borderRight: 'none', borderTop: 'none', position: 'sticky', top: 0 }} />
                  {filteredNodes.length === 0 && <div style={{ padding: 8, fontSize: 11, color: '#5b6675' }}>No matches.</div>}
                  {filteredNodes.map(n => (
                    <button key={n.node_number} type="button"
                      onClick={() => {
                        setForm(f => ({ ...f, node_number: n.node_number, owner_id: n.owner_id || f.owner_id, owner_name: n.owner_name || f.owner_name }));
                        setPickerOpen(false); setNodeQuery('');
                      }}
                      style={{ display: 'block', width: '100%', textAlign: 'left', background: 'transparent', border: 'none', borderBottom: '1px solid #1c2330', color: '#cdd9e5', padding: '6px 8px', fontSize: 11, cursor: 'pointer' }}>
                      <span style={{ fontWeight: 700, color: '#f0f6fc' }}>#{n.node_number}</span>
                      <span style={{ color: '#8b96a3' }}> · {n.label}</span>
                      {n.owner_name && <span style={{ color: '#8b96a3' }}> · {n.owner_name}</span>}
                      {n.scheduled && <span style={{ color: '#e8a430', marginLeft: 4 }}>● scheduled</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </Field>
          <Field label="Order"><input type="number" min="1" value={form.stop_order} onChange={set('stop_order')} style={inp} /></Field>
          <Field label="Crew"><input type="text" value={form.crew_label || ''} onChange={set('crew_label')} style={inp} placeholder="Crew A" /></Field>
        </div>
        <Field label="Owner"><input type="text" value={form.owner_name || ''} onChange={set('owner_name')} style={inp} /></Field>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <Field label="Contact"><input type="text" value={form.contact_name || ''} onChange={set('contact_name')} style={inp} /></Field>
          <Field label="Phone"><input type="text" value={form.contact_phone || ''} onChange={set('contact_phone')} style={inp} /></Field>
          <Field label="Gate"><input type="text" value={form.gate_code || ''} onChange={set('gate_code')} style={inp} /></Field>
          <Field label="Note label"><select value={form.task_label || ''} onChange={set('task_label')} style={inp}><option value="">none</option><option>Task</option><option>Access</option><option>Meet</option><option>Address</option><option>Caution</option></select></Field>
        </div>
        <Field label="Notes"><textarea rows={3} value={form.task_notes || ''} onChange={set('task_notes')} style={{ ...inp, fontFamily: 'inherit', resize: 'vertical' }} /></Field>
        {err && <div style={{ color: '#ff8a80', fontSize: 11, marginTop: 6 }}>{err}</div>}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, gap: 6 }}>
          {onDelete ? <button onClick={onDelete} style={{ ...btn, color: '#ff8a80', borderColor: '#3a1a1a' }}>Delete</button> : <span></span>}
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={onCancel} style={btn}>Cancel</button>
            <button onClick={save} disabled={busy} style={{ ...btn, background: '#9ACD32', color: '#0B2A4A', borderColor: '#9ACD32', fontWeight: 600 }}>{busy ? 'Saving…' : 'Save'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
export const inp = { width: '100%', background: '#0d1117', border: '1px solid #2a3444', color: '#cdd9e5', borderRadius: 4, padding: '5px 7px', fontSize: 12, fontFamily: '-apple-system, sans-serif' };
export const btn = { background: '#0d1117', border: '1px solid #2a3444', color: '#cdd9e5', padding: '5px 12px', borderRadius: 4, fontSize: 12, cursor: 'pointer' };
export function Field({ label, children }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 6 }}>
      <span style={{ fontSize: 10, color: '#8b96a3', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{label}</span>
      {children}
    </label>
  );
}
