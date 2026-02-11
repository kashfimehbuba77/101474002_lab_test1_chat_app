const me = JSON.parse(localStorage.getItem("user") || "null");
if (!me) window.location.href = "/view/login.html";

$("#meBadge").text(me.username);

// Connect socket with username (no JWT)
const socket = io({
  auth: { username: me.username }
});

let currentRoom = null;
let pmTarget = null;

function fmtTime(d) {
  const dt = new Date(d);
  return dt.toLocaleString();
}

function escapeHtml(s) {
  return $("<div>").text(s).html();
}

function appendMsg({ from_user, message, date_sent }, isMe) {
  const cls = isMe ? "me" : "other";
  $("#chatBox").append(`
    <div class="msg ${cls}">
      <div class="meta"><b>${escapeHtml(from_user)}</b> • ${fmtTime(date_sent)}</div>
      <div>${escapeHtml(message)}</div>
    </div>
  `);
  $("#chatBox").scrollTop($("#chatBox")[0].scrollHeight);
}

function appendSystem(text) {
  $("#chatBox").append(`<div class="text-muted small mb-2">${escapeHtml(text)}</div>`);
  $("#chatBox").scrollTop($("#chatBox")[0].scrollHeight);
}

async function loadRoomHistory(room) {
  $("#chatBox").empty();
  const res = await fetch(`/api/rooms/${encodeURIComponent(room)}/messages`);
  const data = await res.json();
  if (!data.ok) return appendSystem("Could not load history.");
  data.messages.forEach(m => appendMsg(m, m.from_user === me.username));
}

async function loadPrivateHistory(otherUser) {
  $("#chatBox").empty();
  const res = await fetch(`/api/private/${encodeURIComponent(me.username)}/${encodeURIComponent(otherUser)}/messages`);
  const data = await res.json();
  if (!data.ok) return appendSystem("Could not load private history.");
  data.messages.forEach(m => appendMsg(m, m.from_user === me.username));
}

// rooms list
socket.on("rooms:list", (rooms) => {
  $("#roomSelect").empty();
  rooms.forEach(r => $("#roomSelect").append(`<option value="${escapeHtml(r)}">${escapeHtml(r)}</option>`));
});

// join
$("#btnJoin").on("click", async () => {
  const room = $("#roomSelect").val();

  pmTarget = null;
  $("#pmMode").text("");
  $("#typingHint").text("");

  socket.emit("room:join", { room });
  currentRoom = room;
  $("#currentRoom").text(room);

  await loadRoomHistory(room);
});

// leave
$("#btnLeave").on("click", () => {
  if (!currentRoom) return;
  socket.emit("room:leave", { room: currentRoom });
  appendSystem(`You left ${currentRoom}`);
  currentRoom = null;
  $("#currentRoom").text("None");
  $("#members").empty();
});

// members
socket.on("room:members", ({ room, members }) => {
  if (room !== currentRoom) return;
  $("#members").empty();
  members.forEach(u => {
    const badge = u === me.username ? " (me)" : "";
    $("#members").append(`
      <li class="list-group-item d-flex justify-content-between align-items-center member" data-user="${escapeHtml(u)}">
        <span>${escapeHtml(u)}${badge}</span>
        <span class="badge bg-light text-dark">PM</span>
      </li>
    `);
  });
});

// click member -> PM
$(document).on("click", ".member", async function () {
  const user = $(this).data("user");
  if (!user || user === me.username) return;

  pmTarget = user;
  $("#pmMode").text(`Private chat with: ${pmTarget} (click "Join" to return to room chat)`);
  $("#typingHint").text("");

  await loadPrivateHistory(pmTarget);
});

// send
$("#btnSend").on("click", () => {
  const message = $("#msgInput").val().trim();
  if (!message) return;

  if (pmTarget) {
    socket.emit("pm:message", { to_user: pmTarget, message });
  } else {
    if (!currentRoom) return appendSystem("Join a room first.");
    socket.emit("room:message", { room: currentRoom, message });
  }

  $("#msgInput").val("");
});

// typing indicators
let typingTimer = null;
$("#msgInput").on("input", () => {
  if (typingTimer) clearTimeout(typingTimer);

  if (pmTarget) {
    socket.emit("pm:typing", { to_user: pmTarget, isTyping: true });
    typingTimer = setTimeout(() => socket.emit("pm:typing", { to_user: pmTarget, isTyping: false }), 700);
  } else if (currentRoom) {
    socket.emit("room:typing", { room: currentRoom, isTyping: true });
    typingTimer = setTimeout(() => socket.emit("room:typing", { room: currentRoom, isTyping: false }), 700);
  }
});

socket.on("room:typing", ({ room, username, isTyping }) => {
  if (room !== currentRoom) return;
  if (username === me.username) return;
  $("#typingHint").text(isTyping ? `${username} is typing...` : "");
});

socket.on("pm:typing", ({ from_user, isTyping }) => {
  if (!pmTarget) return;
  if (from_user === pmTarget) {
    $("#typingHint").text(isTyping ? `${from_user} is typing...` : "");
  }
});

// receive room message
socket.on("room:message", (m) => {
  if (m.room !== currentRoom) return;
  appendMsg(m, m.from_user === me.username);
});

// system
socket.on("room:system", ({ room, message }) => {
  if (room !== currentRoom) return;
  appendSystem(message);
});

// receive PM
socket.on("pm:message", (m) => {
  const other = m.from_user === me.username ? m.to_user : m.from_user;
  if (pmTarget && other === pmTarget) {
    appendMsg(m, m.from_user === me.username);
  }
});

// logout
$("#btnLogout").on("click", () => {
  localStorage.removeItem("user");
  window.location.href = "/view/login.html";
});
