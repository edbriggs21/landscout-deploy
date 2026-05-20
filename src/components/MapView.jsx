import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  createMap, loadPinImage, maplibregl,
  allParcelsGeoJson, accessPointsGeoJson, fitToFeatures, colorForOwner,
  setBasemap, parcelCentroid,
} from '../lib/maplibre-setup.js';
import { getBasemap, setBasemapPref } from '../lib/identity.js';
import LayerPanel from './LayerPanel.jsx';

// Node dot fill color, by state:
//   retrieved -> green, deployed -> yellow,
//   owner marked "blocked" -> red, otherwise (undeployed) -> slate gray.
// blockedIds is the list of owner ids with deployment_readiness === 'blocked'.
function nodeColorExpr(blockedIds) {
  return [
    'case',
    ['==', ['get', 'node_status'], 'retrieved'], '#10B981',
    ['==', ['get', 'node_status'], 'deployed'],  '#FACC15',
    ['in', ['get', 'owner_id'], ['literal', blockedIds || []]], '#EF4444',
    '#94A3B8',
  ];
}

export default function MapView({
  project, owners, accessPoints,
  layers = [], loadedLayers = {}, visibleLayerIds, onToggleLayer,
  parcelsVisible = true, onToggleParcels,
  ownerNumbersVisible = false, onToggleOwnerNumbers,
  crewLocations = [],
  nextWeekNodeNumbers = [],
  rightInset = 0,
  selectedNodeNumber = null,
  onSelectNode,
  onMapReady,
  selectedOwnerId, dropPinMode,
  onSelectOwner, onMapTap,
}) {
  // (project already passed in but we now read project.deployment_start)
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const didFitRef = useRef(false);
  const [ready, setReady] = useState(false);
  const [basemap, setBasemapState] = useState(getBasemap());

  // Owner ids a scout has marked "blocked" - nodes on these parcels show red.
  const blockedOwnerIds = useMemo(
    () => (owners || []).filter(o => o.deployment_readiness === 'blocked').map(o => o.id),
    [owners]
  );

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

      // Selected-owner highlight: a brighter overlay on top of normal parcels
      // shown only for the currently-selected owner_id. Uses a filter that we
      // update via a separate effect when selectedOwnerId changes.
      map.addLayer({
        id: 'parcels-fill-selected',
        type: 'fill',
        source: 'parcels',
        filter: ['==', ['get', 'owner_id'], '__none__'],
        paint: {
          'fill-color': '#9ACD32',
          'fill-opacity': 0.45,
        },
      });
      map.addLayer({
        id: 'parcels-outline-selected',
        type: 'line',
        source: 'parcels',
        filter: ['==', ['get', 'owner_id'], '__none__'],
        paint: {
          'line-color': '#9ACD32',
          'line-width': 4,
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

      // Start-point marker (☆ icon)
      map.addSource('start-point', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.addLayer({
        id: 'start-point-circle',
        type: 'circle',
        source: 'start-point',
        paint: {
          'circle-radius': 14,
          'circle-color': '#9ACD32',
          'circle-stroke-color': '#0B2A4A',
          'circle-stroke-width': 3,
        },
      });
      map.addLayer({
        id: 'start-point-text',
        type: 'symbol',
        source: 'start-point',
        layout: {
          'text-field': '★',
          'text-size': 18,
          'text-allow-overlap': true,
          'text-font': ['Noto Sans Bold'],
        },
        paint: { 'text-color': '#0B2A4A' },
      });

      // Roads + place-name overlay (visible in satellite mode). Placed
      // above the parcel fill so labels stay readable; below access pins
      // so they don't cover any tappable scout markers.
      try {
        map.addLayer({
          id: 'esri-transportation', type: 'raster', source: 'esri-transportation',
          layout: { visibility: 'none' },
        }, 'access-points-symbol');
      } catch (_) {}

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
          'text-font': ['Noto Sans Bold'],
        },
        paint: { 'text-color': '#FFFFFF' },
      });

      // Live crew locations — pulsing pink dot + name label
      map.addSource('crew-locations', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.addLayer({
        id: 'crew-locations-halo',
        type: 'circle',
        source: 'crew-locations',
        paint: {
          'circle-radius': 14,
          'circle-color': '#EC4899',
          'circle-opacity': 0.25,
        },
      });
      map.addLayer({
        id: 'crew-locations-dot',
        type: 'circle',
        source: 'crew-locations',
        paint: {
          'circle-radius': 7,
          'circle-color': '#EC4899',
          'circle-stroke-color': '#FFFFFF',
          'circle-stroke-width': 2,
        },
      });
      map.addLayer({
        id: 'crew-locations-text',
        type: 'symbol',
        source: 'crew-locations',
        layout: {
          'text-field': ['get', 'label'],
          'text-size': 11,
          'text-anchor': 'top',
          'text-offset': [0, 1.0],
          'text-allow-overlap': true,
          'text-ignore-placement': true,
          'text-font': ['Noto Sans Bold'],
        },
        paint: {
          'text-color': '#FFFFFF',
          'text-halo-color': '#0B2A4A',
          'text-halo-width': 1.4,
        },
      });

      map.on('click', 'parcels-fill', (e) => {
        if (e.defaultPrevented) return; // an access-point click already handled this
        const f = e.features && e.features[0];
        if (f && f.properties && f.properties.owner_id) {
          onSelectOwner(f.properties.owner_id);
        }
      });
      map.on('mouseenter', 'parcels-fill', () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', 'parcels-fill', () => { map.getCanvas().style.cursor = ''; });

      // Click an access-point pin -> popup with a 'Get directions' link.
      // Uses Google Maps directions URL which auto-opens the Maps app on
      // mobile (both iOS and Android) and the web on desktop.
      map.on('click', 'access-points-symbol', (e) => {
        e.preventDefault(); // suppress fall-through to parcels-fill below
        const f = e.features && e.features[0];
        if (!f) return;
        const [lng, lat] = f.geometry.coordinates;
        const label = (f.properties && f.properties.label) || 'Access pin';
        const dirUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
        const html = `
          <div style="font-family: -apple-system, sans-serif; min-width: 180px;">
            <div style="font-weight: 600; color: #0B2A4A; margin-bottom: 4px;">${label.replace(/[<>&"]/g, c=>({ '<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;' }[c]))}</div>
            <div style="font-size: 11px; color: #5F7799; margin-bottom: 8px;">${lat.toFixed(5)}, ${lng.toFixed(5)}</div>
            <a href="${dirUrl}" target="_blank" rel="noopener noreferrer"
               style="display: inline-block; background: #9ACD32; color: #0B2A4A; padding: 6px 12px; border-radius: 6px; font-size: 13px; font-weight: 600; text-decoration: none;">
              🚗 Get directions
            </a>
          </div>`;
        new maplibregl.Popup({ closeButton: true, closeOnClick: true, offset: 18 })
          .setLngLat([lng, lat])
          .setHTML(html)
          .addTo(map);
      });
      map.on('mouseenter', 'access-points-symbol', () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', 'access-points-symbol', () => { map.getCanvas().style.cursor = ''; });

      setReady(true);
      // Expose a small API to the parent so the Plan sidebar can fly the
      // map to a node's coords.
      if (onMapReady) {
        onMapReady({
          flyTo: (lat, lng) => {
            try { map.flyTo({ center: [lng, lat], zoom: Math.max(map.getZoom(), 15), duration: 700 }); } catch (_) {}
          },
        });
      }

      // Apply persisted basemap choice
      setBasemap(map, basemap);

      // Initial data + fit
      const gj = allParcelsGeoJson(owners);
      map.getSource('parcels').setData(gj);
      map.getSource('access-points').setData(accessPointsGeoJson(accessPoints));

      // Seed start-point source from the project prop
      if (project && project.deployment_start &&
          typeof project.deployment_start.lat === 'number' &&
          typeof project.deployment_start.lng === 'number') {
        const sp = project.deployment_start;
        map.getSource('start-point').setData({
          type: 'FeatureCollection',
          features: [{
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [sp.lng, sp.lat] },
            properties: { label: sp.label || 'Start' },
          }],
        });
      }

      // Seed order-labels source from the owners prop. Use parcel centroid
      // (same as routing) — never the geocoded billing address.
      const initialLabels = (owners || [])
        .filter(o => o.deployment_order != null)
        .map(o => {
          const c = parcelCentroid(o);
          if (!c) return null;
          return {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: c },
            properties: { label: String(o.deployment_order) },
          };
        })
        .filter(Boolean);
      map.getSource('order-labels').setData({ type: 'FeatureCollection', features: initialLabels });

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

  // Refresh data layers when owners/accessPoints change OR when the map first
  // becomes ready. Includes 'ready' in the deps so the effect re-runs once the
  // map's 'load' event fires.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const gj = allParcelsGeoJson(owners);
    map.getSource('parcels').setData(gj);
    map.getSource('access-points').setData(accessPointsGeoJson(accessPoints));

    // Order labels for scheduled parcels — placed at the PARCEL centroid,
    // matching how the route is computed. Never use geocoded billing address.
    const labelFeatures = (owners || [])
      .filter(o => o.deployment_order != null)
      .map(o => {
        const c = parcelCentroid(o);
        if (!c) return null;
        return {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: c },
          properties: { label: String(o.deployment_order), owner_id: o.id },
        };
      })
      .filter(Boolean);
    if (map.getSource('order-labels')) {
      map.getSource('order-labels').setData({ type: 'FeatureCollection', features: labelFeatures });
    }

    // Start-point marker
    if (map.getSource('start-point')) {
      const sp = project && project.deployment_start;
      const features = (sp && typeof sp.lat === 'number' && typeof sp.lng === 'number')
        ? [{ type: 'Feature', geometry: { type: 'Point', coordinates: [sp.lng, sp.lat] }, properties: { label: sp.label || 'Start' } }]
        : [];
      map.getSource('start-point').setData({ type: 'FeatureCollection', features });
    }

    // If the map loaded before owners arrived, do the initial fit here once
    if (!didFitRef.current && gj.features.length) {
      fitToFeatures(map, gj);
      didFitRef.current = true;
    }
  }, [owners, accessPoints, project, ready]);

  // Sync overlay layers (LandScout overlay_layers).
  // For each layer that is visible AND has its geojson loaded, ensure a MapLibre
  // source + layer exists with type-appropriate styling. Hide/remove otherwise.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

    const visibleSet = visibleLayerIds || new Set();

    for (const meta of layers) {
      const sourceId = `ovl-${meta.id}`;
      const layerId = `ovl-${meta.id}-render`;
      const strokeId = `ovl-${meta.id}-stroke`;
      const isVisible = visibleSet.has(meta.id) && !!loadedLayers[meta.id];

      // Add or update source when geojson is available
      if (loadedLayers[meta.id]) {
        const existing = map.getSource(sourceId);
        if (!existing) {
          try {
            map.addSource(sourceId, { type: 'geojson', data: loadedLayers[meta.id] });
          } catch (_) { /* ignore double-add */ }
        } else {
          try { existing.setData(loadedLayers[meta.id]); } catch (_) {}
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
            // Click handler: emit the node_number to the parent so the Plan
            // sidebar can scroll to and highlight the matching card.
            map.on('click', layerId, (e) => {
              const f = e.features && e.features[0];
              const props = (f && f.properties) || {};
              const num = props.node_number;
              const ownerId = props.owner_id || null;
              if (num != null && onSelectNode) {
                e.preventDefault();
                onSelectNode(num, ownerId);
              }
            });
            map.on('mouseenter', layerId, () => { map.getCanvas().style.cursor = 'pointer'; });
            map.on('mouseleave', layerId, () => { map.getCanvas().style.cursor = ''; });
            // Bigger circles so the canonical node number fits inside them.
            // Scale slightly with zoom so they read at multiple altitudes.
            // circle-color: retrieved -> green, deployed -> yellow,
            //   blocked parcel -> red, otherwise (undeployed) -> slate gray.
            // Every node gets a white outline so it reads on any basemap.
            map.addLayer({
              id: layerId, type: 'circle', source: sourceId,
              minzoom, maxzoom,
              paint: {
                'circle-radius': [
                  'interpolate', ['linear'], ['zoom'],
                  10, Math.max(pointRadius, 6),
                  14, Math.max(pointRadius, 11),
                  18, Math.max(pointRadius, 16),
                ],
                'circle-color': nodeColorExpr(blockedOwnerIds),
                'circle-stroke-color': '#FFFFFF',
                'circle-stroke-width': 2,
                'circle-opacity': fillOpacity || 1,
              },
            }, 'access-points-symbol');

            // Blue ring marking nodes on NEXT week's schedule. Drawn just
            // beneath the node dot (beforeId = layerId) so the dot and its
            // number stay fully visible on top.
            const ringId = `${layerId}-ring`;
            try {
              map.addLayer({
                id: ringId, type: 'circle', source: sourceId,
                minzoom, maxzoom,
                filter: ['in', ['get', 'node_number'], ['literal', nextWeekNodeNumbers || []]],
                paint: {
                  'circle-radius': [
                    'interpolate', ['linear'], ['zoom'],
                    10, Math.max(pointRadius, 6) + 5,
                    14, Math.max(pointRadius, 11) + 6,
                    18, Math.max(pointRadius, 16) + 7,
                  ],
                  'circle-color': '#3B82F6',
                  'circle-opacity': 0,
                  'circle-stroke-color': '#3B82F6',
                  'circle-stroke-width': 3,
                },
              }, layerId);
            } catch (_) {}
            // Text label showing the canonical node_number (when present).
            // minzoom raised slightly so labels don't smear into illegibility
            // at far-out zoom levels.
            const textId = `${layerId}-text`;
            try {
              map.addLayer({
                id: textId, type: 'symbol', source: sourceId,
                minzoom: Math.max(minzoom, 11),
                maxzoom,
                filter: ['has', 'node_number'],
                layout: {
                  'text-field': ['get', 'node_number_label'],
                  'text-size': [
                    'interpolate', ['linear'], ['zoom'],
                    11, 8,
                    14, 10,
                    18, 14,
                  ],
                  'text-anchor': 'center',
                  'text-allow-overlap': true,
                  'text-ignore-placement': true,
                  'text-font': ['Noto Sans Bold'],
                },
                paint: {
                  'text-color': '#FFFFFF',
                  'text-halo-color': '#0B2A4A',
                  'text-halo-width': 0.8,
                },
              });
            } catch (_) {}
          } else if (gtype.includes('line')) {
            map.addLayer({
              id: layerId, type: 'line', source: sourceId,
              minzoom, maxzoom,
              paint: {
                'line-color': color,
                'line-width': lineWidth,
                'line-opacity': strokeOpacity,
              },
            }, 'access-points-symbol');
          } else if (gtype.includes('polygon')) {
            map.addLayer({
              id: layerId, type: 'fill', source: sourceId,
              minzoom, maxzoom,
              paint: {
                'fill-color': color,
                'fill-opacity': fillOpacity,
              },
            }, 'access-points-symbol');
            map.addLayer({
              id: strokeId, type: 'line', source: sourceId,
              minzoom, maxzoom,
              paint: {
                'line-color': stroke,
                'line-width': lineWidth,
                'line-opacity': strokeOpacity,
              },
            }, 'access-points-symbol');
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
      setVis(`${layerId}-text`);
      setVis(`${layerId}-ring`);
    }
  }, [layers, loadedLayers, visibleLayerIds, ready]);

  // Re-apply node fill colors when the set of blocked owners changes - a
  // scout marking a parcel "blocked" turns its nodes red without a reload.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    for (const meta of layers) {
      const layerId = `ovl-${meta.id}-render`;
      if (map.getLayer(layerId)) {
        try { map.setPaintProperty(layerId, 'circle-color', nodeColorExpr(blockedOwnerIds)); } catch (_) {}
      }
    }
  }, [blockedOwnerIds, layers, loadedLayers, ready]);

  // Update the blue next-week ring filter when the schedule data loads.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const filt = ['in', ['get', 'node_number'], ['literal', nextWeekNodeNumbers || []]];
    for (const meta of layers) {
      const ringId = `ovl-${meta.id}-render-ring`;
      if (map.getLayer(ringId)) {
        try { map.setFilter(ringId, filt); } catch (_) {}
      }
    }
  }, [nextWeekNodeNumbers, layers, loadedLayers, ready]);

  // Sync the crew-locations source with the polled list of active crew.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    if (!map.getSource('crew-locations')) return;
    const features = (crewLocations || []).map(c => {
      const lastSeenSec = Math.round((Date.now() - new Date(c.updated_at).getTime()) / 1000);
      const ago = lastSeenSec < 60
        ? `${lastSeenSec}s ago`
        : (lastSeenSec < 3600 ? `${Math.round(lastSeenSec / 60)}m ago` : `${Math.round(lastSeenSec / 3600)}h ago`);
      const label = `${c.name || 'Crew'} · ${ago}`;
      return {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [c.lng, c.lat] },
        properties: { label, session_id: c.session_id, role: c.role || '' },
      };
    });
    map.getSource('crew-locations').setData({ type: 'FeatureCollection', features });
  }, [crewLocations, ready]);

  // Tell the map to recompute its size when the right-side inset changes
  // (sidebar opens/closes). Without this, MapLibre keeps the old viewport.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    // Run on next frame so CSS has applied
    requestAnimationFrame(() => { try { map.resize(); } catch (_) {} });
  }, [rightInset, ready]);

  // Pulsing halo on the currently-selected node (when one is chosen via
  // either map click or sidebar card tap).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const SOURCE = 'selected-node';
    const LAYER = 'selected-node-halo';
    if (!map.getSource(SOURCE)) {
      try {
        map.addSource(SOURCE, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        map.addLayer({
          id: LAYER, type: 'circle', source: SOURCE,
          paint: {
            'circle-radius': [
              'interpolate', ['linear'], ['zoom'],
              10, 12,
              14, 22,
              18, 32,
            ],
            'circle-color': '#FACC15',
            'circle-opacity': 0.35,
            'circle-stroke-color': '#FACC15',
            'circle-stroke-width': 2,
          },
        });
      } catch (_) {}
    }
    // Find the matching node in any loaded overlay layer
    let target = null;
    for (const meta of layers) {
      const gj = loadedLayers[meta.id];
      if (!gj || !gj.features) continue;
      for (const f of gj.features) {
        if (f.properties && f.properties.node_number === selectedNodeNumber) {
          target = f;
          break;
        }
      }
      if (target) break;
    }
    if (selectedNodeNumber != null && target) {
      try { map.getSource(SOURCE).setData({ type: 'FeatureCollection', features: [target] }); } catch (_) {}
    } else {
      try { map.getSource(SOURCE).setData({ type: 'FeatureCollection', features: [] }); } catch (_) {}
    }
  }, [selectedNodeNumber, layers, loadedLayers, ready]);

  // Toggle the parcel fill/outline (and the selected-owner highlight)
  // visibility based on the parcelsVisible prop.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const vis = parcelsVisible ? 'visible' : 'none';
    for (const id of ['parcels-fill', 'parcels-outline', 'parcels-fill-selected', 'parcels-outline-selected']) {
      if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', vis);
    }
  }, [parcelsVisible, ready]);

  // Toggle the per-parcel schedule-order badges. Default off so they don't
  // visually compete with the canonical node numbers.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const vis = ownerNumbersVisible ? 'visible' : 'none';
    for (const id of ['order-labels-circle', 'order-labels-text']) {
      if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', vis);
    }
  }, [ownerNumbersVisible, ready]);

  // Highlight the selected owner's parcels by updating the filters on the
  // overlay highlight layers. '__none__' is a sentinel that matches nothing
  // when no owner is selected.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const id = selectedOwnerId || '__none__';
    const filter = ['==', ['get', 'owner_id'], id];
    if (map.getLayer('parcels-fill-selected')) map.setFilter('parcels-fill-selected', filter);
    if (map.getLayer('parcels-outline-selected')) map.setFilter('parcels-outline-selected', filter);
  }, [selectedOwnerId, ready]);

  // Handle drop-pin tap mode — bind a one-shot click listener
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
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
  }, [dropPinMode, onMapTap, ready]);

  const cycleBasemap = () => {
    const next = basemap === 'satellite' ? 'streets' : 'satellite';
    setBasemapState(next);
    setBasemapPref(next);
    if (mapRef.current) setBasemap(mapRef.current, next);
  };

  return (
    <div className="relative w-full h-full" style={{ paddingRight: rightInset + 'px', transition: 'padding-right 200ms ease' }}>
      <div ref={containerRef} className="w-full h-full" />
      <LayerPanel
        layers={layers}
        visibleLayerIds={visibleLayerIds || new Set()}
        onToggle={onToggleLayer}
        parcelsVisible={parcelsVisible}
        onToggleParcels={onToggleParcels}
        ownerNumbersVisible={ownerNumbersVisible}
        onToggleOwnerNumbers={onToggleOwnerNumbers}
      />
      <button
        type="button"
        onClick={cycleBasemap}
        title={basemap === 'satellite' ? 'Switch to streets' : 'Switch to satellite'}
        className="absolute left-3 bottom-24 z-10 bg-brandSurface/95 border border-brandBorder rounded-lg px-3 py-2 text-sm text-white shadow-lg flex items-center gap-2 hover:border-landGreen safe-bottom"
        style={{ backdropFilter: 'blur(6px)' }}
      >
        {basemap === 'satellite' ? '🗺️ Streets' : '🛰️ Satellite'}
      </button>
    </div>
  );
}
