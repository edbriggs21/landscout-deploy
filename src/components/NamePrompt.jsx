import React, { useState } from 'react';

export default function NamePrompt({ onSubmit }) {
  const [name, setName] = useState('');
  return (
    <div className="min-h-screen flex items-center justify-center px-5">
      <form
        onSubmit={e => { e.preventDefault(); if (name.trim()) onSubmit(name.trim()); }}
        className="w-full max-w-sm bg-brandSurface border border-brandBorder rounded-2xl p-5"
      >
        <h2 className="text-white text-xl font-semibold mb-1">Welcome</h2>
        <p className="text-sm text-slate-400 mb-4">Tell us your name — we'll stamp your updates with it so the team knows who did what.</p>
        <input
          autoFocus
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Your name"
          className="w-full bg-brandBg border border-brandBorder rounded-lg px-4 py-3 text-white focus:border-landGreen focus:outline-none"
        />
        <button type="submit" disabled={!name.trim()}
          className="mt-4 w-full bg-landGreen text-deepBlue font-semibold py-3 rounded-lg disabled:opacity-50">
          Get started
        </button>
      </form>
    </div>
  );
}
