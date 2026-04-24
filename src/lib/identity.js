const NAME_KEY = 'deploy_user_name';
const ROLE_KEY = 'deploy_user_role';

export function getName() {
  try { return localStorage.getItem(NAME_KEY) || ''; } catch { return ''; }
}
export function setName(name) {
  try { localStorage.setItem(NAME_KEY, name); } catch {}
}
export function getRole() {
  try { return localStorage.getItem(ROLE_KEY) || ''; } catch { return ''; }
}
export function setRole(role) {
  try { localStorage.setItem(ROLE_KEY, role); } catch {}
}
