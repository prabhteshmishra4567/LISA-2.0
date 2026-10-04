const base = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
let clientId = localStorage.getItem('lisa-client-id');
if (!clientId || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(clientId)) {
  clientId = crypto.randomUUID();
  localStorage.setItem('lisa-client-id', clientId);
}

export async function api(path, { body, ...options } = {}) {
  let response;
  try {
    response = await fetch(`${base}/api${path}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', 'X-Lisa-Client-Id': clientId },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new Error('Cannot reach LISA. Check that the backend is running, then reconnect.');
  }
  if (response.status === 204) return null;
  const result = await response.json().catch(() => null);
  if (!response.ok) throw new Error(result?.error || `Request failed (${response.status}).`);
  if (result === null) throw new Error('The server returned an unexpected response.');
  return result;
}
