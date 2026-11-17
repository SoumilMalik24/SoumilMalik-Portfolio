/* Admin API client. The session token and the "session ended" handler are set once by Admin.jsx. */
export const BASE = (import.meta.env.VITE_BACKEND_URL || '').replace(/\/+$/, '');

export class ApiError extends Error {
  /** status 0 = network error. `errors` = [{field, msg}] for 422. `data` = full error body. */
  constructor(status, message, data = {}) {
    super(message);
    this.status = status;
    this.errors = data.errors || [];
    this.data = data;
  }
}

let token = '';
let onUnauthorized = () => {};

export function setAuth(nextToken, handler) {
  token = nextToken || '';
  if (handler) onUnauthorized = handler;
}

async function request(method, path, { body, form, signal, auth = true, raw = false } = {}) {
  const headers = {};
  if (auth && token) headers.Authorization = `Bearer ${token}`;
  let payload;
  if (form) payload = form;
  else if (body !== undefined) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }

  let res;
  try {
    res = await fetch(BASE + path, { method, headers, body: payload, signal });
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    throw new ApiError(0, 'Cannot reach the server. It may be starting up; try again in a moment.');
  }
  if (res.status === 204) return null;
  let data = null;
  try { data = await res.json(); } catch { /* empty body */ }
  if (!res.ok) {
    if (res.status === 401 && auth) onUnauthorized();
    throw new ApiError(res.status, (data && data.detail) || res.statusText || 'Request failed', data || {});
  }
  return raw ? { data, res } : data;
}

export const api = {
  get: (path, opts) => request('GET', path, opts),
  post: (path, body, opts) => request('POST', path, { ...opts, body }),
  put: (path, body, opts) => request('PUT', path, { ...opts, body }),
  patch: (path, body, opts) => request('PATCH', path, { ...opts, body }),
  del: (path, opts) => request('DELETE', path, opts),
  upload: (kind, file) => {
    const form = new FormData();
    form.append('kind', kind);
    form.append('file', file);
    return request('POST', '/api/admin/uploads', { form });
  },
};

/* Public / auth calls that must not trigger the "session ended" handler. */
export const health = (signal) => request('GET', '/health', { auth: false, signal });
export const login = (identifier, password) =>
  request('POST', '/api/admin/auth/login', { auth: false, body: { identifier, password } });
export const forgotPassword = (email) =>
  request('POST', '/api/admin/auth/password/forgot', { auth: false, body: { email } });
export const resetPassword = (resetToken, newPassword) =>
  request('POST', '/api/admin/auth/password/reset', { auth: false, body: { token: resetToken, new_password: newPassword } });

/** Human message for an error, including the first field error when present. */
export function errorText(err) {
  if (!(err instanceof ApiError)) return err?.message || 'Something went wrong.';
  if (err.status === 422 && err.errors.length) {
    const e = err.errors[0];
    return e.field ? `${e.field}: ${e.msg}` : e.msg;
  }
  return err.message;
}
