function showMsg(type, text) {
  const el = $("#msg");
  el.removeClass("d-none alert-success alert-danger")
    .addClass(type === "ok" ? "alert-success" : "alert-danger")
    .text(text);
}

$("#btnSignup").on("click", async () => {
  const payload = {
    username: $("#username").val().trim(),
    firstname: $("#firstname").val().trim(),
    lastname: $("#lastname").val().trim(),
    password: $("#password").val()
  };

  const res = await fetch("/api/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  const data = await res.json();
  if (!data.ok) return showMsg("err", data.error || "Signup failed");

  showMsg("ok", "Account created! Redirecting to login...");
  setTimeout(() => (window.location.href = "/view/login.html"), 800);
});

