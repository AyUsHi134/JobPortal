/**
 * Builds the PUT /api/user/profile body from a profile-edit form,
 * including only fields that actually changed (`updateProfile()`'s body
 * is sent as-is — BACKEND_API_CONTRACT.md §7 only ever applies `name`/
 * `email`, so there's no reason to resend an unchanged value). Kept
 * pure/framework-free so this decision is directly unit-testable without
 * any React rendering — see src/tests/testProfilePage.js.
 *
 * @param {{name?: string, email?: string}} current - the loaded profile
 * @param {{name: string, email: string}} form - the edited form values
 * @returns {{name?: string, email?: string}}
 */
export function buildProfileUpdates(current, form) {
  const updates = {};
  if (form.name !== current.name) updates.name = form.name;
  if (form.email !== current.email) updates.email = form.email;
  return updates;
}
