const Auth = (() => {
  let _me = null;

  async function me() {
    if (_me) return _me;
    const res = await fetch("/api/auth/me", { credentials: "include" });
    if (!res.ok) throw new Error("Not authenticated");
    _me = await res.json();
    return _me;
  }

  async function isAdmin() {
    try {
      return (await me()).is_admin;
    } catch {
      return false;
    }
  }

  function logout() {
    location.href = `https://auth.adamrose.dk/logout?rd=${encodeURIComponent(location.origin)}`;
  }

  return { me, isAdmin, logout };
})();
