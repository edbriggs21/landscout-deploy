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
  const [data, setData] = useState(null);        // { project, owners, access_points, photos, layers, role }
  const [selectedOwnerId, setSelectedOwnerId] = useState(null);
  const [selectedOwnerInitialTab, setSelectedOwnerInitialTab] = useState(null);
  const [loadedLayers, setLoadedLayers] = useState({}); // { [layer_id]: geojson }
  const [visibleLayerIds, setVisibleLayerIds] = useState(null); // Set | null (init from data)

  // For "tap on map to drop a pin" mode
  const [dropPinMode, setDropPinMode] = useState(false);
  // For "tap on map to set schedule start point" mode
  const [pickStartMode, setPickStartMode] = useState(false);

  const doValidate = useCallback(async (c) => {
    setLoading(true); setError('');
    try {
      const res = await api.validateCode(c);
      setData(res);
      // Init visible layer set from server-side metadata if not already set
      setVisibleLayerIds(prev => {
        if (prev) return prev;
        return new Set((res.layers || []).filter(l => l.visible).map(l => l.id));
      });
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

  // Wrapper used by MapView and Schedule rows to open an owner's detail sheet,
  // optionally jumping straight to a specific tab (e.g. 'ops' from Schedule taps).
  const selectOwner = useCallback((id, opts) => {
    setSelectedOwnerId(id);
    setSelectedOwnerInitialTab((opts && opts.initialTab) || null);
  }, []);

  // Toggle a layer's visibility, fetching its geojson the first time
  const toggleLayer = useCallback(async (layer_id) => {
    setVisibleLayerIds(prev => {
      const next = new Set(prev || []);
      if (next.has(layer_id)) next.delete(layer_id); else next.add(layer_id);
      return next;
    });
    if (!loadedLayers[layer_id]) {
      try {
        const res = await api.fetchLayer({ code, layer_id });
        setLoadedLayers(prev => ({ ...prev, [layer_id]: res.geojson }));
      } catch (e) {
        alert('Failed to load layer: ' + e.message);
      }
    }
  }, [code, loadedLayers]);

  // On first load, lazily fetch all initially-visible layers
  useEffect(() => {
    if (!data || !visibleLayerIds) return;
    const toFetch = (data.layers || []).filter(l => visibleLayerIds.has(l.id) && !loadedLayers[l.id]);
    if (toFetch.length === 0) return;
    (async () => {
      for (const l of toFetch) {
        try {
          const res = await api.fetchLayer({ code, layer_id: l.id });
          setLoadedLayers(prev => ({ ...prev, [l.id]: res.geojson }));
        } catch (e) {
          console.warn('layer fetch failed', l.name, e);
        }
      }
    })();
  }, [data, visibleLayerIds, code]); // eslint-disable-line

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
        layers={data.layers || []}
        loadedLayers={loadedLayers}
        visibleLayerIds={visibleLayerIds || new Set()}
        onToggleLayer={toggleLayer}
        selectedOwnerId={selectedOwnerId}
        dropPinMode={dropPinMode || pickStartMode}
        onSelectOwner={(id) => selectOwner(id)}
        onMapTap={async ({ lng, lat }) => {
          if (pickStartMode) {
            try {
              await api.setStartPoint({
                code, lat, lng,
                label: `Picked: ${lat.toFixed(4)}, ${lng.toFixed(4)}`,
                updated_by: name,
              });
              setPickStartMode(false);
              refreshAfterWrite();
            } catch (e) {
              alert(e.message);
              setPickStartMode(false);
            }
            return;
          }
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
          owners={data.owners}
          onClose={() => { setSelectedOwnerId(null); setSelectedOwnerInitialTab(null); setDropPinMode(false); }}
          onChanged={refreshAfterWrite}
          onRequestDropPin={() => setDropPinMode(true)}
          onSelectOwner={(id, opts) => selectOwner(id, opts)}
          initialTab={selectedOwnerInitialTab}
          onRequestPickStart={() => { setSelectedOwnerId(null); setPickStartMode(true); }}
        />
      )}

      {/* Drop-pin hint banner */}
      {(dropPinMode || pickStartMode) && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 bg-landGreen text-deepBlue text-sm font-medium px-4 py-2 rounded-full shadow-lg">
          {pickStartMode ? 'Tap the map to set the route start point' : 'Tap the map to drop a pin'}
          <button
            className="ml-3 text-deepBlue/70 underline"
            onClick={() => { setDropPinMode(false); setPickStartMode(false); }}
          >cancel</button>
        </div>
      )}
    </div>
  );
}
