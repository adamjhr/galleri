const params = new URLSearchParams(location.search);
const tokenParam = params.get("token");
if (tokenParam) document.getElementById("invite_token").value = tokenParam;

document.getElementById("register-form").addEventListener("submit", async e => {
  e.preventDefault();
  const err = document.getElementById("reg-error");
  const ok = document.getElementById("reg-success");
  err.classList.add("hidden");
  ok.classList.add("hidden");

  try {
    await Auth.register(
      document.getElementById("invite_token").value,
      document.getElementById("username").value,
      document.getElementById("password").value
    );
    ok.textContent = "Account created! Redirecting to login…";
    ok.classList.remove("hidden");
    setTimeout(() => location.replace("/login.html"), 1500);
  } catch (ex) {
    err.textContent = ex.message;
    err.classList.remove("hidden");
  }
});
