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

const SESSION_KEY = 'deploy_session_id';
export function getSessionId() {
  try {
    let v = localStorage.getItem(SESSION_KEY);
    if (!v) {
      v = (typeof crypto !== 'undefined' && crypto.randomUUID)
        ? crypto.randomUUID()
        : 'ses-' + Math.random().toString(36).slice(2) + '-' + Date.now().toString(36);
      localStorage.setItem(SESSION_KEY, v);
    }
    return v;
  } catch {
    return 'ses-fallback-' + Date.now().toString(36);
  }
}

const SHARE_KEY = 'deploy_share_location';
export function getShareLocation() {
  try { return localStorage.getItem(SHARE_KEY) === '1'; } catch { return false; }
}
export function setShareLocation(v) {
  try { localStorage.setItem(SHARE_KEY, v ? '1' : '0'); } catch {}
}

const OWNER_NUMS_KEY = 'deploy_owner_numbers_visible';
export function getOwnerNumbersVisible() {
  try { const v = localStorage.getItem(OWNER_NUMS_KEY); return v === '1'; } catch { return false; }
}
export function setOwnerNumbersVisible(v) {
  try { localStorage.setItem(OWNER_NUMS_KEY, v ? '1' : '0'); } catch {}
}
