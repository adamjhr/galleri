Auth.requireAdmin();

document.getElementById("logout-btn").addEventListener("click", async () => {
  await Auth.logout();
  location.replace("/login.html");
});

// ── Invite form ────────────────────────────────────────────────────────────────

document.getElementById("invite-form").addEventListener("submit", async e => {
  e.preventDefault();
  const err = document.getElementById("invite-error");
  const result = document.getElementById("invite-result");
  err.classList.add("hidden");
  result.classList.add("hidden");

  try {
    const email = document.getElementById("invite-email").value.trim();
    const data = await API.post("/api/auth/invite", { email });
    const link = `${location.origin}/register.html?token=${encodeURIComponent(data.invite_token)}`;
    document.getElementById("invite-link").value = link;
    result.classList.remove("hidden");
    document.getElementById("invite-form").reset();
    loadUsers();
  } catch (ex) {
    err.textContent = ex.message;
    err.classList.remove("hidden");
  }
});

document.getElementById("invite-copy").addEventListener("click", () => {
  const input = document.getElementById("invite-link");
  input.select();
  navigator.clipboard.writeText(input.value).catch(() => {});
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
      <td>${u.pending ? "Pending" : "Active"}</td>
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
