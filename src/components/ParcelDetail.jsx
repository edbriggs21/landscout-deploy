import React, { useState } from 'react';
import OpsInfoView from './OpsInfoView.jsx';
import OpsInfoEdit from './OpsInfoEdit.jsx';
import ScoutTools from './ScoutTools.jsx';
import CrewTools from './CrewTools.jsx';
import PhotoGallery from './PhotoGallery.jsx';

export default function ParcelDetail({
  owner, role, code, name, project,
  accessPoints, photos,
  onClose, onChanged, onRequestDropPin,
}) {
  const [tab, setTab] = useState(role === 'crew' ? 'status' : 'readiness');

  const scoutTabs = [
    { id: 'ops', label: 'Ops Info' },
    { id: 'readiness', label: 'Readiness' },
    { id: 'access', label: 'Access Points' },
    { id: 'photos', label: 'Photos' },
    { id: 'edit', label: 'Edit Ops' },
  ];
  const crewTabs = [
    { id: 'ops', label: 'Ops Info' },
    { id: 'intel', label: 'Scout Intel' },
    { id: 'status', label: 'Status' },
  ];
  const tabs = role === 'crew' ? crewTabs : scoutTabs;

  return (
    <div className="absolute inset-x-0 bottom-0 sheet-in">
      <div className="bg-brandSurface border-t border-brandBorder rounded-t-2xl shadow-2xl max-h-[80vh] flex flex-col safe-bottom">
        {/* Header */}
        <div className="px-4 pt-3 pb-2 flex items-center justify-between">
          <div className="min-w-0">
            <div className="text-white font-semibold truncate">{owner.owner_name || owner.name || 'Unnamed parcel'}</div>
            <div className="text-xs text-slate-400 truncate">
              {owner.geocoded_address || owner.stage_label || '—'}
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white px-2 py-1 text-sm">Close ✕</button>
        </div>

        {/* Tabs */}
        <div className="px-2 border-b border-brandBorder flex overflow-x-auto no-scrollbar">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={
                'px-3 py-2 text-sm whitespace-nowrap border-b-2 ' +
                (tab === t.id
                  ? 'border-landGreen text-white'
                  : 'border-transparent text-slate-400')
              }
            >{t.label}</button>
          ))}
        </div>

        {/* Body */}
        <div className="p-4 overflow-y-auto">
          {tab === 'ops' && <OpsInfoView owner={owner} project={project} />}

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
        </div>
      </div>
    </div>
  );
}
