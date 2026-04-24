import React, { useEffect, useRef, useState } from 'react';
import {
  createMap, loadPinImage, maplibregl,
  allParcelsGeoJson, accessPointsGeoJson, fitToFeatures, colorForOwner,
  setBasemap,
} from '../lib/maplibre-setup.js';
import { getBasemap, setBasemapPref } from '../lib/identity.js';

export default function MapView({
  project, owners, accessPoints,
  selectedOwnerId, dropPinMode,
  onSelectOwner, onMapTap,
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const readyRef = useRef(false);
  const didFitRef = useRef(false);
  const [basemap, setBasemapState] = useState(getBasemap());

  // Init map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = createMap(containerRef.current);
    mapRef.current = map;

    map.on('load', async () => {
      await loadPinImage(map);

      map.addSource('parcels', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.addLayer({
        id: 'parcels-fill',
        type: 'fill',
        source: 'parcels',
        paint: {
          'fill-color': ['get', 'color'],
          'fill-opacity': 0.35,
        },
      });
      map.addLayer({
        id: 'parcels-outline',
        type: 'line',
        source: 'parcels',
        paint: {
          'line-color': ['get', 'color'],
          'line-width': 2,
        },
      });

      map.addSource('access-points', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.addLayer({
        id: 'access-points-symbol',
        type: 'symbol',
        source: 'access-points',
        layout: {
          'icon-image': 'deploy-pin',
          'icon-size': 0.8,
          'icon-allow-overlap': true,
          'icon-anchor': 'bottom',
        },
      });

      map.on('click', 'parcels-fill', (e) => {
        const f = e.features && e.features[0];
        if (f && f.properties && f.properties.owner_id) {
          onSelectOwner(f.properties.owner_id);
        }
      });
      map.on('mouseenter', 'parcels-fill', () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', 'parcels-fill', () => { map.getCanvas().style.cursor = ''; });

      readyRef.current = true;

      // Apply persisted basemap choice
      setBasemap(map, basemap);

      // Initial data + fit
      const gj = allParcelsGeoJson(owners);
      map.getSource('parcels').setData(gj);
      map.getSource('access-points').setData(accessPointsGeoJson(accessPoints));
      if (gj.features.length) {
        fitToFeatures(map, gj);
        didFitRef.current = true;
      }
    });

    return () => {
      try { map.remove(); } catch {}
      mapRef.current = null;
    };
  }, []); // eslint-disable-line

  // Refresh data layers when owners/accessPoints change
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    const gj = allParcelsGeoJson(owners);
    map.getSource('parcels').setData(gj);
    map.getSource('access-points').setData(accessPointsGeoJson(accessPoints));
    // If the map loaded before owners arrived, do the initial fit here once
    if (!didFitRef.current && gj.features.length) {
      fitToFeatures(map, gj);
      didFitRef.current = true;
    }
  }, [owners, accessPoints]);

  // Handle drop-pin tap mode — bind a one-shot click listener
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    if (!dropPinMode) return;
    const handler = (e) => {
      onMapTap && onMapTap({ lng: e.lngLat.lng, lat: e.lngLat.lat });
    };
    map.once('click', handler);
    map.getCanvas().style.cursor = 'crosshair';
    return () => {
      map.off('click', handler);
      map.getCanvas().style.cursor = '';
    };
  }, [dropPinMode, onMapTap]);

  const cycleBasemap = () => {
    const next = basemap === 'satellite' ? 'streets' : 'satellite';
    setBasemapState(next);
    setBasemapPref(next);
    if (mapRef.current) setBasemap(mapRef.current, next);
  };

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full" />
      <button
        type="button"
        onClick={cycleBasemap}
        title={basemap === 'satellite' ? 'Switch to streets' : 'Switch to satellite'}
        className="absolute right-3 bottom-24 z-10 bg-brandSurface/95 border border-brandBorder rounded-lg px-3 py-2 text-sm text-white shadow-lg flex items-center gap-2 hover:border-landGreen safe-bottom"
        style={{ backdropFilter: 'blur(6px)' }}
      >
        {basemap === 'satellite' ? '🗺️ Streets' : '🛰️ Satellite'}
      </button>
    </div>
  );
}
