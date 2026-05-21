import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import * as api from '../api.js';
import StopEditor, { inp, btn } from './StopEditor.jsx';

// Full-screen schedule board: every week is a column, every day a section.
// Drag cards between days/weeks, click a card to edit, use Select mode for
// bulk moves, and the Add Nodes drawer to schedule nodes that aren't placed.

const C = {
  bg: '#0d1117', surface: '#161b22', surface2: '#1c2330', border: '#2a3444',
  text: '#cdd9e5', bright: '#f0f6fc', muted: '#8b96a3', dim: '#5b6675',
  deploy: '#3fb950', retrieve: '#a371f7', amber: '#e8a430',
  accent: '#9ACD32', sel: '#FACC15',
};
const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const COL_W = 264;
const menuItem = {
  display: 'block', width: '100%', textAlign: 'left', background: 'transparent',
  border: 'none', borderBottom: '1px solid ' + C.border, color: C.text,
  padding: '7px 10px', fontSize: 11, cursor: 'pointer',
};

function pad2(n) { return String(n).padStart(2, '0'); }
function shiftDays(iso, days) {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}
function buildWeekDates(weekStart) {
  const out = [];
  for (let i = 0; i < 7; i++) out.push(shiftDays(weekStart, i));
  return out;
}
function currentMondayISO() {
  const now = new Date();
  const dow = now.getDay();
  const toMon = dow === 0 ? -6 : 1 - dow;
  const m = new Date(now);
  m.setDate(now.getDate() + toMon);
  return `${m.getFullYear()}-${pad2(m.getMonth() + 1)}-${pad2(m.getDate())}`;
}
// The Monday (YYYY-MM-DD) of the week containing any ISO date.
function mondayOf(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const dow = dt.getUTCDay();
  dt.setUTCDate(dt.getUTCDate() - (dow === 0 ? 6 : dow - 1));
  return dt.toISOString().slice(0, 10);
}
function todayISO() {
  const n = new Date();
  return `${n.getFullYear()}-${pad2(n.getMonth() + 1)}-${pad2(n.getDate())}`;
}
function fmtWeekRange(weekStart) {
  const end = shiftDays(weekStart, 6);
  const [, ms, ds] = weekStart.split('-').map(Number);
  const [, me, de] = end.split('-').map(Number);
  return `${MON[ms - 1]} ${ds} – ${ms === me ? de : MON[me - 1] + ' ' + de}`;
}
function fmtMD(iso) {
  const [, m, d] = iso.split('-').map(Number);
  return `${m}/${pad2(d)}`;
}
function reorderArr(arr) {
  return arr.slice().sort((a, b) => (a.stop_order || 0) - (b.stop_order || 0));
}

// Pure: returns the full stop list after moving `stopId` into (toWeek,toDay) at
// position toIndex, plus the re-indexed target and source day lists. `toIndex`
// is an index within the target day's list AFTER the moving card is removed.
function computeMove(stops, stopId, toWeek, toDay, toIndex) {
  const moving = stops.find((s) => s.id === stopId);
  if (!moving) return { next: stops, targetList: [], sourceList: [] };
  const fromWeek = moving.week_start_date, fromDay = moving.day_date;
  const sameDay = fromWeek === toWeek && fromDay === toDay;
  const rest = stops.filter((s) => s.id !== stopId);
  let target = reorderArr(rest.filter((s) => s.week_start_date === toWeek && s.day_date === toDay));
  const movedUpdated = { ...moving, week_start_date: toWeek, day_date: toDay };
  const idx = Math.max(0, Math.min(toIndex == null ? target.length : toIndex, target.length));
  target.splice(idx, 0, movedUpdated);
  target = target.map((s, i) => ({ ...s, stop_order: i + 1 }));
  let source = [];
  if (!sameDay) {
    source = reorderArr(rest.filter((s) => s.week_start_date === fromWeek && s.day_date === fromDay))
      .map((s, i) => ({ ...s, stop_order: i + 1 }));
  }
  const touched = new Set([...target.map((s) => s.id), ...source.map((s) => s.id)]);
  const next = rest.filter((s) => !touched.has(s.id)).concat(target, source);
  return { next, targetList: target, sourceList: source, fromWeek, fromDay };
}

