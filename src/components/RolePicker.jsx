import React from 'react';

export default function RolePicker({ onSelect, projectName }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-5">
      <div className="w-full max-w-sm">
        <h2 className="text-white text-xl font-semibold mb-1 text-center">Pick your role</h2>
        {projectName && <p className="text-sm text-slate-400 mb-6 text-center">Project: {projectName}</p>}
        <div className="space-y-3">
          <button
            onClick={() => onSelect('scout')}
            className="w-full bg-brandSurface border border-brandBorder hover:border-dataBlue rounded-2xl p-5 text-left"
          >
            <div className="text-white font-semibold mb-1">Scout</div>
            <div className="text-sm text-slate-400">I'm visiting parcels ahead of deployment to mark readiness, drop access pins, and upload photos.</div>
          </button>
          <button
            onClick={() => onSelect('crew')}
            className="w-full bg-brandSurface border border-brandBorder hover:border-landGreen rounded-2xl p-5 text-left"
          >
            <div className="text-white font-semibold mb-1">Crew</div>
            <div className="text-sm text-slate-400">I'm on the deployment team — marking parcels deployed and retrieved.</div>
          </button>
        </div>
      </div>
    </div>
  );
}
