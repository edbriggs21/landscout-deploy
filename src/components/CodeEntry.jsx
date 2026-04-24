import React, { useState } from 'react';

export default function CodeEntry({ defaultCode = '', error, loading, onSubmit }) {
  const [code, setCode] = useState(defaultCode);
  return (
    <div className="min-h-screen flex items-center justify-center px-5">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-3xl font-bold text-white">LandScout Deploy</div>
          <div className="text-sm text-slate-400 mt-1">Scout Smarter. Close Faster.</div>
        </div>
        <form
          onSubmit={e => { e.preventDefault(); if (code.trim()) onSubmit(code.trim().toUpperCase()); }}
          className="bg-brandSurface border border-brandBorder rounded-2xl p-5"
        >
          <label className="block text-sm text-slate-300 mb-2">Enter your access code</label>
          <input
            autoFocus
            type="text"
            value={code}
            onChange={e => setCode(e.target.value.toUpperCase())}
            maxLength={12}
            placeholder="ABC12345"
            className="w-full bg-brandBg border border-brandBorder rounded-lg px-4 py-3 text-white text-lg tracking-widest font-mono uppercase focus:border-landGreen focus:outline-none"
          />
          {error && <div className="mt-3 text-sm text-red-400">{error}</div>}
          <button
            type="submit"
            disabled={loading || !code.trim()}
            className="mt-4 w-full bg-landGreen text-deepBlue font-semibold py-3 rounded-lg disabled:opacity-50"
          >
            {loading ? 'Checking…' : 'Continue'}
          </button>
          <p className="mt-4 text-xs text-slate-500 text-center">
            Your code was emailed to you. If you don't have one, contact the project owner.
          </p>
        </form>
      </div>
    </div>
  );
}
