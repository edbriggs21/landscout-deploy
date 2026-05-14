// Wrapper around all Netlify function calls.
// All non-auth functions take `code` in the JSON body.

const BASE = import.meta.env.VITE_API_BASE_URL || 'https://landscout.land/.netlify/functions';

async function postJson(path, body) {
  const res = await fetch(`${BASE}/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}

export async function validateCode(code) {
  return postJson('deployment-validate-code', { code });
}

export async function updateReadiness({ code, owner_id, readiness, notes, updated_by }) {
  return postJson('deployment-update-readiness', { code, owner_id, readiness, notes, updated_by });
}

export async function updateStatus({ code, owner_id, action, updated_by }) {
  return postJson('deployment-update-status', { code, owner_id, action, updated_by });
}

export async function addAccessPoint({ code, owner_id, lat, lng, label, created_by }) {
  return postJson('deployment-add-access-point', { code, owner_id, lat, lng, label, created_by });
}

export async function deleteAccessPoint({ code, access_point_id }) {
  return postJson('deployment-delete-access-point', { code, access_point_id });
}

export async function uploadPhoto({ code, owner_id, caption, role, uploaded_by, file }) {
  const form = new FormData();
  form.append('code', code);
  form.append('owner_id', owner_id);
  form.append('role', role);
  if (caption) form.append('caption', caption);
  if (uploaded_by) form.append('uploaded_by', uploaded_by);
  form.append('photo', file);
  const res = await fetch(`${BASE}/deployment-upload-photo`, { method: 'POST', body: form });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `Upload failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}

export async function deletePhoto({ code, photo_id, requested_by }) {
  return postJson('deployment-delete-photo', { code, photo_id, requested_by });
}

export async function refreshPhotoUrls({ code, owner_id }) {
  return postJson('deployment-refresh-photo-urls', { code, owner_id });
}

export async function updateOpsInfo({ code, owner_id, ops_info_pending, updated_by }) {
  return postJson('deployment-update-ops-info', { code, owner_id, ops_info_pending, updated_by });
}

export async function fetchLayer({ code, layer_id }) {
  return postJson('deployment-fetch-layer', { code, layer_id });
}

export async function recomputeSchedule(code) {
  return postJson('deployment-recompute-schedule', { code });
}

export async function setStartPoint({ code, lat, lng, label, updated_by, clear }) {
  return postJson('deployment-set-start-point', { code, lat, lng, label, updated_by, clear });
}

export async function reorderSchedule({ code, ordered_ids, updated_by }) {
  return postJson('deployment-reorder-schedule', { code, ordered_ids, updated_by });
}

export async function resetSchedule({ code, updated_by }) {
  return postJson('deployment-reset-schedule', { code, updated_by });
}

export async function getOwnerNodes({ code, owner_id }) {
  return postJson('deployment-owner-nodes', { code, owner_id });
}

// Mark a single node deployed/retrieved/undeploy/unretrieve. Server
// auto-rolls-up parcel state when all nodes on a parcel reach the same state.
export async function updateNodeStatus({ code, layer_id, feature_key, action, updated_by }) {
  return postJson('deployment-update-node-status', { code, layer_id, feature_key, action, updated_by });
}

// Triggers a CSV download in the browser.
export async function downloadNodesReport({ code }) {
  const res = await fetch(`${BASE}/deployment-export-nodes-report`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  });
  if (!res.ok) {
    const t = await res.text();
    let msg;
    try { msg = JSON.parse(t).error; } catch { msg = t; }
    throw new Error(msg || `Report failed (${res.status})`);
  }
  const blob = await res.blob();
  // Filename from Content-Disposition if present
  const cd = res.headers.get('content-disposition') || '';
  const m = /filename=\"?([^\";]+)/.exec(cd);
  const filename = m ? m[1] : 'nodes-report.csv';
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 200);
  return { filename };
}