// ---- compact stop card ----------------------------------------------------
function StopCard({ stop, canEdit, selectMode, selected, dragging, onClick, onDragStart, onDragEnd, onDragOver }) {
  const accent = stop.action === 'retrieve' ? C.retrieve : C.deploy;
  const done = !!stop.done_at;
  return (
    <div
      draggable={canEdit && !selectMode}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onClick={onClick}
      title={canEdit ? (selectMode ? 'Tap to select' : 'Drag to move - click to edit') : ''}
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        background: selected ? 'rgba(250,204,21,0.12)' : C.surface,
        border: `1px solid ${selected ? C.sel : C.border}`,
        borderLeft: `3px solid ${accent}`,
        borderRadius: 5, padding: '4px 6px', marginBottom: 4,
        cursor: canEdit ? (selectMode ? 'pointer' : 'grab') : 'default',
        opacity: dragging ? 0.4 : done ? 0.55 : 1,
      }}
    >
      {selectMode && (
        <span style={{
          width: 14, height: 14, borderRadius: 3, flexShrink: 0,
          border: `1px solid ${selected ? C.sel : C.muted}`,
          background: selected ? C.sel : 'transparent',
          color: C.bg, fontSize: 11, lineHeight: '13px', textAlign: 'center', fontWeight: 700,
        }}>{selected ? '✓' : ''}</span>
      )}
      <span style={{
        fontSize: 13, fontWeight: 700, color: accent, minWidth: 24, textAlign: 'center',
        textDecoration: done ? 'line-through' : 'none',
      }}>{stop.node_number != null ? stop.node_number : '—'}</span>
      <span style={{
        flex: 1, minWidth: 0, fontSize: 11, color: C.text, whiteSpace: 'nowrap',
        overflow: 'hidden', textOverflow: 'ellipsis',
        textDecoration: done ? 'line-through' : 'none',
      }}>{stop.owner_name || '—'}</span>
      {stop.scheduled_time && (
        <span style={{ fontSize: 9, color: C.muted, fontFamily: 'ui-monospace, monospace' }}>
          {stop.scheduled_time.slice(0, 5)}
        </span>
      )}
      {done && <span style={{ fontSize: 9, color: C.deploy }}>{'✓'}</span>}
    </div>
  );
}

