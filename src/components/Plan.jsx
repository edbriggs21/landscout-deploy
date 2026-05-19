import React, { useEffect, useMemo, useState } from 'react';
import * as api from '../api.js';

// Hand-curated weekly plan view. Day pills along the top, stop cards below.
// Each card shows: action chip, node #, time, owner, phone (tap-to-call),
// gate code, contact, notes, Get Directions. Done stops show with strikethrough.
export default function Plan({ code, owners, role, onSelectOwner }) {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [data, setData] = useState(null);
  const [selectedDay, setSelectedDay] = useState(null);
  const [selectedCrew, setSelectedCrew] = useState(null);

  const refresh = async () => {
    setErr('');
    try {
      const res = await api.listScheduleStops({ code });
      setData(res);
      // Default day = today if it's in the week, else first day
      if (!selectedDay) {
        const today = new Date().toISOString().slice(0, 10);
        const inWeek = (res.days || []).find(d => d.day_date === today);
        setSelectedDay(inWeek ? today : (res.days?.[0]?.day_date || null));
      }
      // Default crew = first crew if there are crews
      if (!selectedCrew && res.crews && res.crews.length > 0) {
        setSelectedCrew(res.crews[0]);
      }
    } catch (e) {
      setErr(e.message || 'Failed to load plan');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); /* eslint-disable-next-line */ }, [code]);

  if (loading) return <div className="text-sm text-slate-400">Loading plan…</div>;
  if (err) return <div className="text-sm text-red-400">{err}</div>;
  if (!data || !data.stops || data.stops.length === 0) {
    return <div className="text-sm text-slate-500 bg-brandBg rounded p-3">
      No weekly plan has been published for this project yet.
    </div>;
  }

  const { stops, days, crews, week_start_date } = data;

  // Filter stops by crew first, then day
  const filteredAll = selectedCrew ? stops.filter(s => s.crew_label === selectedCrew) : stops;
  const todayStops = filteredAll
    .filter(s => s.day_date === selectedDay)
    .sort((a,b) => a.stop_order - b.stop_order);

  // Day pill counts after crew filter
  const dayCounts = new Map();
  for (const s of filteredAll) {
    const d = dayCounts.get(s.day_date) || { total: 0, done: 0 };
    d.total += 1;
    if (s.done_at) d.done += 1;
    dayCounts.set(s.day_date, d);
  }

  const fmtDateShort = (s) => {
    if (!s) return '';
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric' });
  };
  const fmtTime12 = (t) => {
    if (!t) return '';
    const [h, m] = t.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = ((h + 11) % 12) + 1;
    return `${h12}:${m.toString().padStart(2, '0')} ${ampm}`;
  };
  const labelColors = {
    'Task':    'bg-slate-700/40 text-slate-300',
    'Access':  'bg-blue-400/15 text-blue-300',
    'Meet':    'bg-purple-400/15 text-purple-300',
    'Address': 'bg-emerald-400/15 text-emerald-300',
    'Caution': 'bg-red-400/15 text-red-300',
  };
  const ownerByName = useMemo(() => {
    const m = new Map();
    for (const o of (owners || [])) m.set((o.owner_name || o.name || '').toLowerCase(), o.id);
    return m;
  }, [owners]);

  return (
    <div>
      {/* Week header */}
      <div className="mb-3">
        <div className="text-xs uppercase tracking-wider text-slate-500">Week of</div>
        <div className="text-white font-medium">{fmtDateShort(week_start_date)} → {fmtDateShort(days[days.length-1]?.day_date)}</div>
      </div>

      {/* Crew toggles (only shown if there are crews) */}
      {crews && crews.length > 0 && (
        <div className="flex gap-2 mb-2 overflow-x-auto no-scrollbar">
          {crews.map(c => (
            <button
              key={c}
              onClick={() => setSelectedCrew(c)}
              className={`text-xs px-3 py-1.5 rounded-lg whitespace-nowrap border ${selectedCrew === c ? 'border-landGreen bg-landGreen/15 text-landGreen font-semibold' : 'border-brandBorder bg-brandBg text-slate-300'}`}
            >{c}</button>
          ))}
        </div>
      )}

      {/* Day pills */}
      <div className="flex gap-1 mb-3 overflow-x-auto no-scrollbar">
        {days.map(d => {
          const c = dayCounts.get(d.day_date) || { total: 0, done: 0 };
          const allDone = c.total > 0 && c.done === c.total;
          const active = d.day_date === selectedDay;
          return (
            <button
              key={d.day_date}
              onClick={() => setSelectedDay(d.day_date)}
              className={`flex-1 min-w-[64px] text-[11px] px-2 py-1.5 rounded-lg border ${active ? 'border-landGreen bg-landGreen/15 text-white font-semibold' : 'border-brandBorder bg-brandBg text-slate-300'}`}
            >
              <div className="font-medium">{fmtDateShort(d.day_date)}</div>
              <div className="text-[10px] text-slate-400">{c.done}/{c.total}{allDone && ' ✓'}</div>
            </button>
          );
        })}
      </div>

      {/* Stops for selected day */}
      {todayStops.length === 0 ? (
        <div className="text-sm text-slate-500 bg-brandBg rounded p-3">
          No stops scheduled for this day.
        </div>
      ) : (
        <ul className="space-y-2">
          {todayStops.map(s => {
            const done = !!s.done_at;
            const ownerId = s.owner_id || ownerByName.get((s.owner_name || '').toLowerCase());
            const dirUrl = (s.lat != null && s.lng != null)
              ? `https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lng}&travelmode=driving`
              : null;
            const phoneClean = s.contact_phone ? s.contact_phone.replace(/[^\d]/g, '') : '';
            const noteClass = labelColors[s.task_label] || 'bg-slate-700/40 text-slate-300';
            return (
              <li key={s.id} className={`bg-brandBg border border-brandBorder rounded-lg overflow-hidden ${done ? 'opacity-60' : ''}`}>
                <div className="flex items-stretch">
                  {/* Big node number badge */}
                  <button
                    onClick={() => ownerId && onSelectOwner && onSelectOwner(ownerId, { initialTab: 'ops' })}
                    className={`w-14 flex-shrink-0 flex flex-col items-center justify-center gap-0 text-deepBlue font-bold border-r border-brandBorder ${s.action === 'deploy' ? 'bg-landGreen' : 'bg-purple-400'}`}
                    title="Open owner details"
                  >
                    <div className={`text-xl leading-none ${done ? 'line-through' : ''}`}>{s.node_number}</div>
                    <div className="text-[9px] uppercase tracking-wider opacity-80">Node</div>
                  </button>
                  {/* Body */}
                  <div className="flex-1 min-w-0 p-2">
                    <div className="flex items-center gap-2 text-[11px] mb-1">
                      <span className={`px-1.5 py-0.5 rounded ${s.action === 'deploy' ? 'bg-landGreen/15 text-landGreen' : 'bg-purple-400/15 text-purple-300'} font-semibold uppercase tracking-wider`}>{s.action}</span>
                      {s.scheduled_time && <span className="text-slate-400 font-mono">{fmtTime12(s.scheduled_time)}</span>}
                      {done && <span className="ml-auto text-[10px] text-emerald-400">Done {new Date(s.done_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>}
                    </div>
                    <div className={`text-white text-sm font-medium truncate ${done ? 'line-through' : ''}`}>
                      {s.owner_name || '—'}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap text-[11px] text-slate-400 mt-0.5">
                      {s.contact_phone && (
                        <a href={`tel:${phoneClean}`} className="text-blue-300 hover:underline">
                          📞 {s.contact_name ? `${s.contact_name} — ` : ''}{s.contact_phone}
                        </a>
                      )}
                      {s.gate_code && <span className="bg-amber-400/15 text-amber-300 px-1.5 py-0.5 rounded">Gate {s.gate_code}</span>}
                    </div>
                    {s.task_notes && (
                      <div className={`mt-1.5 text-[11px] px-2 py-1 rounded ${noteClass}`}>
                        <strong className="uppercase text-[10px] tracking-wider mr-1">{s.task_label || 'Note'}</strong>
                        <span className="text-slate-200">{s.task_notes}</span>
                      </div>
                    )}
                    {dirUrl && (
                      <a href={dirUrl} target="_blank" rel="noopener noreferrer"
                         className="inline-flex items-center gap-1 mt-1.5 text-[11px] bg-brandSurface border border-brandBorder rounded px-2 py-1 text-slate-300 hover:border-landGreen">
                        🚗 Directions
                      </a>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
