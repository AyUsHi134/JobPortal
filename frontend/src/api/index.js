export async function api(path, options = {}) {
  const token = localStorage.getItem('token');
  const res = await fetch(path, {
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` })
    },
    ...options
  });
  return res.json();
}