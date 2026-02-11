require("dotenv").config();

const path = require("path");
const http = require("http");
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");

const authRoutes = require("./routes/auth");
const User = require("./models/User");
const GroupMessage = require("./models/GroupMessage");
const PrivateMessage = require("./models/PrivateMessage");

const app = express();
const server = http.createServer(app);
const { Server } = require("socket.io");

const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

const ROOMS = ["kpop", "percy jackson", "harry potter", "agatha christie", "programming", "news"];

app.use(cors());
app.use(express.json());
app.use("/public", express.static(path.join(__dirname, "public")));
app.use("/view", express.static(path.join(__dirname, "view")));

app.get("/", (req, res) => res.redirect("/view/login.html"));
app.use("/api", authRoutes);

// REST: room message history (no auth)
app.get("/api/rooms/:room/messages", async (req, res) => {
  try {
    const room = req.params.room;
    const messages = await GroupMessage.find({ room }).sort({ date_sent: 1 }).limit(200);
    return res.json({ ok: true, messages });
  } catch {
    return res.status(500).json({ ok: false, error: "Failed to fetch messages" });
  }
});

// REST: private chat history (no auth)
app.get("/api/private/:a/:b/messages", async (req, res) => {
  try {
    const a = req.params.a;
    const b = req.params.b;

    const messages = await PrivateMessage.find({
      $or: [
        { from_user: a, to_user: b },
        { from_user: b, to_user: a }
      ]
    })
      .sort({ date_sent: 1 })
      .limit(200);

    return res.json({ ok: true, messages });
  } catch {
    return res.status(500).json({ ok: false, error: "Failed to fetch messages" });
  }
});

// ---- Socket tracking ----
const roomMembers = new Map(); // room -> Set(usernames)
const userSockets = new Map(); // username -> Set(socket.id)

function addUserSocket(username, socketId) {
  if (!userSockets.has(username)) userSockets.set(username, new Set());
  userSockets.get(username).add(socketId);
}
function removeUserSocket(username, socketId) {
  const set = userSockets.get(username);
  if (!set) return;
  set.delete(socketId);
  if (set.size === 0) userSockets.delete(username);
}
function emitToUser(username, event, payload) {
  const set = userSockets.get(username);
  if (!set) return;
  for (const sid of set) io.to(sid).emit(event, payload);
}

function addMember(room, username) {
  if (!roomMembers.has(room)) roomMembers.set(room, new Set());
  roomMembers.get(room).add(username);
}
function removeMember(room, username) {
  const set = roomMembers.get(room);
  if (!set) return;
  set.delete(username);
  if (set.size === 0) roomMembers.delete(room);
}
function getMembers(room) {
  return Array.from(roomMembers.get(room) || []);
}

io.on("connection", async (socket) => {
  // Client must provide username from localStorage
  const username = socket.handshake.auth?.username;

  if (!username) {
    socket.disconnect(true);
    return;
  }

  // Optional sanity check: user exists in DB
  const exists = await User.findOne({ username }).select("_id").lean();
  if (!exists) {
    socket.disconnect(true);
    return;
  }

  socket.username = username;
  addUserSocket(username, socket.id);

  socket.emit("rooms:list", ROOMS);

  socket.on("room:join", ({ room }) => {
    if (!room || !ROOMS.includes(room)) return;

    // Ensure only one active room per socket: leave any existing
    for (const r of socket.rooms) {
      if (r !== socket.id) {
        socket.leave(r);
        removeMember(r, username);
        io.to(r).emit("room:members", { room: r, members: getMembers(r) });
        io.to(r).emit("room:system", { room: r, message: `${username} left the room.` });
      }
    }

    socket.join(room);
    addMember(room, username);

    io.to(room).emit("room:system", { room, message: `${username} joined the room.` });
    io.to(room).emit("room:members", { room, members: getMembers(room) });
  });

  socket.on("room:leave", ({ room }) => {
    if (!room) return;
    socket.leave(room);
    removeMember(room, username);
    io.to(room).emit("room:members", { room, members: getMembers(room) });
    io.to(room).emit("room:system", { room, message: `${username} left the room.` });
  });

  socket.on("room:message", async ({ room, message }) => {
    if (!room || !message) return;

    const doc = await GroupMessage.create({
      from_user: username,
      room,
      message: String(message).trim()
    });

    io.to(room).emit("room:message", {
      _id: doc._id,
      from_user: doc.from_user,
      room: doc.room,
      message: doc.message,
      date_sent: doc.date_sent
    });
  });

  // Typing indicator in room (nice to have)
  socket.on("room:typing", ({ room, isTyping }) => {
    if (!room) return;
    socket.to(room).emit("room:typing", { room, username, isTyping: !!isTyping });
  });

  // Private messages: store + emit only to sender and receiver
  socket.on("pm:message", async ({ to_user, message }) => {
    if (!to_user || !message) return;

    const doc = await PrivateMessage.create({
      from_user: username,
      to_user,
      message: String(message).trim()
    });

    const payload = {
      _id: doc._id,
      from_user: doc.from_user,
      to_user: doc.to_user,
      message: doc.message,
      date_sent: doc.date_sent
    };

    emitToUser(username, "pm:message", payload);
    emitToUser(to_user, "pm:message", payload);
  });

  // Typing indicator (required for 1-to-1)
  socket.on("pm:typing", ({ to_user, isTyping }) => {
    if (!to_user) return;
    emitToUser(to_user, "pm:typing", { from_user: username, to_user, isTyping: !!isTyping });
  });

  socket.on("disconnect", () => {
    // remove from rooms
    for (const r of socket.rooms) {
      if (r !== socket.id) {
        removeMember(r, username);
        io.to(r).emit("room:members", { room: r, members: getMembers(r) });
      }
    }
    removeUserSocket(username, socket.id);
  });
});

(async function start() {

const MONGO_URI = "mongodb+srv://admin:password123%21@cluster0.tqloabq.mongodb.net/LabTest1?retryWrites=true&w=majority&appName=Cluster";


  await mongoose.connect(MONGO_URI);
  console.log("MongoDB connected");

  const port = process.env.PORT || 3000;
  server.listen(port, () => console.log(`Server running on http://localhost:${port}`));
})();
