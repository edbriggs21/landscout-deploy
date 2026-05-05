import React, { useEffect, useRef, useState } from 'react';
import {
  createMap, loadPinImage, maplibregl,
  allParcelsGeoJson, accessPointsGeoJson, fitToFeatures, colorForOwner,
  setBasemap,
} from '../lib/maplibre-setup.js';
import { getBasemap, setBasemapPref } from '../lib/identity.js';
import LayerPanel from './LayerPanel.jsx';

export default function MapView({
  project, owners, accessPoints,
  layers = [], loadedLayers = {}, visibleLayerIds, onToggleLayer,
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

      // Schedule order labels — small numeric badges at parcel centroids
      map.addSource('order-labels', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.addLayer({
        id: 'order-labels-circle',
        type: 'circle',
        source: 'order-labels',
        minzoom: 9,
        paint: {
          'circle-radius': 11,
          'circle-color': '#0B2A4A',
          'circle-stroke-color': '#9ACD32',
          'circle-stroke-width': 2,
        },
      });
      map.addLayer({
        id: 'order-labels-text',
        type: 'symbol',
        source: 'order-labels',
        minzoom: 9,
        layout: {
          'text-field': ['get', 'label'],
          'text-size': 11,
          'text-allow-overlap': true,
          'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
        },
        paint: {
          'text-color': '#FFFFFF',
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

    // Order labels for scheduled parcels (deployment_order != null)
    const labelFeatures = (owners || [])
      .filter(o => o.deployment_order != null)
      .map(o => {
        let lng = o.geocoded_lng, lat = o.geocoded_lat;
        if (typeof lng !== 'number' || typeof lat !== 'number') {
          // Fallback to a coord pulled from the parcel geometry
          const fc = allParcelsGeoJson({ ...o });
          const f = fc.features[0];
          if (!f) return null;
          // crude centroid: first coord we find
          let pt = null;
          const walk = (c) => {
            if (pt || !Array.isArray(c)) return;
            if (typeof c[0] === 'number') pt = c;
            else c.forEach(walk);
          };
          walk(f.geometry && f.geometry.coordinates);
          if (!pt) return null;
          lng = pt[0]; lat = pt[1];
        }
        return {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [lng, lat] },
          properties: { label: String(o.deployment_order), owner_id: o.id },
        };
      })
      .filter(Boolean);
    if (map.getSource('order-labels')) {
      map.getSource('order-labels').setData({ type: 'FeatureCollection', features: labelFeatures });
    }

    // If the map loaded before owners arrived, do the initial fit here once
    if (!didFitRef.current && gj.features.length) {
      fitToFeatures(map, gj);
      didFitRef.current = true;
    }
  }, [owners, accessPoints]);

  // Sync overlay layers (LandScout overlay_layers).
  // For each layer that is visible AND has its geojson loaded, ensure a MapLibre
  // source + layer exists with type-appropriate styling. Hide/remove otherwise.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;

    const visibleSet = visibleLayerIds || new Set();

    for (const meta of layers) {
      const sourceId = `ovl-${meta.id}`;
      const layerId = `ovl-${meta.id}-render`;
      const strokeId = `ovl-${meta.id}-stroke`;
      const isVisible = visibleSet.has(meta.id) && !!loadedLayers[meta.id];

      // Add or update source when geojson is available
      if (loadedLayers[meta.id]) {
        if (!map.getSource(sourceId)) {
          try {
            map.addSource(sourceId, { type: 'geojson', data: loadedLayers[meta.id] });
          } catch (_) { /* ignore double-add */ }
        }
      }

      // Determine layer type
      const gtype = (meta.geometry_type || '').toLowerCase();
      const color = meta.color || '#9ACD32';
      const stroke = meta.stroke_color || color;
      const lineWidth = Number(meta.line_width) || 1.5;
      const fillOpacity = Number(meta.fill_opacity ?? 0.4);
      const strokeOpacity = Number(meta.stroke_opacity ?? 1);
      const pointRadius = Number(meta.point_size) || 5;
      const psColor = meta.point_stroke_color || stroke;
      const psWidth = Number(meta.point_stroke_width) || 1;
      const minzoom = Number(meta.zoom_min) || 0;
      const maxzoom = meta.zoom_max != null ? Number(meta.zoom_max) : 24;

      // Build MapLibre layer once
      if (loadedLayers[meta.id] && !map.getLayer(layerId)) {
        try {
          if (gtype.includes('point')) {
            map.addLayer({
              id: layerId, type: 'circle', source: sourceId,
              minzoom, maxzoom,
              paint: {
                'circle-radius': pointRadius,
                'circle-color': color,
                'circle-stroke-color': psColor,
                'circle-stroke-width': psWidth,
                'circle-opacity': fillOpacity || 1,
              },
            }, 'parcels-fill');
          } else if (gtype.includes('line')) {
            map.addLayer({
              id: layerId, type: 'line', source: sourceId,
              minzoom, maxzoom,
              paint: {
                'line-color': color,
                'line-width': lineWidth,
                'line-opacity': strokeOpacity,
              },
            }, 'parcels-fill');
          } else if (gtype.includes('polygon')) {
            map.addLayer({
              id: layerId, type: 'fill', source: sourceId,
              minzoom, maxzoom,
              paint: {
                'fill-color': color,
                'fill-opacity': fillOpacity,
              },
            }, 'parcels-fill');
            map.addLayer({
              id: strokeId, type: 'line', source: sourceId,
              minzoom, maxzoom,
              paint: {
                'line-color': stroke,
                'line-width': lineWidth,
                'line-opacity': strokeOpacity,
              },
            }, 'parcels-fill');
          }
        } catch (e) {
          console.warn('add overlay layer failed', meta.name, e);
        }
      }

      // Toggle visibility
      const setVis = (id) => {
        if (!map.getLayer(id)) return;
        map.setLayoutProperty(id, 'visibility', isVisible ? 'visible' : 'none');
      };
      setVis(layerId);
      setVis(strokeId);
    }
  }, [layers, loadedLayers, visibleLayerIds]);

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
      <LayerPanel
        layers={layers}
        visibleLayerIds={visibleLayerIds || new Set()}
        onToggle={onToggleLayer}
      />
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
