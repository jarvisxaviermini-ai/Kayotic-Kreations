const form = document.querySelector("#login-form");
const statusEl = document.querySelector("#login-status");

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  statusEl.textContent = "Signing in...";

  const password = new FormData(form).get("password");
  const response = await fetch("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });

  if (!response.ok) {
    statusEl.textContent = "Incorrect password";
    return;
  }

  window.location.href = "/admin.html";
});
