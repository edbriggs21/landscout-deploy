import React, { useEffect, useRef, useState } from 'react';
import * as api from '../api.js';

export default function PhotoGallery({ owner, code, name, role, photos, onChanged, readOnlyUploads }) {
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState('');
  const [signedPhotos, setSignedPhotos] = useState(photos);
  const [lastRefresh, setLastRefresh] = useState(Date.now());

  // Refresh signed URLs after 55 minutes.
  useEffect(() => { setSignedPhotos(photos); }, [photos]);
  useEffect(() => {
    let cancelled = false;
    const age = Date.now() - lastRefresh;
    if (age < 55 * 60 * 1000) return;
    (async () => {
      try {
        const res = await api.refreshPhotoUrls({ code, owner_id: owner.id });
        if (!cancelled) {
          setSignedPhotos(res.photos);
          setLastRefresh(Date.now());
        }
      } catch (_) {}
    })();
    return () => { cancelled = true; };
  }, [owner.id, code, lastRefresh]);

  const onFileChange = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setUploading(true); setErr('');
    try {
      await api.uploadPhoto({ code, owner_id: owner.id, role, uploaded_by: name, file });
      await onChanged();
    } catch (e2) { setErr(e2.message); }
    finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const del = async (photo_id) => {
    if (!confirm('Delete this photo?')) return;
    try {
      await api.deletePhoto({ code, photo_id, requested_by: name });
      await onChanged();
    } catch (e) { alert(e.message); }
  };

  return (
    <div>
      {!readOnlyUploads && (
        <div className="mb-3">
          <input ref={fileRef} type="file" accept="image/*" capture="environment"
            onChange={onFileChange} className="hidden" />
          <button onClick={() => fileRef.current && fileRef.current.click()}
            disabled={uploading}
            className="bg-landGreen text-deepBlue font-semibold py-2 px-4 rounded-lg disabled:opacity-50">
            {uploading ? 'Uploading…' : 'Upload photo'}
          </button>
          {err && <div className="mt-2 text-sm text-red-400">{err}</div>}
        </div>
      )}

      <div className="grid grid-cols-3 gap-2">
        {signedPhotos.length === 0 && <div className="col-span-3 text-sm text-slate-500">No photos yet.</div>}
        {signedPhotos.map(p => (
          <div key={p.id} className="relative aspect-square rounded-md overflow-hidden bg-brandBg">
            {p.signed_url
              ? <img src={p.signed_url} alt={p.caption || ''} className="w-full h-full object-cover" loading="lazy" />
              : <div className="w-full h-full flex items-center justify-center text-xs text-slate-500">no url</div>}
            {!readOnlyUploads && p.uploaded_by === name && (
              <button onClick={() => del(p.id)}
                className="absolute top-1 right-1 bg-black/60 text-white text-xs rounded px-2 py-0.5">×</button>
            )}
            <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-1 py-0.5 text-[10px] text-white truncate">
              {p.uploaded_by || '—'} · {p.role}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
