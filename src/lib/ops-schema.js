// Generic Ops Info schema helpers for the deploy app.
//
// ⚠️ IMPORTANT: In the main LandScout codebase, `index.html` defines
// `DEFAULT_OPS_FORM_SCHEMA` and `getMergedOpsSchema()`. To match rendering
// pixel-perfectly, COPY those two symbols from the LandScout source into
// this file and replace `defaultSchema` + `mergeSchema` below with the
// real implementations.
//
// Until that happens, this file provides a safe generic fallback that will
// render whatever fields are present in `ops_info` as editable inputs.

export const DEFAULT_OPS_FORM_SCHEMA = {
  sections: [
    {
      title: 'Site access',
      fields: [
        { key: 'access_notes', label: 'Access notes', type: 'textarea' },
        { key: 'gate_code', label: 'Gate code', type: 'text' },
        { key: 'best_entry_point', label: 'Best entry point', type: 'text' },
      ],
    },
    {
      title: 'Site conditions',
      fields: [
        { key: 'terrain_notes', label: 'Terrain notes', type: 'textarea' },
        { key: 'hazards', label: 'Hazards', type: 'textarea' },
        { key: 'livestock_present', label: 'Livestock present', type: 'checkbox' },
      ],
    },
    {
      title: 'Owner contact',
      fields: [
        { key: 'best_contact_method', label: 'Best contact method', type: 'text' },
        { key: 'preferred_time', label: 'Preferred contact time', type: 'text' },
      ],
    },
  ],
};

// Merges project-specific overrides with defaults. LandScout has a smarter version.
export function getMergedOpsSchema(project) {
  // In LandScout's implementation, project.config.ops_schema may extend/override defaults.
  const override = project && project.config && project.config.ops_schema;
  if (!override || !Array.isArray(override.sections)) return DEFAULT_OPS_FORM_SCHEMA;

  // Merge by section title
  const merged = { sections: [...DEFAULT_OPS_FORM_SCHEMA.sections] };
  for (const sec of override.sections) {
    const idx = merged.sections.findIndex(s => s.title === sec.title);
    if (idx === -1) merged.sections.push(sec);
    else merged.sections[idx] = { ...merged.sections[idx], ...sec };
  }
  return merged;
}

// Collects every field key so we can render unknown fields from ops_info
// that are NOT in the schema (so no data is hidden).
export function collectSchemaKeys(schema) {
  const out = new Set();
  for (const sec of (schema.sections || [])) {
    for (const f of (sec.fields || [])) out.add(f.key);
  }
  return out;
}
