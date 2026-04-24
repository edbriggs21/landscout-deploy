import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import * as api from './api.js';
import * as identity from './lib/identity.js';

import CodeEntry from './components/CodeEntry.jsx';
import NamePrompt from './components/NamePrompt.jsx';
import RolePicker from './components/RolePicker.jsx';
import EmptyProject from './components/EmptyProject.jsx';
import MapView from './components/MapView.jsx';
import ParcelDetail from './components/ParcelDetail.jsx';

function readUrlParams() {
  const p = new URLSearchParams(window.location.search);
  return { code: p.get('code') || '', role: p.get('role') || '' };
}

function setUrlParams({ code, role }) {
  const url = new URL(window.location.href);
  if (code) url.searchParams.set('code', code); else url.searchParams.delete('code');
  if (role) url.searchParams.set('role', role); else url.searchParams.delete('role');
  window.history.replaceState({}, '', url.toString());
}

export default function App() {
  const urlParams = useMemo(() => readUrlParams(), []);
  const [code, setCode] = useState(urlParams.code);
  const [role, setRole] = useState(urlParams.role || identity.getRole());
  const [name, setName] = useState(identity.getName());

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);        // { project, owners, access_points, photos, role }
  const [selectedOwnerId, setSelectedOwnerId] = useState(null);

  // For "tap on map to drop a pin" mode
  const [dropPinMode, setDropPinMode] = useState(false);

  const doValidate = useCallback(async (c) => {
    setLoading(true); setError('');
    try {
      const res = await api.validateCode(c);
      setData(res);
      // If server returned a role and URL didn't have one, persist it
      if (!role && res.role) {
        setRole(res.role);
        identity.setRole(res.role);
        setUrlParams({ code: c, role: res.role });
      }
    } catch (e) {
      setError(e.message || 'Invalid code');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [role]);

  // Initial validation if we already have a code
  useEffect(() => {
    if (code) doValidate(code);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCodeSubmit = (c) => {
    setCode(c);
    setUrlParams({ code: c, role });
    doValidate(c);
  };

  const handleNameSubmit = (n) => {
    identity.setName(n);
    setName(n);
  };

  const handleRoleSelect = (r) => {
    identity.setRole(r);
    setRole(r);
    setUrlParams({ code, role: r });
  };

  // Refresh one owner's data after a write
  const refreshAfterWrite = useCallback(async () => {
    if (!code) return;
    try {
      const res = await api.validateCode(code);
      setData(res);
    } catch (e) {
      console.warn('Refresh failed', e);
    }
  }, [code]);

  const selectedOwner = useMemo(() => {
    if (!data || !selectedOwnerId) return null;
    return data.owners.find(o => o.id === selectedOwnerId) || null;
  }, [data, selectedOwnerId]);

  const ownerAccessPoints = useMemo(() => {
    if (!data || !selectedOwnerId) return [];
    return data.access_points.filter(ap => ap.owner_id === selectedOwnerId);
  }, [data, selectedOwnerId]);

  const ownerPhotos = useMemo(() => {
    if (!data || !selectedOwnerId) return [];
    return data.photos.filter(p => p.owner_id === selectedOwnerId);
  }, [data, selectedOwnerId]);

  // --- Render flow ---

  // No code yet, or code is invalid
  if (!code || error) {
    return <CodeEntry defaultCode={code} error={error} loading={loading} onSubmit={handleCodeSubmit} />;
  }

  // Code entered but still loading
  if (loading && !data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-sm text-slate-300">Validating code…</div>
        </div>
      </div>
    );
  }

  // Data loaded but no name yet
  if (data && !name) {
    return <NamePrompt onSubmit={handleNameSubmit} />;
  }

  // Data + name but no role
  if (data && name && !role) {
    return <RolePicker onSelect={handleRoleSelect} projectName={data.project?.name} />;
  }

  // Empty project
  if (data && data.owners.length === 0) {
    return <EmptyProject projectName={data.project?.name} />;
  }

  if (!data) return null;

  return (
    <div className="h-full w-full relative">
      <MapView
        project={data.project}
        owners={data.owners}
        accessPoints={data.access_points}
        selectedOwnerId={selectedOwnerId}
        dropPinMode={dropPinMode}
        onSelectOwner={setSelectedOwnerId}
        onMapTap={async ({ lng, lat }) => {
          if (!dropPinMode || !selectedOwnerId) return;
          try {
            await api.addAccessPoint({
              code, owner_id: selectedOwnerId, lat, lng,
              created_by: name,
            });
            setDropPinMode(false);
            refreshAfterWrite();
          } catch (e) {
            alert(e.message);
          }
        }}
      />

      {/* Top status bar */}
      <div className="absolute top-0 left-0 right-0 p-3 safe-top flex items-center justify-between bg-gradient-to-b from-black/50 to-transparent pointer-events-none">
        <div className="pointer-events-auto bg-brandSurface/80 rounded-lg px-3 py-1.5 text-xs">
          <span className="text-slate-400">Project:</span> <span className="text-white font-medium">{data.project?.name}</span>
        </div>
        <div className="pointer-events-auto bg-brandSurface/80 rounded-lg px-3 py-1.5 text-xs flex items-center gap-2">
          <span className={`inline-block w-2 h-2 rounded-full ${role === 'crew' ? 'bg-landGreen' : 'bg-dataBlue'}`}></span>
          <span className="text-white capitalize">{role}</span>
          <span className="text-slate-400">·</span>
          <span className="text-slate-300">{name}</span>
        </div>
      </div>

      {/* Parcel detail sheet */}
      {selectedOwner && (
        <ParcelDetail
          owner={selectedOwner}
          role={role}
          code={code}
          name={name}
          project={data.project}
          accessPoints={ownerAccessPoints}
          photos={ownerPhotos}
          onClose={() => { setSelectedOwnerId(null); setDropPinMode(false); }}
          onChanged={refreshAfterWrite}
          onRequestDropPin={() => setDropPinMode(true)}
        />
      )}

      {/* Drop-pin hint banner */}
      {dropPinMode && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 bg-landGreen text-deepBlue text-sm font-medium px-4 py-2 rounded-full shadow-lg">
          Tap the map to drop a pin
          <button
            className="ml-3 text-deepBlue/70 underline"
            onClick={() => setDropPinMode(false)}
          >cancel</button>
        </div>
      )}
    </div>
  );
}
