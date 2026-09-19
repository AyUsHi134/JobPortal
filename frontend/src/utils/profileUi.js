/**
 * Builds profile update body
 * @param {{name?: string, email?: string}} current Loaded profile
 * @param {{name: string, email: string}} form Edited values
 * @returns {{name?: string, email?: string}}
 */
export function buildProfileUpdates(current, form) {
  const updates = {};
  if (form.name !== current.name) updates.name = form.name;
  if (form.email !== current.email) updates.email = form.email;
  return updates;
}
