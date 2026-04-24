import React from 'react';

export default function EmptyProject({ projectName }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-5">
      <div className="max-w-sm text-center">
        <div className="text-xl text-white font-semibold mb-2">No parcels ready for deployment yet</div>
        {projectName && <div className="text-sm text-slate-400 mb-4">Project: {projectName}</div>}
        <p className="text-sm text-slate-400">
          Parcels appear here once they reach the <strong className="text-white">Signed</strong> or <strong className="text-white">Executed</strong> stage.
          Check back soon.
        </p>
      </div>
    </div>
  );
}
