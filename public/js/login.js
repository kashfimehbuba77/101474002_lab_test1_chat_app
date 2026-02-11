function showMsg(type, text) {
  const el = $("#msg");
  el.removeClass("d-none alert-success alert-danger")
    .addClass(type === "ok" ? "alert-success" : "alert-danger")
    .text(text);
}

$("#btnLogin").on("click", async () => {
  const payload = {
    username: $("#username").val().trim(),
    password: $("#password").val()
  };

  const res = await fetch("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  const data = await res.json();
  if (!data.ok) return showMsg("err", data.error || "Login failed");

  // “Session” = localStorage
  localStorage.setItem("user", JSON.stringify(data.user));
  window.location.href = "/view/chat.html";
});
