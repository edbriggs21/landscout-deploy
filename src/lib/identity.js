const NAME_KEY = 'deploy_user_name';
const ROLE_KEY = 'deploy_user_role';

export function getName() {
  try { return localStorage.getItem(NAME_KEY) || ''; } catch { return ''; }
}
export function setName(name) {
  try { localStorage.setItem(NAME_KEY, name); } catch {}
}
export function getRole() {
  try { return localStorage.getItem(ROLE_KEY) || ''; } catch { return ''; }
}
export function setRole(role) {
  try { localStorage.setItem(ROLE_KEY, role); } catch {}
}

const BASEMAP_KEY = 'deploy_basemap';
export function getBasemap() {
  try { return localStorage.getItem(BASEMAP_KEY) || 'streets'; } catch { return 'streets'; }
}
export function setBasemapPref(name) {
  try { localStorage.setItem(BASEMAP_KEY, name); } catch {}
}

const PARCELS_KEY = 'deploy_parcels_visible';
export function getParcelsVisible() {
  try { const v = localStorage.getItem(PARCELS_KEY); return v == null ? true : v === '1'; } catch { return true; }
}
export function setParcelsVisible(v) {
  try { localStorage.setItem(PARCELS_KEY, v ? '1' : '0'); } catch {}
}
