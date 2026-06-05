const Auth = (() => {
  const ACCESS_KEY = "galleri_access";

  function getToken() {
    return sessionStorage.getItem(ACCESS_KEY);
  }

  function setToken(t) {
    sessionStorage.setItem(ACCESS_KEY, t);
  }

  function clearToken() {
    sessionStorage.removeItem(ACCESS_KEY);
  }

  function isLoggedIn() {
    return !!getToken();
  }

  function isAdmin() {
    const t = getToken();
    if (!t) return false;
    try {
      const payload = JSON.parse(atob(t.split(".")[1]));
      return !!payload.is_admin;
    } catch {
      return false;
    }
  }

  async function _post(path, body) {
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      credentials: "include",
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Request failed");
    return data;
  }

  async function login(username, password) {
    const data = await _post("/api/auth/login", { username, password });
    setToken(data.access_token);
    return data;
  }

  async function register(invite_token, username, password) {
    return _post("/api/auth/register", { invite_token, username, password });
  }

  async function logout() {
    const token = getToken();
    clearToken();
    if (token) {
      await fetch("/api/auth/logout", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
      }).catch(() => {});
    }
  }

  async function refreshToken() {
    try {
      const res = await fetch("/api/auth/refresh", {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setToken(data.access_token);
      return data.access_token;
    } catch {
      clearToken();
      location.replace("/login.html");
      throw new Error("Session expired");
    }
  }

  function requireAuth() {
    if (!isLoggedIn()) {
      location.replace("/login.html");
    }
  }

  function requireAdmin() {
    requireAuth();
    if (!isAdmin()) location.replace("/");
  }

  return { getToken, setToken, clearToken, isLoggedIn, isAdmin, login, register, logout, refreshToken, requireAuth, requireAdmin };
})();
