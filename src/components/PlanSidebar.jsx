import React, { useEffect, useMemo, useState } from 'react';
import * as api from '../api.js';

// Slide-out side panel for editing and viewing the weekly plan, styled to
// match the surveyor's koloma_node_schedule HTML: dark surfaces, big colored
// node badges, day sections, gate code chips, colored note labels.

const ACTION_COLORS = {
  deploy:   { bg: '#3fb950', fg: '#0d1117', label: 'Deploy' },
  retrieve: { bg: '#a371f7', fg: '#0d1117', label: 'Retrieve' },
};
const LABEL_COLORS = {
  'Task':    { bg: 'rgba(139,150,163,0.18)', fg: '#cdd9e5' },
  'Access':  { bg: 'rgba(91,155,213,0.22)',  fg: '#9bd3ff' },
  'Meet':    { bg: 'rgba(163,113,247,0.22)', fg: '#c4a3ff' },
  'Address': { bg: 'rgba(63,185,80,0.22)',   fg: '#94e1a4' },
  'Caution': { bg: 'rgba(232,164,48,0.22)',  fg: '#f3c570' },
};
const DAY_NAMES = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const DAY_LONG  = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];

function fmt12(t) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = ((h + 11) % 12) + 1;
  return `${h12}:${String(m).padStart(2,'0')} ${ampm}`;
}
function fmtDateLong(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m-1, d).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}
function fmtDateChip(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  return `${m} · ${String(d).padStart(2,'0')} · ${y}`;
}

// Compute the Monday-based 7-day list for a given week_start_date.
function buildWeekDates(weekStart) {
  if (!weekStart) return [];
  const [y, m, d] = weekStart.split('-').map(Number);
  const start = new Date(Date.UTC(y, m-1, d));
  const out = [];
  for (let i = 0; i < 7; i++) {
    const t = new Date(start);
    t.setUTCDate(start.getUTCDate() + i);
    out.push(t.toISOString().slice(0,10));
  }
  return out;
}

function emptyStop(weekStart, dayDate, nextOrder) {
  return {
    id: null,
    week_start_date: weekStart,
    day_date: dayDate,
    stop_order: nextOrder,
    scheduled_time: '',
    action: 'deploy',
    node_number: '',
    owner_name: '',
    gate_code: '',
    contact_name: '',
    contact_phone: '',
    task_label: '',
    task_notes: '',
    crew_label: '',
  };
}

