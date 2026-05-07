// Port of LandScout's DEFAULT_OPS_FORM_SCHEMA + getMergedOpsSchema.
// Keep this in sync with index.html in the main LandScout repo (around line 18641).
// If LandScout's schema changes, mirror it here.

export const DEFAULT_OPS_FORM_SCHEMA = {
  sections: [
    {
      key: 'contact', label: 'Contact Info',
      fields: [
        { key: 'preferred_method', label: 'Preferred Contact Method', type: 'radio', options: ['Call', 'Text', 'Email'], enabled: true },
        { key: 'preferred_time', label: 'Preferred Contact Time', type: 'text', placeholder: 'e.g. After 5pm weekdays', enabled: true },
        { key: '_owner_phone', label: 'Primary Phone', type: 'owner_readonly', source: 'phone', enabled: true },
        { key: '_owner_email', label: 'Primary Email', type: 'owner_readonly', source: 'email', enabled: true },
        { key: 'secondary_contact_name', label: 'Secondary Contact Name', type: 'text', enabled: true },
        { key: 'secondary_contact_phone', label: 'Secondary Contact Phone', type: 'text', enabled: true },
        { key: 'secondary_contact_relationship', label: 'Secondary Contact Relationship', type: 'text', enabled: true },
        { key: 'emergency_contact_name', label: 'Emergency Contact Name', type: 'text', enabled: true },
        { key: 'emergency_contact_phone', label: 'Emergency Contact Phone', type: 'text', enabled: true },
        { key: 'emergency_contact_relationship', label: 'Emergency Contact Relationship', type: 'text', enabled: true },
      ],
    },
    {
      key: 'access', label: 'Property Access',
      fields: [
        { key: 'gate_on_property', label: 'Gate on Property?', type: 'toggle', enabled: true },
        { key: 'gate_info', label: 'Gate Code / Key Info', type: 'text', conditional: 'gate_on_property', enabled: true },
        { key: 'dogs_on_property', label: 'Dogs on Property?', type: 'toggle', enabled: true },
        { key: 'dog_details', label: 'Dog Details', type: 'text', placeholder: 'e.g. 2 labs, friendly', conditional: 'dogs_on_property', enabled: true },
        { key: 'road_condition', label: 'Access Road Condition', type: 'select', options: ['Paved', 'Gravel', 'Dirt', 'Seasonal Only'], enabled: true },
        { key: 'access_directions', label: 'Access Directions / Notes', type: 'textarea', enabled: true },
        { key: 'gps_entry_point', label: 'GPS Entry Point', type: 'text', placeholder: 'Lat/lon or landmark', enabled: true },
      ],
    },
    {
      key: 'survey', label: 'Survey & Staking',
      fields: [
        { key: 'survey_permission', label: 'Permission to Survey / Stake', type: 'radio', options: ['Granted', 'Conditional', 'Not Granted'], enabled: true },
        { key: 'advance_notice_required', label: 'Advance Notice Required Before Entry?', type: 'toggle', enabled: true },
        { key: 'advance_notice_detail', label: 'How Much Notice?', type: 'text', conditional: 'advance_notice_required', enabled: true },
        { key: 'survey_conditions', label: 'Conditions or Restrictions', type: 'textarea', enabled: true },
      ],
    },
    {
      key: 'provisions', label: 'Special Provisions',
      fields: [
        { key: 'surface_restrictions', label: 'Surface Use Restrictions', type: 'textarea', enabled: true },
        { key: 'crop_livestock', label: 'Crop / Livestock Considerations', type: 'textarea', enabled: true },
        { key: 'sensitive_areas', label: 'Burial Sites, Water Wells, or Sensitive Areas?', type: 'toggle', enabled: true },
        { key: 'sensitive_areas_detail', label: 'Sensitive Area Details', type: 'textarea', conditional: 'sensitive_areas', enabled: true },
        { key: 'other_provisions', label: 'Other Provisions Ops Team Should Know', type: 'textarea', enabled: true },
      ],
    },
    {
      key: 'notes', label: 'Notes',
      fields: [
        { key: 'general_notes', label: 'General Ops Notes', type: 'textarea', enabled: true },
        { key: 'completed_by', label: 'Completed By', type: 'text', enabled: true },
        { key: 'completed_date', label: 'Date Completed', type: 'date_readonly', enabled: true },
      ],
    },
  ],
};

// Same merge logic as LandScout: project.config.ops_form.sections can override
// per-section + per-field { enabled, label, options }.
export function getMergedOpsSchema(project) {
  const schema = JSON.parse(JSON.stringify(DEFAULT_OPS_FORM_SCHEMA));
  const overrides = project && project.config && project.config.ops_form && project.config.ops_form.sections;
  if (overrides && Array.isArray(overrides)) {
    for (const oSection of overrides) {
      const target = schema.sections.find(s => s.key === oSection.key);
      if (!target || !oSection.fields) continue;
      for (const oField of oSection.fields) {
        const tField = target.fields.find(f => f.key === oField.key);
        if (!tField) continue;
        if (Object.prototype.hasOwnProperty.call(oField, 'enabled')) tField.enabled = oField.enabled;
        if (Object.prototype.hasOwnProperty.call(oField, 'label')) tField.label = oField.label;
        if (Object.prototype.hasOwnProperty.call(oField, 'options')) tField.options = oField.options;
      }
    }
  }
  // Filter to enabled fields only, drop empty sections
  schema.sections = schema.sections.map(s => {
    s.fields = s.fields.filter(f => f.enabled !== false);
    return s;
  }).filter(s => s.fields.length > 0);
  return schema;
}

// Collect all known field keys from a schema (for routing unknown ops_info
// keys into an 'Other' bucket on the read-only view).
export function collectSchemaKeys(schema) {
  const out = new Set();
  for (const sec of (schema.sections || [])) {
    for (const f of (sec.fields || [])) out.add(f.key);
  }
  return out;
}