export default function ScheduleBoard({ code, role, onClose }) {
  const canEdit = role === 'scout' || role === 'crew';

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [allStops, setAllStops] = useState([]);
  const [serverWeeks, setServerWeeks] = useState([]);
  const [extraWeeks, setExtraWeeks] = useState([]);
  const [allNodes, setAllNodes] = useState([]);

  const [editing, setEditing] = useState(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [bulkWeek, setBulkWeek] = useState('');
  const [bulkDay, setBulkDay] = useState(0);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [nodeSearch, setNodeSearch] = useState('');
  const [drawerSel, setDrawerSel] = useState(new Set());
  const [drawerWeek, setDrawerWeek] = useState('');
  const [drawerDay, setDrawerDay] = useState(0);
  const [drawerAction, setDrawerAction] = useState('deploy');
  const [dayMenu, setDayMenu] = useState(null);

  const [drag, setDragState] = useState(null);
  const [dropT, setDropTState] = useState(null);
  const dragRef = useRef(null);
  const dropRef = useRef(null);
  const colRefs = useRef({});
  const didScroll = useRef(false);
  const opQueue = useRef(Promise.resolve());

  // Serialize every schedule write so quick successive drags / edits are
  // persisted in the order the user made them (no out-of-order overwrites).
  const enqueue = (fn) => {
    const next = opQueue.current.then(fn);
    opQueue.current = next.catch(() => {});
    return next;
  };

  // ---- data loading -------------------------------------------------------
  const loadAll = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const base = await api.listScheduleStops({ code });
      let wl = [...(base.all_weeks || [])];
      if (base.week_start_date) wl.push(base.week_start_date);
      wl = [...new Set(wl.filter(Boolean))].sort();
      if (wl.length === 0) {
        const cm = currentMondayISO();
        wl = [0, 1, 2, 3].map((i) => shiftDays(cm, i * 7));
      }
      const results = await Promise.all(
        wl.map((w) => api.listScheduleStops({ code, week_start_date: w })
          .then((r) => r.stops || []).catch(() => []))
      );
      const stops = [];
      results.forEach((arr) => arr.forEach((s) => stops.push(s)));
      setAllStops(stops);
      setServerWeeks(wl);
    } catch (e) {
      setError((e && e.message) || 'Could not load the schedule');
    } finally {
      setLoading(false);
    }
  }, [code]);

  const loadNodes = useCallback(async () => {
    try {
      const r = await api.listAllNodes({ code });
      setAllNodes(r.nodes || []);
    } catch (e) { /* drawer just stays empty */ }
  }, [code]);

  useEffect(() => { loadAll(); loadNodes(); }, [loadAll, loadNodes]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && !editing) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, editing]);

  // ---- derived ------------------------------------------------------------
  const weeks = useMemo(() => {
    const set = new Set();
    serverWeeks.forEach((w) => set.add(w));
    extraWeeks.forEach((w) => set.add(w));
    allStops.forEach((s) => { if (s.week_start_date) set.add(s.week_start_date); });
    return [...set].sort();
  }, [serverWeeks, extraWeeks, allStops]);

  const stopsByKey = useMemo(() => {
    const m = new Map();
    for (const s of allStops) {
      const k = s.week_start_date + '|' + s.day_date;
      const a = m.get(k) || [];
      a.push(s);
      m.set(k, a);
    }
    for (const a of m.values()) a.sort((x, y) => (x.stop_order || 0) - (y.stop_order || 0));
    return m;
  }, [allStops]);

  const scheduledNums = useMemo(() => new Set(allStops.map((s) => s.node_number)), [allStops]);
  const unscheduledNodes = useMemo(
    () => allNodes.filter((n) => !scheduledNums.has(n.node_number)),
    [allNodes, scheduledNums]
  );

  const summary = useMemo(() => ({
    stops: allStops.length,
    weeks: weeks.length,
    days: new Set(allStops.map((s) => s.week_start_date + '|' + s.day_date)).size,
  }), [allStops, weeks]);

  // Default the week selectors once weeks are known.
  useEffect(() => {
    if (!weeks.length) return;
    const cw = currentMondayISO();
    const def = weeks.includes(cw) ? cw : weeks[0];
    setBulkWeek((v) => v || def);
    setDrawerWeek((v) => v || def);
  }, [weeks]);

  // Scroll to the current week once, after the first load.
  useEffect(() => {
    if (loading || didScroll.current || !weeks.length) return;
    didScroll.current = true;
    const cw = currentMondayISO();
    const target = weeks.includes(cw) ? cw : weeks[0];
    const el = colRefs.current[target];
    if (el && el.scrollIntoView) el.scrollIntoView({ inline: 'start', block: 'nearest' });
  }, [loading, weeks]);

  // ---- drag plumbing ------------------------------------------------------
  const startDrag = (info) => { dragRef.current = info; setDragState(info); };
  const endDrag = () => { dragRef.current = null; dropRef.current = null; setDragState(null); setDropTState(null); };
  const setDrop = (v) => {
    const cur = dropRef.current;
    if (!cur && !v) return;
    if (cur && v && cur.week === v.week && cur.day === v.day && cur.index === v.index) return;
    dropRef.current = v;
    setDropTState(v);
  };
  const onCardDragOver = (e, week, day, idx) => {
    if (!dragRef.current) return;
    e.preventDefault(); e.stopPropagation();
    const r = e.currentTarget.getBoundingClientRect();
    const after = e.clientY > r.top + r.height / 2;
    setDrop({ week, day, index: idx + (after ? 1 : 0) });
  };
  const onDayDragOver = (e, week, day, count) => {
    if (!dragRef.current) return;
    e.preventDefault();
    setDrop({ week, day, index: count });
  };
  const onDayDrop = (e, week, day) => {
    if (!dragRef.current) return;
    e.preventDefault();
    const d = dragRef.current;
    const dt = dropRef.current;
    const count = (stopsByKey.get(week + '|' + day) || []).length;
    const index = dt && dt.week === week && dt.day === day ? dt.index : count;
    endDrag();
    if (d.type === 'stop') doMove(d.id, week, day, index);
    else if (d.type === 'node') addNodes([d.node], week, day, drawerAction);
    else if (d.type === 'day') moveDay(d.date, day);
  };

  // ---- mutations (all writes routed through enqueue) ----------------------
  function doMove(stopId, toWeek, toDay, toIndex) {
    const moving = allStops.find((s) => s.id === stopId);
    if (!moving) return;
    const fromWeek = moving.week_start_date, fromDay = moving.day_date;
    const sameDay = fromWeek === toWeek && fromDay === toDay;
    let idx = toIndex;
    if (sameDay) {
      const curIdx = (stopsByKey.get(toWeek + '|' + toDay) || []).findIndex((s) => s.id === stopId);
      if (curIdx > -1 && curIdx < idx) idx -= 1;
      if (curIdx === idx) return; // dropped in its current spot
    }
    const { next, targetList, sourceList } = computeMove(allStops, stopId, toWeek, toDay, idx);
    setAllStops(next);   // optimistic - the board updates instantly
    setError('');
    enqueue(async () => {
      try {
        if (fromWeek !== toWeek) {
          await api.upsertScheduleStop({ ...moving, code, week_start_date: toWeek, day_date: toDay });
        }
        await api.reorderScheduleStops({
          code,
          updates: targetList.map((s, i) => ({ id: s.id, day_date: toDay, stop_order: i + 1 })),
        });
        if (sourceList.length) {
          await api.reorderScheduleStops({
            code,
            updates: sourceList.map((s, i) => ({ id: s.id, day_date: fromDay, stop_order: i + 1 })),
          });
        }
      } catch (e) {
        setError((e && e.message) || 'Move failed - reloading the board');
        await loadAll();
      }
    });
  }

  function addNodes(nodes, toWeek, toDay, action) {
    if (!nodes.length) return Promise.resolve();
    return enqueue(async () => {
      setBusy(true); setError('');
      try {
        let order = allStops.filter((s) => s.week_start_date === toWeek && s.day_date === toDay).length;
        for (const n of nodes) {
          order += 1;
          await api.upsertScheduleStop({
            code, week_start_date: toWeek, day_date: toDay, stop_order: order,
            action: action || 'deploy', node_number: n.node_number,
            owner_id: n.owner_id != null ? n.owner_id : null, owner_name: n.owner_name || '',
            scheduled_time: '', gate_code: '', contact_name: '', contact_phone: '',
            task_label: '', task_notes: '', crew_label: '',
          });
        }
        await loadAll();
      } catch (e) {
        setError((e && e.message) || 'Could not add nodes');
      } finally {
        setBusy(false);
      }
    });
  }

  function doBulkMove() {
    if (!selected.size || !bulkWeek) return;
    const toWeek = bulkWeek;
    const toDay = buildWeekDates(toWeek)[bulkDay || 0];
    const chosen = allStops.filter((s) => selected.has(s.id)).sort((a, b) =>
      (a.week_start_date || '').localeCompare(b.week_start_date || '') ||
      (a.day_date || '').localeCompare(b.day_date || '') ||
      (a.stop_order || 0) - (b.stop_order || 0));
    enqueue(async () => {
      setBusy(true); setError('');
      try {
        for (const s of chosen) {
          await api.upsertScheduleStop({ ...s, code, week_start_date: toWeek, day_date: toDay });
        }
        setSelected(new Set());
        await loadAll();
      } catch (e) {
        setError((e && e.message) || 'Bulk move failed');
        await loadAll();
      } finally {
        setBusy(false);
      }
    });
  }

  function doBulkDelete() {
    const ids = [...selected];
    if (!ids.length) return;
    if (!window.confirm(`Delete ${ids.length} stop${ids.length > 1 ? 's' : ''}? This cannot be undone.`)) return;
    enqueue(async () => {
      setBusy(true); setError('');
      try {
        for (const id of ids) await api.deleteScheduleStop({ code, id });
        setSelected(new Set());
        await loadAll();
      } catch (e) {
        setError((e && e.message) || 'Delete failed');
        await loadAll();
      } finally {
        setBusy(false);
      }
    });
  }

  function saveEdit(form) {
    const body = { ...form, code };
    if (body.scheduled_time && body.scheduled_time.length === 5) body.scheduled_time += ':00';
    if (body.id == null) {
      const cnt = allStops.filter((s) => s.week_start_date === body.week_start_date && s.day_date === body.day_date).length;
      body.stop_order = cnt + 1;
    }
    return enqueue(async () => {
      await api.upsertScheduleStop(body);
      setEditing(null);
      await loadAll();
    });
  }

  function deleteEdit() {
    if (!editing || !editing.id) return;
    if (!window.confirm('Delete this stop?')) return;
    const id = editing.id;
    return enqueue(async () => {
      await api.deleteScheduleStop({ code, id });
      setEditing(null);
      await loadAll();
    });
  }

  // ---- day-level operations (insert / remove / move a whole day) ----------
  // Bulk re-date many stops at once, then persist via the shift endpoint.
  function applyShift(updates) {
    if (!updates.length) return;
    const byId = new Map(updates.map((u) => [u.id, u.day_date]));
    setAllStops((prev) => prev.map((s) => (byId.has(s.id)
      ? { ...s, day_date: byId.get(s.id), week_start_date: mondayOf(byId.get(s.id)) }
      : s)));
    setError('');
    enqueue(async () => {
      setBusy(true);
      try {
        await api.shiftScheduleStops({ code, updates });
        await loadAll();
      } catch (e) {
        setError((e && e.message) || 'Could not shift the schedule');
        await loadAll();
      } finally {
        setBusy(false);
      }
    });
  }

  // Insert a blank day. 'before' pushes this day and everything later back by
  // one; 'after' pushes everything strictly later. Ripples to the schedule end.
  function insertDay(date, where) {
    const updates = [];
    for (const s of allStops) {
      const hit = where === 'before' ? s.day_date >= date : s.day_date > date;
      if (hit) updates.push({ id: s.id, day_date: shiftDays(s.day_date, 1) });
    }
    if (!updates.length) { setError('Nothing after this day to push back.'); return; }
    applyShift(updates);
  }

  // Remove an empty day: pull every later stop up by one day.
  function removeDay(date) {
    if (allStops.some((s) => s.day_date === date)) {
      setError('That day still has stops - move or delete them first.');
      return;
    }
    const updates = [];
    for (const s of allStops) {
      if (s.day_date > date) updates.push({ id: s.id, day_date: shiftDays(s.day_date, -1) });
    }
    if (!updates.length) { setError('Nothing after this day to pull up.'); return; }
    applyShift(updates);
  }

  // Move a whole day to another date: the dragged day takes the target date,
  // and the days in between slide over to make room.
  function moveDay(fromDate, toDate) {
    if (!fromDate || !toDate || fromDate === toDate) return;
    const updates = [];
    for (const s of allStops) {
      let nd = s.day_date;
      if (s.day_date === fromDate) nd = toDate;
      else if (fromDate < toDate && s.day_date > fromDate && s.day_date <= toDate) nd = shiftDays(s.day_date, -1);
      else if (fromDate > toDate && s.day_date >= toDate && s.day_date < fromDate) nd = shiftDays(s.day_date, 1);
      if (nd !== s.day_date) updates.push({ id: s.id, day_date: nd });
    }
    applyShift(updates);
  }

  // ---- selection helpers --------------------------------------------------
  const toggleSel = (id) => setSelected((p) => {
    const n = new Set(p);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });
  const selectDay = (week, day) => {
    const ids = (stopsByKey.get(week + '|' + day) || []).map((s) => s.id);
    if (!ids.length) return;
    setSelected((p) => {
      const n = new Set(p);
      const all = ids.every((i) => n.has(i));
      ids.forEach((i) => (all ? n.delete(i) : n.add(i)));
      return n;
    });
  };
  const selectWeek = (week) => {
    const ids = allStops.filter((s) => s.week_start_date === week).map((s) => s.id);
    if (!ids.length) return;
    setSelected((p) => {
      const n = new Set(p);
      const all = ids.every((i) => n.has(i));
      ids.forEach((i) => (all ? n.delete(i) : n.add(i)));
      return n;
    });
  };

  const addWeek = () => {
    const last = weeks[weeks.length - 1] || currentMondayISO();
    setExtraWeeks((p) => [...new Set([...p, shiftDays(last, 7)])]);
  };

  const emptyStop = (week, day) => ({
    id: null, week_start_date: week, day_date: day, stop_order: 1,
    scheduled_time: '', action: 'deploy', node_number: '', owner_name: '', owner_id: null,
    gate_code: '', contact_name: '', contact_phone: '', task_label: '', task_notes: '', crew_label: '',
  });

  // ---- drawer node selection ---------------------------------------------
  const filteredNodes = useMemo(() => {
    const q = nodeSearch.trim().toLowerCase();
    const list = q
      ? unscheduledNodes.filter((n) =>
          String(n.node_number).includes(q) ||
          (n.label || '').toLowerCase().includes(q) ||
          (n.owner_name || '').toLowerCase().includes(q))
      : unscheduledNodes;
    return list.slice(0, 300);
  }, [unscheduledNodes, nodeSearch]);

  const addFromDrawer = async () => {
    const chosen = unscheduledNodes.filter((n) => drawerSel.has(n.node_number));
    if (!chosen.length || !drawerWeek) return;
    const toDay = buildWeekDates(drawerWeek)[drawerDay || 0];
    setDrawerSel(new Set());
    await addNodes(chosen, drawerWeek, toDay, drawerAction);
  };

  // ---- render -------------------------------------------------------------
  const chip = (label, value) => (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6, padding: '4px 10px', textAlign: 'center' }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: C.bright, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 8, letterSpacing: '0.08em', color: C.muted, marginTop: 2 }}>{label}</div>
    </div>
  );
  const hdrBtn = (active) => ({
    background: active ? C.accent : C.surface,
    color: active ? C.bg : C.text,
    border: `1px solid ${active ? C.accent : C.border}`,
    borderRadius: 6, padding: '5px 11px', fontSize: 12, cursor: 'pointer',
    fontWeight: active ? 700 : 500,
  });

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 60, background: C.bg, color: C.text,
      display: 'flex', flexDirection: 'column',
      fontFamily: '-apple-system, BlinkMacSystemFont, Inter, Segoe UI, sans-serif',
    }}>
      {/* Header */}
      <div style={{ padding: '10px 14px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 17, fontWeight: 700, color: C.bright }}>Schedule Board</div>
          <div style={{ fontSize: 10, color: C.muted }}>Drag cards between days and weeks - click a card to edit</div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {chip('STOPS', summary.stops)}
          {chip('WEEKS', summary.weeks)}
          {chip('FIELD DAYS', summary.days)}
          {chip('UNSCHEDULED', unscheduledNodes.length)}
        </div>
        <div style={{ flex: 1 }} />
        {busy && <span style={{ fontSize: 11, color: C.muted }}>Saving...</span>}
        {canEdit && (
          <button style={hdrBtn(drawerOpen)} onClick={() => setDrawerOpen((o) => !o)}>+ Add nodes</button>
        )}
        {canEdit && (
          <button style={hdrBtn(selectMode)} onClick={() => { setSelectMode((s) => !s); setSelected(new Set()); }}>
            {selectMode ? 'Exit select' : 'Select'}
          </button>
        )}
        <button style={{ ...hdrBtn(false), fontWeight: 700 }} onClick={onClose} title="Close board (Esc)">{'✕'} Close</button>
      </div>

      {/* Bulk action bar */}
      {selectMode && (
        <div style={{ padding: '8px 14px', borderBottom: `1px solid ${C.border}`, background: C.surface2, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: C.bright, fontWeight: 600 }}>
            {selected.size} selected
          </span>
          <span style={{ fontSize: 11, color: C.muted }}>
            - tick cards, or use "all" on a day/week header, then move them together
          </span>
          <div style={{ flex: 1 }} />
          <span style={{ fontSize: 11, color: C.muted }}>Move to</span>
          <select value={bulkWeek} onChange={(e) => setBulkWeek(e.target.value)} style={{ ...inp, width: 'auto' }}>
            {weeks.map((w) => <option key={w} value={w}>Week of {fmtWeekRange(w)}</option>)}
          </select>
          <select value={bulkDay} onChange={(e) => setBulkDay(Number(e.target.value))} style={{ ...inp, width: 'auto' }}>
            {DAY_NAMES.map((d, i) => (
              <option key={d} value={i}>{d}{bulkWeek ? ' ' + fmtMD(buildWeekDates(bulkWeek)[i]) : ''}</option>
            ))}
          </select>
          <button
            disabled={!selected.size || busy}
            onClick={doBulkMove}
            style={{ ...btn, background: C.accent, color: C.bg, borderColor: C.accent, fontWeight: 700, opacity: selected.size ? 1 : 0.5 }}
          >Move {selected.size || ''}</button>
          <button
            disabled={!selected.size || busy}
            onClick={doBulkDelete}
            style={{ ...btn, color: '#ff8a80', borderColor: '#3a1a1a', opacity: selected.size ? 1 : 0.5 }}
          >Delete</button>
          <button onClick={() => setSelected(new Set())} style={btn}>Clear</button>
        </div>
      )}

      {error && (
        <div style={{ padding: '6px 14px', background: 'rgba(255,138,128,0.1)', color: '#ff8a80', fontSize: 12 }}>
          {error}
        </div>
      )}

      {/* Board body */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <div style={{ flex: 1, display: 'flex', overflowX: 'auto', overflowY: 'hidden' }}>
          {loading && (
            <div style={{ padding: 30, fontSize: 13, color: C.muted }}>Loading the schedule...</div>
          )}
          {!loading && weeks.map((week) => {
            const days = buildWeekDates(week);
            const weekCount = allStops.filter((s) => s.week_start_date === week).length;
            const isCurrent = week === currentMondayISO();
            return (
              <div
                key={week}
                ref={(el) => { colRefs.current[week] = el; }}
                style={{
                  flex: `0 0 ${COL_W}px`, width: COL_W, display: 'flex', flexDirection: 'column',
                  borderRight: `1px solid ${C.border}`,
                  background: isCurrent ? 'rgba(154,205,50,0.04)' : 'transparent',
                }}
              >
                {/* Week header */}
                <div style={{ padding: '8px 10px', borderBottom: `1px solid ${C.border}`, background: C.surface }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: isCurrent ? C.accent : C.bright }}>
                      {fmtWeekRange(week)}
                    </div>
                    {isCurrent && <span style={{ fontSize: 8, color: C.accent, border: `1px solid ${C.accent}`, borderRadius: 3, padding: '0 4px' }}>THIS WEEK</span>}
                    <div style={{ flex: 1 }} />
                    <span style={{ fontSize: 10, color: C.muted }}>{weekCount}</span>
                  </div>
                  {selectMode && weekCount > 0 && (
                    <button onClick={() => selectWeek(week)} style={{ ...btn, padding: '1px 6px', fontSize: 9, marginTop: 4 }}>
                      select all in week
                    </button>
                  )}
                </div>

                {/* Days */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '6px 8px' }}>
                  {days.map((day, di) => {
                    const stops = stopsByKey.get(week + '|' + day) || [];
                    const isToday = day === todayISO();
                    const dropHere = dropT && dropT.week === week && dropT.day === day;
                    const dayLines = dropHere && drag && drag.type !== 'day';
                    const dayAllSel = selectMode && stops.length > 0 && stops.every((s) => selected.has(s.id));
                    return (
                      <div
                        key={day}
                        onDragOver={(e) => onDayDragOver(e, week, day, stops.length)}
                        onDrop={(e) => onDayDrop(e, week, day)}
                        style={{
                          marginBottom: 8, borderRadius: 6, padding: 4,
                          background: dropHere ? 'rgba(154,205,50,0.10)' : 'transparent',
                          outline: dropHere ? `1px dashed ${C.accent}` : 'none',
                        }}
                      >
                        {/* Day header */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 2px 4px' }}>
                          {canEdit && !selectMode && (
                            <span
                              draggable
                              onDragStart={(e) => { startDrag({ type: 'day', date: day }); try { e.dataTransfer.effectAllowed = 'move'; } catch (_) {} }}
                              onDragEnd={endDrag}
                              title="Drag to move this whole day"
                              style={{ cursor: 'grab', color: C.dim, fontSize: 11, lineHeight: 1 }}
                            >⠇</span>
                          )}
                          <span style={{ fontSize: 11, fontWeight: 700, color: isToday ? C.sel : C.text }}>
                            {DAY_NAMES[di]}
                          </span>
                          <span style={{ fontSize: 9, color: C.muted, fontFamily: 'ui-monospace, monospace' }}>{fmtMD(day)}</span>
                          {stops.length > 0 && <span style={{ fontSize: 9, color: C.dim }}>- {stops.length}</span>}
                          <div style={{ flex: 1 }} />
                          {selectMode && stops.length > 0 && (
                            <button onClick={() => selectDay(week, day)} style={{ ...btn, padding: '0 5px', fontSize: 9 }}>
                              {dayAllSel ? 'none' : 'all'}
                            </button>
                          )}
                          {canEdit && !selectMode && (
                            <button
                              onClick={() => setEditing(emptyStop(week, day))}
                              title="Add a stop on this day"
                              style={{ ...btn, padding: '0 6px', fontSize: 11, lineHeight: '16px' }}
                            >+</button>
                          )}
                          {canEdit && !selectMode && (
                            <div style={{ position: 'relative' }}>
                              <button
                                onClick={() => setDayMenu((m) => (m === week + '|' + day ? null : week + '|' + day))}
                                title="Day options"
                                style={{ ...btn, padding: '0 5px', fontSize: 13, lineHeight: '16px' }}
                              >⋮</button>
                              {dayMenu === week + '|' + day && (
                                <>
                                  <div onClick={() => setDayMenu(null)} style={{ position: 'fixed', inset: 0, zIndex: 70 }} />
                                  <div style={{ position: 'absolute', top: '100%', right: 0, zIndex: 71, marginTop: 2, background: C.surface2, border: '1px solid ' + C.border, borderRadius: 6, width: 184, boxShadow: '0 8px 20px rgba(0,0,0,0.6)', overflow: 'hidden' }}>
                                    <button onClick={() => { setDayMenu(null); insertDay(day, 'before'); }} style={menuItem}>+ Insert blank day above</button>
                                    <button onClick={() => { setDayMenu(null); insertDay(day, 'after'); }} style={menuItem}>+ Insert blank day below</button>
                                    <button
                                      onClick={() => { setDayMenu(null); removeDay(day); }}
                                      disabled={stops.length > 0}
                                      style={{ ...menuItem, borderBottom: 'none', color: stops.length > 0 ? C.dim : '#ff8a80', cursor: stops.length > 0 ? 'not-allowed' : 'pointer' }}
                                    >{stops.length > 0 ? 'Remove day (move stops first)' : '- Remove this blank day'}</button>
                                  </div>
                                </>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Cards + insertion line */}
                        {stops.length === 0 && (
                          <div style={{ fontSize: 9, color: C.dim, padding: '3px 4px', fontStyle: 'italic' }}>
                            {dropHere ? 'Drop here' : '—'}
                          </div>
                        )}
                        {stops.map((s, i) => (
                          <React.Fragment key={s.id}>
                            {dayLines && dropT.index === i && (
                              <div style={{ height: 2, background: C.accent, borderRadius: 2, margin: '1px 0' }} />
                            )}
                            <StopCard
                              stop={s}
                              canEdit={canEdit}
                              selectMode={selectMode}
                              selected={selected.has(s.id)}
                              dragging={drag && drag.type === 'stop' && drag.id === s.id}
                              onClick={() => {
                                if (!canEdit) return;
                                if (selectMode) toggleSel(s.id);
                                else setEditing(s);
                              }}
                              onDragStart={(e) => {
                                if (!canEdit || selectMode) return;
                                startDrag({ type: 'stop', id: s.id });
                                try { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(s.id)); } catch (_) {}
                              }}
                              onDragEnd={endDrag}
                              onDragOver={(e) => onCardDragOver(e, week, day, i)}
                            />
                          </React.Fragment>
                        ))}
                        {dayLines && dropT.index >= stops.length && (
                          <div style={{ height: 2, background: C.accent, borderRadius: 2, margin: '1px 0' }} />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Add week */}
          {!loading && canEdit && (
            <div style={{ flex: '0 0 130px', padding: 10 }}>
              <button onClick={addWeek} style={{ ...btn, width: '100%', padding: '8px 6px' }}>
                + Add week
              </button>
              <div style={{ fontSize: 9, color: C.dim, marginTop: 6, lineHeight: 1.4 }}>
                Adds an empty week column after the last one.
              </div>
            </div>
          )}
        </div>

        {/* Add-nodes drawer */}
        {drawerOpen && canEdit && (
          <div style={{ flex: '0 0 320px', width: 320, borderLeft: `1px solid ${C.border}`, background: C.surface, display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '10px 12px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: C.bright }}>Add nodes</div>
                <div style={{ fontSize: 10, color: C.muted }}>{unscheduledNodes.length} not yet scheduled</div>
              </div>
              <div style={{ flex: 1 }} />
              <button onClick={() => setDrawerOpen(false)} style={{ ...btn, padding: '2px 8px' }}>{'✕'}</button>
            </div>
            <div style={{ padding: 10 }}>
              <input
                type="text" value={nodeSearch} onChange={(e) => setNodeSearch(e.target.value)}
                placeholder="Search number / owner / label"
                style={{ ...inp, width: '100%' }}
              />
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '0 10px' }}>
              {filteredNodes.length === 0 && (
                <div style={{ fontSize: 11, color: C.dim, padding: 8 }}>
                  {unscheduledNodes.length === 0 ? 'Every node is already on the schedule.' : 'No matches.'}
                </div>
              )}
              {filteredNodes.map((n) => {
                const sel = drawerSel.has(n.node_number);
                return (
                  <div
                    key={n.node_number}
                    draggable
                    onDragStart={(e) => {
                      startDrag({ type: 'node', node: n });
                      try { e.dataTransfer.effectAllowed = 'copy'; } catch (_) {}
                    }}
                    onDragEnd={endDrag}
                    onClick={() => setDrawerSel((p) => {
                      const x = new Set(p);
                      if (x.has(n.node_number)) x.delete(n.node_number); else x.add(n.node_number);
                      return x;
                    })}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 7, padding: '5px 6px', marginBottom: 4,
                      background: sel ? 'rgba(250,204,21,0.12)' : C.surface2,
                      border: `1px solid ${sel ? C.sel : C.border}`, borderRadius: 5, cursor: 'pointer',
                    }}
                  >
                    <span style={{
                      width: 14, height: 14, borderRadius: 3, flexShrink: 0,
                      border: `1px solid ${sel ? C.sel : C.muted}`, background: sel ? C.sel : 'transparent',
                      color: C.bg, fontSize: 11, lineHeight: '13px', textAlign: 'center', fontWeight: 700,
                    }}>{sel ? '✓' : ''}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: C.bright, minWidth: 26, textAlign: 'center' }}>
                      {n.node_number}
                    </span>
                    <span style={{ flex: 1, minWidth: 0, fontSize: 11, color: C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {n.owner_name || n.label || '—'}
                    </span>
                  </div>
                );
              })}
            </div>
            <div style={{ padding: 10, borderTop: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 10, color: C.muted, marginBottom: 6 }}>
                {drawerSel.size} selected - drag a node onto a day, or place them all:
              </div>
              <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                <select value={drawerWeek} onChange={(e) => setDrawerWeek(e.target.value)} style={{ ...inp, flex: 1 }}>
                  {weeks.map((w) => <option key={w} value={w}>Week of {fmtWeekRange(w)}</option>)}
                </select>
                <select value={drawerDay} onChange={(e) => setDrawerDay(Number(e.target.value))} style={{ ...inp, width: 'auto' }}>
                  {DAY_NAMES.map((d, i) => <option key={d} value={i}>{d}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <select value={drawerAction} onChange={(e) => setDrawerAction(e.target.value)} style={{ ...inp, width: 'auto' }}>
                  <option value="deploy">Deploy</option>
                  <option value="retrieve">Retrieve</option>
                </select>
                <button
                  disabled={!drawerSel.size || busy}
                  onClick={addFromDrawer}
                  style={{ ...btn, flex: 1, background: C.accent, color: C.bg, borderColor: C.accent, fontWeight: 700, opacity: drawerSel.size ? 1 : 0.5 }}
                >Add {drawerSel.size || ''} to schedule</button>
              </div>
            </div>
          </div>
        )}
      </div>

      {editing && (
        <StopEditor
          stop={editing}
          weekDates={[]}
          code={code}
          onCancel={() => setEditing(null)}
          onSave={saveEdit}
          onDelete={editing.id ? deleteEdit : null}
        />
      )}
    </div>
  );
}