export default function PlanSidebar({ open, onClose, code, role }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);
  const [editing, setEditing] = useState(null); // stop being edited (null = none)
  const [newWeek, setNewWeek] = useState('');
  const canEdit = role === 'scout' || role === 'crew';

  const refresh = async (forceWeek) => {
    setError(''); setLoading(true);
    try {
      const res = await api.listScheduleStops({ code, week_start_date: forceWeek });
      setData(res);
    } catch (e) {
      setError(e.message || 'Failed to load plan');
    } finally { setLoading(false); }
  };

  useEffect(() => { if (open) refresh(); /* eslint-disable-next-line */ }, [open, code]);

  const weeks = useMemo(() => {
    if (!data) return [];
    // The endpoint returns the active week's stops but not the full list of
    // weeks — we derive it from data if multiple weeks exist. For now, we
    // surface only the current week + the option to type in a new one.
    const seen = new Set();
    if (data.week_start_date) seen.add(data.week_start_date);
    return [...seen].sort();
  }, [data]);

  const weekDates = buildWeekDates(data?.week_start_date);
  const stopsByDay = useMemo(() => {
    const m = new Map();
    for (const s of (data?.stops || [])) {
      const arr = m.get(s.day_date) || [];
      arr.push(s);
      m.set(s.day_date, arr);
    }
    for (const arr of m.values()) arr.sort((a,b) => (a.stop_order||0) - (b.stop_order||0));
    return m;
  }, [data]);

  const dayCounts = (date) => {
    const stops = stopsByDay.get(date) || [];
    return { total: stops.length, done: stops.filter(s => s.done_at).length };
  };

  const summary = useMemo(() => {
    const stops = data?.stops || [];
    const owners = new Set(stops.map(s => s.owner_name).filter(Boolean));
    return {
      total: stops.length,
      days: new Set(stops.map(s => s.day_date)).size,
      owners: owners.size,
      start: data?.week_start_date ? '08:00' : '—',
    };
  }, [data]);

  const moveStop = async (stop, delta) => {
    const sameDay = (stopsByDay.get(stop.day_date) || []).slice();
    const idx = sameDay.findIndex(s => s.id === stop.id);
    const target = idx + delta;
    if (target < 0 || target >= sameDay.length) return;
    [sameDay[idx], sameDay[target]] = [sameDay[target], sameDay[idx]];
    const updates = sameDay.map((s, i) => ({ id: s.id, stop_order: i + 1 }));
    await api.reorderScheduleStops({ code, updates });
    await refresh();
  };

  const moveStopToDay = async (stop, toDate) => {
    if (toDate === stop.day_date) return;
    const toCount = (stopsByDay.get(toDate) || []).length;
    await api.reorderScheduleStops({ code, updates: [{ id: stop.id, day_date: toDate, stop_order: toCount + 1 }] });
    // Re-pack the source day's stop_orders so there's no gap
    const sourceDay = (stopsByDay.get(stop.day_date) || []).filter(s => s.id !== stop.id);
    const repack = sourceDay.map((s, i) => ({ id: s.id, stop_order: i + 1 }));
    if (repack.length > 0) await api.reorderScheduleStops({ code, updates: repack });
    await refresh();
  };

  const saveEdit = async (form) => {
    const body = { ...form, code };
    if (body.scheduled_time && body.scheduled_time.length === 5) body.scheduled_time += ':00';
    if (body.id == null) {
      // Insert: stop_order is required and should be the next available on that day
      const day = body.day_date;
      const existing = (stopsByDay.get(day) || []).length;
      body.stop_order = existing + 1;
    }
    await api.upsertScheduleStop(body);
    setEditing(null);
    await refresh();
  };

  const deleteEdit = async () => {
    if (!editing?.id) return;
    if (!confirm('Delete this stop?')) return;
    await api.deleteScheduleStop({ code, id: editing.id });
    setEditing(null);
    await refresh();
  };

  const startNewWeek = async () => {
    if (!newWeek) return;
    // Use the chosen Monday as the new week_start_date — refresh will show empty days.
    await refresh(newWeek);
    setNewWeek('');
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-30 flex justify-end pointer-events-none">
      {/* Scrim */}
      <div className="absolute inset-0 bg-black/40 pointer-events-auto" onClick={onClose}></div>
      {/* Panel */}
      <div className="relative pointer-events-auto h-full w-full max-w-[480px] overflow-y-auto"
           style={{ background: '#0d1117', color: '#cdd9e5', fontFamily: '-apple-system, BlinkMacSystemFont, Inter, Segoe UI, sans-serif' }}>
        {/* Header */}
        <div style={{ padding: '14px 16px', borderBottom: '1px solid #2a3444', position: 'sticky', top: 0, background: '#0d1117', zIndex: 5 }}>
          <div className="flex items-center justify-between mb-2">
            <div style={{ fontSize: 11, letterSpacing: '0.1em', color: '#8b96a3' }}>■ KOLOMA FIELD OPERATIONS</div>
            <button onClick={onClose} style={{ background: 'transparent', border: '1px solid #2a3444', color: '#cdd9e5', padding: '4px 10px', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>Close ✕</button>
          </div>
          <div style={{ fontSize: 22, fontWeight: 600, color: '#f0f6fc', marginBottom: 8 }}>Node Placement Schedule</div>
          <div style={{ display: 'flex', gap: 14, fontSize: 11, color: '#8b96a3' }}>
            <div>Week of <span style={{ color: '#cdd9e5' }}>{data?.week_start_date ? fmtDateLong(data.week_start_date) : '—'}</span></div>
          </div>
          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginTop: 10 }}>
            {[
              ['Total Stops', summary.total],
              ['Field Days', summary.days],
              ['Landowners', summary.owners],
              ['Crew Start', summary.start],
            ].map(([l, v]) => (
              <div key={l} style={{ background: '#161b22', border: '1px solid #2a3444', borderRadius: 6, padding: '6px 8px' }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#f0f6fc', lineHeight: 1 }}>{v}</div>
                <div style={{ fontSize: 9, letterSpacing: '0.08em', color: '#8b96a3', marginTop: 2 }}>{l.toUpperCase()}</div>
              </div>
            ))}
          </div>
          {/* Legend + new-week control */}
          <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 12, fontSize: 11 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#3fb950', display: 'inline-block' }}></span>Deploy</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#a371f7', display: 'inline-block' }}></span>Retrieve</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#e8a430', display: 'inline-block' }}></span>Gate</span>
            <span style={{ flex: 1 }}></span>
            {canEdit && (
              <>
                <input type="date" value={newWeek} onChange={e => setNewWeek(e.target.value)}
                  style={{ background: '#161b22', border: '1px solid #2a3444', borderRadius: 4, color: '#cdd9e5', fontSize: 11, padding: '2px 4px' }} />
                <button onClick={startNewWeek} disabled={!newWeek}
                  style={{ background: '#161b22', border: '1px solid #2a3444', color: '#cdd9e5', borderRadius: 4, fontSize: 11, padding: '2px 8px', cursor: 'pointer', opacity: newWeek ? 1 : 0.5 }}>
                  New week
                </button>
              </>
            )}
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: 12, paddingBottom: 80 }}>
          {error && <div style={{ color: '#ff8a80', fontSize: 12, marginBottom: 8 }}>{error}</div>}
          {loading && <div style={{ fontSize: 12, color: '#8b96a3' }}>Loading…</div>}
          {!loading && (!data?.week_start_date) && (
            <div style={{ fontSize: 13, color: '#8b96a3', background: '#161b22', border: '1px solid #2a3444', borderRadius: 6, padding: 14 }}>
              No plan yet. Pick a Monday above and tap "New week" to start.
            </div>
          )}
          {data?.week_start_date && weekDates.map((date, i) => {
            const stops = stopsByDay.get(date) || [];
            const cnt = dayCounts(date);
            return (
              <div key={date} style={{ marginBottom: 16 }}>
                {/* Day header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0 6px', borderBottom: '1px solid #2a3444', marginBottom: 8 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#f0f6fc' }}>{DAY_LONG[i]}</div>
                  <div style={{ fontSize: 11, color: '#8b96a3', fontFamily: 'ui-monospace, monospace' }}>{fmtDateChip(date)}</div>
                  <div style={{ flex: 1, height: 1, background: '#2a3444' }}></div>
                  <div style={{ fontSize: 11, color: '#8b96a3' }}>{cnt.done}/{cnt.total}{cnt.total > 0 && cnt.done === cnt.total ? ' ✓' : ''}</div>
                  {canEdit && (
                    <button onClick={() => setEditing(emptyStop(data.week_start_date, date, stops.length + 1))}
                      style={{ background: '#161b22', border: '1px solid #2a3444', color: '#cdd9e5', borderRadius: 4, fontSize: 10, padding: '2px 8px', cursor: 'pointer' }}>+ Add</button>
                  )}
                </div>
                {/* Stops */}
                {stops.length === 0 ? (
                  <div style={{ fontSize: 11, color: '#5b6675', padding: '4px 0' }}>No stops.</div>
                ) : stops.map((s, idx) => {
                  const ac = ACTION_COLORS[s.action] || ACTION_COLORS.deploy;
                  const lab = LABEL_COLORS[s.task_label] || LABEL_COLORS['Task'];
                  const done = !!s.done_at;
                  const dirUrl = (s.lat != null && s.lng != null) ? `https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lng}&travelmode=driving` : null;
                  const phoneClean = (s.contact_phone || '').replace(/[^\d]/g, '');
                  return (
                    <div key={s.id} style={{
                      background: '#161b22', border: '1px solid #2a3444', borderRadius: 6,
                      marginBottom: 6, overflow: 'hidden', opacity: done ? 0.6 : 1,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'stretch' }}>
                        {/* Big node badge */}
                        <div style={{ background: ac.bg, color: ac.fg, padding: '8px 10px', minWidth: 54, textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                          <div style={{ fontSize: 20, fontWeight: 700, lineHeight: 1, textDecoration: done ? 'line-through' : 'none' }}>{s.node_number}</div>
                          <div style={{ fontSize: 8, letterSpacing: '0.1em', opacity: 0.8 }}>NODE</div>
                        </div>
                        {/* Body */}
                        <div style={{ flex: 1, padding: '8px 10px', minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
                            <span style={{ background: ac.bg + '33', color: ac.bg, padding: '1px 6px', borderRadius: 3, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>{s.action}</span>
                            {s.scheduled_time && <span style={{ fontFamily: 'ui-monospace, monospace', color: '#8b96a3' }}>{fmt12(s.scheduled_time)}</span>}
                            <span style={{ flex: 1 }}></span>
                            {done && <span style={{ color: '#3fb950', fontSize: 10 }}>✓ done</span>}
                          </div>
                          <div style={{ color: '#f0f6fc', fontSize: 14, fontWeight: 500, marginTop: 2, textDecoration: done ? 'line-through' : 'none', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.owner_name || '—'}</div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, fontSize: 11, marginTop: 4 }}>
                            {s.contact_phone && (
                              <a href={`tel:${phoneClean}`} style={{ color: '#5b9bd5', textDecoration: 'none' }}>
                                📞 {s.contact_name ? s.contact_name + ' · ' : ''}{s.contact_phone}
                              </a>
                            )}
                            {s.gate_code && <span style={{ background: 'rgba(232,164,48,0.18)', color: '#f3c570', padding: '1px 6px', borderRadius: 3 }}>Gate {s.gate_code}</span>}
                          </div>
                          {s.task_notes && (
                            <div style={{ marginTop: 6, padding: '5px 8px', borderRadius: 4, background: lab.bg, color: lab.fg, fontSize: 11 }}>
                              <strong style={{ textTransform: 'uppercase', fontSize: 9, letterSpacing: '0.1em', marginRight: 4 }}>{s.task_label || 'Note'}</strong>
                              {s.task_notes}
                            </div>
                          )}
                          {/* Action row */}
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                            {dirUrl && (
                              <a href={dirUrl} target="_blank" rel="noopener noreferrer"
                                 style={{ fontSize: 10, padding: '3px 8px', borderRadius: 3, background: '#1c2330', border: '1px solid #2a3444', color: '#cdd9e5', textDecoration: 'none' }}>🚗 Directions</a>
                            )}
                            {canEdit && (
                              <>
                                <button onClick={() => moveStop(s, -1)} disabled={idx === 0}
                                  style={{ fontSize: 10, padding: '3px 6px', borderRadius: 3, background: '#1c2330', border: '1px solid #2a3444', color: '#cdd9e5', cursor: idx === 0 ? 'not-allowed' : 'pointer', opacity: idx === 0 ? 0.4 : 1 }}>▲</button>
                                <button onClick={() => moveStop(s, +1)} disabled={idx === stops.length - 1}
                                  style={{ fontSize: 10, padding: '3px 6px', borderRadius: 3, background: '#1c2330', border: '1px solid #2a3444', color: '#cdd9e5', cursor: idx === stops.length - 1 ? 'not-allowed' : 'pointer', opacity: idx === stops.length - 1 ? 0.4 : 1 }}>▼</button>
                                <select onChange={e => moveStopToDay(s, e.target.value)} value={s.day_date}
                                  style={{ fontSize: 10, padding: '2px 4px', borderRadius: 3, background: '#1c2330', border: '1px solid #2a3444', color: '#cdd9e5' }}>
                                  {weekDates.map((d, j) => <option key={d} value={d}>→ {DAY_NAMES[j]}</option>)}
                                </select>
                                <button onClick={() => setEditing(s)}
                                  style={{ fontSize: 10, padding: '3px 8px', borderRadius: 3, background: '#1c2330', border: '1px solid #2a3444', color: '#cdd9e5', cursor: 'pointer', marginLeft: 'auto' }}>Edit</button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* Stop editor sub-modal */}
      {editing && <StopEditor stop={editing} weekDates={weekDates} onCancel={() => setEditing(null)} onSave={saveEdit} onDelete={editing.id ? deleteEdit : null} />}
    </div>
  );
}

function StopEditor({ stop, weekDates, onCancel, onSave, onDelete }) {
  const [form, setForm] = useState(stop);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));
  const save = async () => {
    if (!form.node_number) { setErr('Node # is required.'); return; }
    setErr(''); setBusy(true);
    try { await onSave(form); }
    catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center pointer-events-auto" style={{ background: 'rgba(0,0,0,0.5)' }}>
      <div style={{ background: '#161b22', border: '1px solid #2a3444', color: '#cdd9e5', width: '92%', maxWidth: 440, borderRadius: 10, padding: 16, fontFamily: '-apple-system, BlinkMacSystemFont, Inter, sans-serif' }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#f0f6fc', marginBottom: 10 }}>{stop.id ? 'Edit stop' : 'New stop'}</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <Field label="Day"><select value={form.day_date} onChange={set('day_date')} style={inp}>{weekDates.map(d => <option key={d} value={d}>{d}</option>)}</select></Field>
          <Field label="Time"><input type="time" value={(form.scheduled_time || '').slice(0,5)} onChange={set('scheduled_time')} style={inp} /></Field>
          <Field label="Action"><select value={form.action} onChange={set('action')} style={inp}><option value="deploy">Deploy</option><option value="retrieve">Retrieve</option></select></Field>
          <Field label="Node #"><input type="number" min="1" value={form.node_number} onChange={set('node_number')} style={inp} /></Field>
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
const inp = { width: '100%', background: '#0d1117', border: '1px solid #2a3444', color: '#cdd9e5', borderRadius: 4, padding: '5px 7px', fontSize: 12, fontFamily: '-apple-system, sans-serif' };
const btn = { background: '#0d1117', border: '1px solid #2a3444', color: '#cdd9e5', padding: '5px 12px', borderRadius: 4, fontSize: 12, cursor: 'pointer' };
function Field({ label, children }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 6 }}>
      <span style={{ fontSize: 10, color: '#8b96a3', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{label}</span>
      {children}
    </label>
  );
}
