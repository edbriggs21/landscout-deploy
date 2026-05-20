import React, { useState, useEffect } from 'react';
import OpsInfoView from './OpsInfoView.jsx';
import OpsInfoEdit from './OpsInfoEdit.jsx';
import ScoutTools from './ScoutTools.jsx';
import CrewTools from './CrewTools.jsx';
import PhotoGallery from './PhotoGallery.jsx';
import Schedule from './Schedule.jsx';

export default function ParcelDetail({
  owner, role, code, name, project,
  accessPoints, photos,
  owners,
  onClose, onChanged, onRequestDropPin,
  onSelectOwner,
  onRequestPickStart,
  initialTab,
  offsetRightPx = 0,
}) {
  const [tab, setTab] = useState(initialTab || (role === 'crew' ? 'status' : 'readiness'));

  // When a Schedule row tap requests a specific tab (e.g. 'ops'), or the user
  // hops to a different owner via search, jump there.
  useEffect(() => {
    if (initialTab) setTab(initialTab);
  }, [owner.id, initialTab]);

  const scoutTabs = [
    { id: 'ops', label: 'Ops Info' },
    { id: 'readiness', label: 'Readiness' },
    { id: 'access', label: 'Access Points' },
    { id: 'photos', label: 'Photos' },
    { id: 'edit', label: 'Edit Ops' },
    { id: 'schedule', label: 'Schedule' },
  ];
  const crewTabs = [
    { id: 'ops', label: 'Ops Info' },
    { id: 'intel', label: 'Scout Intel' },
    { id: 'status', label: 'Status' },
    { id: 'schedule', label: 'Schedule' },
  ];
  const tabs = role === 'crew' ? crewTabs : scoutTabs;

  return (
    <div
      className="fixed top-0 bottom-0 z-30 flex flex-col"
      style={{
        right: offsetRightPx + 'px',
        width: '380px',
        background: '#0d1117',
        color: '#cdd9e5',
        borderLeft: '1px solid #2a3444',
        fontFamily: '-apple-system, BlinkMacSystemFont, Inter, Segoe UI, sans-serif',
      }}
    >
      <div className="flex flex-col h-full">
        {/* Header (matches Plan sidebar style) */}
        <div className="flex-shrink-0" style={{ padding: '14px 16px', borderBottom: '1px solid #2a3444', background: '#0d1117' }}>
          <div className="flex items-center justify-between mb-1">
            <div style={{ fontSize: 11, letterSpacing: '0.1em', color: '#8b96a3', textTransform: 'uppercase' }}>Owner</div>
            <button onClick={onClose} style={{ background: 'transparent', border: '1px solid #2a3444', color: '#cdd9e5', padding: '3px 9px', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>✕</button>
          </div>
          <div style={{ fontSize: 17, fontWeight: 600, color: '#f0f6fc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {owner.owner_name || owner.name || 'Unnamed parcel'}
          </div>
          <div style={{ fontSize: 11, color: '#8b96a3', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {owner.geocoded_address || owner.stage_label || '—'}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex-shrink-0 flex overflow-x-auto no-scrollbar" style={{ padding: '0 8px', borderBottom: '1px solid #2a3444', background: '#0d1117' }}>
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                background: 'transparent',
                padding: '8px 10px',
                fontSize: 12,
                whiteSpace: 'nowrap',
                color: tab === t.id ? '#f0f6fc' : '#8b96a3',
                borderTop: 'none', borderLeft: 'none', borderRight: 'none',
                borderBottom: tab === t.id ? '2px solid #9ACD32' : '2px solid transparent',
                cursor: 'pointer',
                fontWeight: tab === t.id ? 600 : 400,
              }}
            >{t.label}</button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-y-auto" style={{ padding: 14, background: '#0d1117' }}>
          {tab === 'ops' && <OpsInfoView owner={owner} project={project} code={code} name={name} role={role} onChanged={onChanged} />}

          {role === 'scout' && tab === 'readiness' && (
            <ScoutTools.Readiness owner={owner} code={code} name={name} onChanged={onChanged} />
          )}
          {role === 'scout' && tab === 'access' && (
            <ScoutTools.AccessPoints owner={owner} code={code} name={name}
              points={accessPoints} onChanged={onChanged} onRequestDropPin={onRequestDropPin}
            />
          )}
          {role === 'scout' && tab === 'photos' && (
            <PhotoGallery owner={owner} code={code} name={name} role="scout"
              photos={photos} onChanged={onChanged} />
          )}
          {role === 'scout' && tab === 'edit' && (
            <OpsInfoEdit owner={owner} project={project} code={code} name={name} onChanged={onChanged} />
          )}

          {role === 'crew' && tab === 'intel' && (
            <div className="space-y-6">
              <ScoutTools.ReadinessReadOnly owner={owner} />
              <div>
                <div className="text-white font-medium mb-2">Access points ({accessPoints.length})</div>
                {accessPoints.length === 0 && <div className="text-sm text-slate-400">None yet.</div>}
                {accessPoints.map(p => (
                  <div key={p.id} className="text-sm text-slate-300 bg-brandBg rounded-md p-2 mb-1">
                    {p.label || 'Pin'} — {p.lat.toFixed(5)}, {p.lng.toFixed(5)}
                  </div>
                ))}
              </div>
              <PhotoGallery owner={owner} code={code} name={name} role="crew"
                photos={photos} onChanged={onChanged} readOnlyUploads={true} />
            </div>
          )}
          {role === 'crew' && tab === 'status' && (
            <CrewTools owner={owner} code={code} name={name} onChanged={onChanged} />
          )}
          {tab === 'schedule' && (
            <Schedule
              owners={owners}
              role={role}
              code={code}
              name={name}
              project={project}
              onChanged={onChanged}
              onSelectOwner={onSelectOwner}
              currentOwnerId={owner.id}
              onRequestPickStart={onRequestPickStart}
            />
          )}
        </div>
      </div>
    </div>
  );
}
