import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import * as api from './api.js';
import * as identity from './lib/identity.js';

import CodeEntry from './components/CodeEntry.jsx';
import NamePrompt from './components/NamePrompt.jsx';
import RolePicker from './components/RolePicker.jsx';
import EmptyProject from './components/EmptyProject.jsx';
import MapView from './components/MapView.jsx';
import ParcelDetail from './components/ParcelDetail.jsx';
import PlanSidebar from './components/PlanSidebar.jsx';

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
  // Toggle for the parcel fill/outline layers (persisted)
  const [planOpen, setPlanOpen] = useState(true);
  const [selectedNodeNumber, setSelectedNodeNumber] = useState(null);
  const mapApiRef = useRef({ flyTo: () => {} }); // populated by MapView via onMapReady
  const [parcelsVisible, setParcelsVisibleState] = useState(identity.getParcelsVisible());
  const setParcelsVisible = (v) => { identity.setParcelsVisible(v); setParcelsVisibleState(v); };
  const [ownerNumbersVisible, setOwnerNumbersVisibleState] = useState(identity.getOwnerNumbersVisible());
  const setOwnerNumbersVisible = (v) => { identity.setOwnerNumbersVisible(v); setOwnerNumbersVisibleState(v); };

  // ---- Location sharing & live crew positions ------------------------------
  const sessionIdRef = useRef(identity.getSessionId());
  const [shareLocation, setShareLocationState] = useState(identity.getShareLocation());
  const setShareLocation = (v) => { identity.setShareLocation(v); setShareLocationState(v); };
  const [myLocationError, setMyLocationError] = useState('');
  const [crewLocations, setCrewLocations] = useState([]);
  const lastPostedRef = useRef(0);

  // Watch GPS while sharing is on, POST every ~10s (and only on meaningful move)
  useEffect(() => {
    if (!shareLocation || !code || !name) return;
    if (!navigator.geolocation) {
      setMyLocationError('Geolocation not available on this device');
      return;
    }
    let cancelled = false;
    let lastPos = null;
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        if (cancelled) return;
        const now = Date.now();
        const sinceLast = now - lastPostedRef.current;
        const movedFar = !lastPos || (
          Math.abs(pos.coords.latitude - lastPos.latitude) > 0.00003 ||  // ~3 m
          Math.abs(pos.coords.longitude - lastPos.longitude) > 0.00003
        );
        if (sinceLast < 10000 && !movedFar) return; // throttle: at most every 10s OR on motion
        lastPostedRef.current = now;
        lastPos = pos.coords;
        api.updateLocation({
          code,
          session_id: sessionIdRef.current,
          name,
          role,
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy_m: pos.coords.accuracy,
          heading_deg: pos.coords.heading,
          speed_mps: pos.coords.speed,
        }).catch(e => console.warn('location update failed', e));
        setMyLocationError('');
      },
      (err) => { setMyLocationError(err.message || 'GPS error'); },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 }
    );
    return () => { cancelled = true; navigator.geolocation.clearWatch(watchId); };
  }, [shareLocation, code, name, role]);

  // Poll the active crew list every 10s
  useEffect(() => {
    if (!code) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const res = await api.listLocations({ code, session_id: sessionIdRef.current });
        if (!cancelled) setCrewLocations(res.locations || []);
      } catch (e) { /* ignore polling failures, retry next tick */ }
    };
    tick();
    const id = setInterval(tick, 10000);
    return () => { cancelled = true; clearInterval(id); };
  }, [code]);
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

  // Refresh owner data + currently-loaded overlay layers after a write.
  // Re-fetching the layer is what carries the freshly-updated node_status
  // (deployed/retrieved) onto the map's circle paint expression.
  const refreshAfterWrite = useCallback(async () => {
    if (!code) return;
    try {
      const res = await api.validateCode(code);
      setData(res);
      // Re-fetch every overlay layer we've already loaded, so node_status
      // colors and per-node labels stay in sync with the latest writes.
      const layerIdsToRefresh = Object.keys(loadedLayers);
      if (layerIdsToRefresh.length > 0) {
        await Promise.all(layerIdsToRefresh.map(async (id) => {
          try {
            const r = await api.fetchLayer({ code, layer_id: id });
            setLoadedLayers(prev => ({ ...prev, [id]: r.geojson }));
          } catch (e) {
            console.warn('layer re-fetch failed', id, e);
          }
        }));
      }
    } catch (e) {
      console.warn('Refresh failed', e);
    }
  }, [code, loadedLayers]);

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
        parcelsVisible={parcelsVisible}
        onToggleParcels={() => setParcelsVisible(!parcelsVisible)}
        ownerNumbersVisible={ownerNumbersVisible}
        onToggleOwnerNumbers={() => setOwnerNumbersVisible(!ownerNumbersVisible)}
        crewLocations={crewLocations}
        rightInset={(planOpen ? 380 : 0) + (selectedOwner ? 380 : 0)}
        selectedNodeNumber={selectedNodeNumber}
        onSelectNode={(n, ownerId) => { setSelectedNodeNumber(n); if (ownerId) selectOwner(ownerId, { initialTab: 'ops' }); }}
        onMapReady={(api) => { mapApiRef.current = api; }}
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
      <div className="absolute top-0 left-0 p-3 safe-top flex items-center justify-between gap-2 bg-gradient-to-b from-black/50 to-transparent pointer-events-none" style={{ right: ((planOpen ? 380 : 0) + (selectedOwner ? 380 : 0)) + 'px', transition: 'right 200ms ease' }}>
        <div className="pointer-events-auto bg-brandSurface/80 rounded-lg px-3 py-1.5 text-xs">
          <span className="text-slate-400">Project:</span> <span className="text-white font-medium">{data.project?.name}</span>
        </div>
        <button
          type="button"
          onClick={() => setPlanOpen(true)}
          title="Open the weekly deployment plan"
          className="pointer-events-auto bg-brandSurface/80 rounded-lg px-3 py-1.5 text-xs text-slate-200 hover:bg-brandSurface flex items-center gap-1"
        >
          📋 Plan
        </button>
        <button
          type="button"
          onClick={() => setShareLocation(!shareLocation)}
          title={shareLocation ? (myLocationError ? ('Location sharing on — ' + myLocationError) : 'Location sharing on — tap to stop') : 'Share my location with the team'}
          className={`pointer-events-auto rounded-lg px-3 py-1.5 text-xs flex items-center gap-2 ${shareLocation ? 'bg-landGreen/90 text-deepBlue font-semibold' : 'bg-brandSurface/80 text-slate-300'}`}
        >
          {shareLocation
            ? <><span className="inline-block w-2 h-2 rounded-full bg-deepBlue animate-pulse"></span><span>Sharing</span></>
            : <><span>📡</span><span>Share location</span></>}
        </button>
        {data.node_stats && (
          <div className="pointer-events-auto bg-brandSurface/80 rounded-lg px-3 py-1.5 text-xs flex items-center gap-3 whitespace-nowrap">
            <span className="text-slate-400 uppercase tracking-wider">Nodes</span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-2 h-2 rounded-full bg-slate-400"></span>
              <span className="text-white font-medium">{data.node_stats.total}</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-2 h-2 rounded-full bg-yellow-400"></span>
              <span className="text-yellow-300 font-medium">{data.node_stats.deployed}</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500"></span>
              <span className="text-emerald-400 font-medium">{data.node_stats.retrieved}</span>
            </span>
          </div>
        )}
        <div className="pointer-events-auto bg-brandSurface/80 rounded-lg px-3 py-1.5 text-xs flex items-center gap-2">
          <span className={`inline-block w-2 h-2 rounded-full ${role === 'crew' ? 'bg-landGreen' : 'bg-dataBlue'}`}></span>
          <span className="text-white capitalize">{role}</span>
          <span className="text-slate-400">·</span>
          <span className="text-slate-300">{name}</span>
        </div>
      </div>

      {/* Owner sidebar (replaces former bottom sheet + OpsInfoSidebar). */}
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
          offsetRightPx={planOpen ? 380 : 0}
        />
      )}

      <PlanSidebar
        open={planOpen}
        onToggle={() => setPlanOpen(o => !o)}
        code={code}
        role={role}
        selectedNodeNumber={selectedNodeNumber}
        onSelectNode={(n) => setSelectedNodeNumber(n)}
        onFlyTo={(lat, lng) => mapApiRef.current.flyTo(lat, lng)}
        onOpenOpsInfo={(ownerId) => selectOwner(ownerId, { initialTab: 'ops' })}
      />
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
