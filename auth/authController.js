const { findUser, addUser } = require('../models/userModel');

function login(req, res) {
  const { username, password } = req.body;
  const user = findUser(username);
  if (!user || user.password !== password) return res.json({ success: false });
  res.json({ success: true, username });
}

function register(req, res) {
  const { username, password } = req.body;
  const user = findUser(username);
  if (user) return res.json({ success: false, error: 'User exists' });
  addUser({ username, password });
  res.json({ success: true, username });
}

module.exports = { login, register };
