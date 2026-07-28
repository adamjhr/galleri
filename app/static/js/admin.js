Auth.me()
  .then(me => {
    if (!me.is_admin) location.replace("/");
  })
  .catch(() => location.replace("/"));

document.getElementById("logout-btn").addEventListener("click", () => {
  Auth.logout();
});

// ── Users table ────────────────────────────────────────────────────────────────

async function loadUsers() {
  const rows = await API.get("/api/auth/users");
  const tbody = document.getElementById("users-tbody");
  tbody.innerHTML = "";
  for (const u of rows) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escHtml(u.username)}</td>
      <td>${escHtml(u.email)}</td>
      <td>${u.is_admin ? "Yes" : "No"}</td>
      <td>${u.created_at ? new Date(u.created_at).toLocaleDateString() : "—"}</td>
    `;
    tbody.appendChild(tr);
  }
}

function escHtml(s) {
  return String(s).replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

loadUsers();
