const express = require("express");
const bcrypt = require("bcryptjs");
const User = require("../models/User");

const router = express.Router();

// POST /api/signup
router.post("/signup", async (req, res) => {
  try {
    const { username, firstname, lastname, password } = req.body;

    if (!username || !firstname || !lastname || !password) {
      return res.status(400).json({ ok: false, error: "All fields are required" });
    }

    const hashed = await bcrypt.hash(password, 10);
    await User.create({ username, firstname, lastname, password: hashed });

    return res.json({ ok: true });
  } catch (e) {
    return res.status(400).json({ ok: false, error: e.message || "Signup failed" });
  }
});

// POST /api/login
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ ok: false, error: "Missing credentials" });

    const user = await User.findOne({ username });
    if (!user) return res.status(401).json({ ok: false, error: "Invalid username/password" });

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ ok: false, error: "Invalid username/password" });

    // No token. Just return user profile.
    return res.json({
      ok: true,
      user: { username: user.username, firstname: user.firstname, lastname: user.lastname }
    });
  } catch {
    return res.status(500).json({ ok: false, error: "Login failed" });
  }
});

module.exports = router;
