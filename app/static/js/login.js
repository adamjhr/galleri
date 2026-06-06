if (Auth.isLoggedIn()) location.replace("/");

document.getElementById("login-form").addEventListener("submit", async e => {
  e.preventDefault();
  const err = document.getElementById("login-error");
  err.classList.add("hidden");
  try {
    await Auth.login(
      document.getElementById("username").value,
      document.getElementById("password").value
    );
    location.replace("/");
  } catch (ex) {
    err.textContent = ex.message;
    err.classList.remove("hidden");
  }
});
