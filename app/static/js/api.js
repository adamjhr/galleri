const API = (() => {
  async function request(method, path, body, isFormData = false) {
    let token = Auth.getToken();
    const headers = { Authorization: `Bearer ${token}` };
    if (!isFormData && body) headers["Content-Type"] = "application/json";

    let res = await fetch(path, {
      method,
      headers,
      body: isFormData ? body : (body ? JSON.stringify(body) : undefined),
      credentials: "include",
    });

    if (res.status === 401) {
      token = await Auth.refreshToken();
      headers["Authorization"] = `Bearer ${token}`;
      res = await fetch(path, {
        method,
        headers,
        body: isFormData ? body : (body ? JSON.stringify(body) : undefined),
        credentials: "include",
      });
    }

    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
  }

  return {
    get: (path) => request("GET", path),
    post: (path, body) => request("POST", path, body),
    postForm: (path, fd) => request("POST", path, fd, true),
    patch: (path, body) => request("PATCH", path, body),
    delete: (path) => request("DELETE", path),
  };
})();
