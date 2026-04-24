import maplibregl from 'maplibre-gl';

// Free tile source — no API key needed.
// Replace with your preferred source (e.g., MapTiler / protomaps) before production.
// Carto Voyager basemap — free, no API key, allows hotlinking.
// Built on OpenStreetMap data.
// Two basemap options: Carto Voyager (streets) and Esri World Imagery (satellite).
// Both are free, no API key. Esri Imagery allows hotlinking up to a fair-use threshold.
const OSM_STYLE = {
  version: 8,
  sources: {
    'carto-voyager': {
      type: 'raster',
      tiles: [
        'https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
        'https://b.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
        'https://c.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
        'https://d.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
      ],
      tileSize: 256,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    },
    'esri-imagery': {
      type: 'raster',
      tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
      tileSize: 256,
      maxzoom: 19,
      attribution: 'Tiles &copy; <a href="https://www.esri.com">Esri</a> &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community',
    },
  },
  layers: [
    { id: 'carto-voyager', type: 'raster', source: 'carto-voyager' },
    { id: 'esri-imagery', type: 'raster', source: 'esri-imagery', layout: { visibility: 'none' } },
  ],
};

// Toggle which basemap layer is visible. Safe to call before style is loaded.
export function setBasemap(map, name) {
  if (!map || !map.getLayer) return;
  const apply = () => {
    if (!map.getLayer('carto-voyager') || !map.getLayer('esri-imagery')) return;
    if (name === 'satellite') {
      map.setLayoutProperty('carto-voyager', 'visibility', 'none');
      map.setLayoutProperty('esri-imagery', 'visibility', 'visible');
    } else {
      map.setLayoutProperty('carto-voyager', 'visibility', 'visible');
      map.setLayoutProperty('esri-imagery', 'visibility', 'none');
    }
  };
  if (map.isStyleLoaded()) apply();
  else map.once('idle', apply);
}

// Pin icon as an inline SVG data URL
const PIN_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="32" height="40" viewBox="0 0 32 40">
  <path d="M16 0c8.8 0 16 7 16 15.7 0 11.8-16 24.3-16 24.3S0 27.5 0 15.7C0 7 7.2 0 16 0z" fill="#9ACD32"/>
  <circle cx="16" cy="15" r="6" fill="#0B2A4A"/>
</svg>`.trim();

export function createMap(container) {
  const map = new maplibregl.Map({
    container,
    style: OSM_STYLE,
    center: [-97.5, 39.8],
    zoom: 4,
    attributionControl: true,
  });
  return map;
}

export async function loadPinImage(map) {
  if (map.hasImage && map.hasImage('deploy-pin')) return;
  const url = `data:image/svg+xml;utf8,${encodeURIComponent(PIN_SVG)}`;
  const img = new Image(32, 40);
  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = reject;
    img.src = url;
  });
  map.addImage('deploy-pin', img, { pixelRatio: 1 });
}

export function colorForOwner(owner) {
  if (owner.retrieved_at) return '#16803c';       // dark green — complete
  if (owner.deployed_at) return '#9ACD32';        // land green — in field
  if (owner.deployment_readiness === 'blocked') return '#FF6B6B';  // red
  if (owner.deployment_readiness === 'needs_work') return '#FFB547'; // amber
  if (owner.deployment_readiness === 'ready') return '#25A7FF';    // data blue
  return '#5F7799';                               // gray — not yet scouted
}

// Convert owner.parcels_data (JSONB) into GeoJSON features.
// LandScout parcels_data is typically either:
//   - a FeatureCollection
//   - an array of Features
//   - a single Feature
export function parcelsToGeoJson(owner) {
  const raw = owner.parcels_data;
  if (!raw) return { type: 'FeatureCollection', features: [] };
  const features = [];
  const pushFeature = (f) => {
    if (!f || !f.geometry) return;
    features.push({
      ...f,
      properties: { ...(f.properties || {}), owner_id: owner.id, color: colorForOwner(owner) },
    });
  };
  if (raw.type === 'FeatureCollection' && Array.isArray(raw.features)) {
    raw.features.forEach(pushFeature);
  } else if (Array.isArray(raw)) {
    raw.forEach(pushFeature);
  } else if (raw.type === 'Feature') {
    pushFeature(raw);
  } else if (raw.type && raw.coordinates) {
    // bare geometry
    pushFeature({ type: 'Feature', geometry: raw, properties: {} });
  }
  return { type: 'FeatureCollection', features };
}

export function allParcelsGeoJson(owners) {
  const all = { type: 'FeatureCollection', features: [] };
  for (const o of owners) {
    const fc = parcelsToGeoJson(o);
    all.features.push(...fc.features);
  }
  return all;
}

export function accessPointsGeoJson(accessPoints) {
  return {
    type: 'FeatureCollection',
    features: accessPoints.map(p => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
      properties: { id: p.id, owner_id: p.owner_id, label: p.label || '' },
    })),
  };
}

export function fitToFeatures(map, featureCollection) {
  const bounds = new maplibregl.LngLatBounds();
  let any = false;
  for (const f of featureCollection.features) {
    const walk = (coords) => {
      if (!Array.isArray(coords)) return;
      if (typeof coords[0] === 'number') {
        bounds.extend(coords);
        any = true;
      } else {
        coords.forEach(walk);
      }
    };
    walk(f.geometry && f.geometry.coordinates);
  }
  if (any) map.fitBounds(bounds, { padding: 60, maxZoom: 15, duration: 400 });
}

export { maplibregl };
