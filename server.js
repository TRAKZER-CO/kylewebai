const express = require('express');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const app = express();
const PORT = 3000;

const JWT_SECRET = '8f4910221fd7c2a2ebf8ef974536bc30428a8d888178baff9278df523d9de1a5';

app.use(express.static('public'));
app.use(express.json());

const usersFile = path.join(__dirname, 'users.json');
const brainPath = path.join(__dirname, 'brain', 'responses.txt');
const userBrainsPath = path.join(__dirname, 'brain', 'users');
const userHistoryPath = path.join(__dirname, 'brain', 'history');

if (!fs.existsSync(userBrainsPath)) fs.mkdirSync(userBrainsPath, { recursive: true });
if (!fs.existsSync(userHistoryPath)) fs.mkdirSync(userHistoryPath, { recursive: true });

let defaultBrain = {};

function loadDefaultBrain() {
  defaultBrain = {};
  if (!fs.existsSync(brainPath)) return;
  const lines = fs.readFileSync(brainPath, 'utf-8').split('\n');
  lines.forEach(line => {
    const match = line.match(/^"(.+?)"\s+"(.+?)"$/);
    if (match) defaultBrain[match[1].trim().toLowerCase()] = match[2].trim();
  });
  console.log(`🧠 Loaded ${Object.keys(defaultBrain).length} brain entries`);
}

loadDefaultBrain();
fs.watchFile(brainPath, () => {
  console.log('🔁 Brain updated');
  loadDefaultBrain();
});

function getUserBrain(username = 'guest') {
  const file = path.join(userBrainsPath, `${username}.json`);
  if (!fs.existsSync(file)) fs.writeFileSync(file, JSON.stringify({}));
  return JSON.parse(fs.readFileSync(file));
}

function saveUserBrain(username = 'guest', brain) {
  const file = path.join(userBrainsPath, `${username}.json`);
  fs.writeFileSync(file, JSON.stringify(brain, null, 2));
}

function saveChatHistory(username, userMsg, botMsg) {
  const file = path.join(userHistoryPath, `${username}.json`);
  const history = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file)) : [];
  history.push({ you: userMsg, kyle: botMsg, time: new Date().toISOString() });
  fs.writeFileSync(file, JSON.stringify(history, null, 2));
}

function authenticate(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    res.status(403).json({ error: 'Forbidden' });
  }
}

app.post('/register', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.json({ success: false, error: 'Missing fields' });

  let users = fs.existsSync(usersFile) ? JSON.parse(fs.readFileSync(usersFile)) : [];
  if (users.find(u => u.username === username)) {
    return res.json({ success: false, error: 'Username already exists' });
  }

  const role = username === 'admin' ? 'admin' : 'user';
  users.push({ username, password, role });
  fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));
  const token = jwt.sign({ username, role }, JWT_SECRET);
  res.json({ success: true, token, username });
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!fs.existsSync(usersFile)) return res.json({ success: false, error: 'No users found' });

  const users = JSON.parse(fs.readFileSync(usersFile));
  const user = users.find(u => u.username === username && u.password === password);
  if (!user) return res.json({ success: false, error: 'Invalid credentials' });

  const token = jwt.sign({ username: user.username, role: user.role }, JWT_SECRET);
  res.json({ success: true, token, username: user.username });
});

app.post('/ask', (req, res) => {
  const { input, username = 'guest' } = req.body;
  const clean = input.trim().toLowerCase();
  const userBrain = getUserBrain(username);
  const response = userBrain[clean] || defaultBrain[clean];

  const finalResponse = response || `
    👾 Kyle: I don't know this yet.<br>
    Want to teach me?<br><br>
    Type:<br>
    <code>learn: your question | your answer</code><br><br>
    Or <a href="https://www.google.com/search?q=${encodeURIComponent(input)}" target="_blank">🔍 Search Google</a>
  `;

  saveChatHistory(username, input, finalResponse);
  res.json({ response: finalResponse });
});

app.post('/learn', (req, res) => {
  const { input, username = 'guest' } = req.body;
  if (!input.startsWith('learn:')) return res.json({ response: "⚠️ Use: learn: question | answer" });

  const parts = input.replace('learn:', '').split('|');
  if (parts.length < 2) return res.json({ response: "⚠️ Missing | separator" });

  const question = parts[0].trim().toLowerCase();
  const answer = parts[1].trim();
  const userBrain = getUserBrain(username);
  userBrain[question] = answer;
  saveUserBrain(username, userBrain);

  res.json({ response: "✅ Kyle has learned it!" });
});

app.post('/history', authenticate, (req, res) => {
  const username = req.user.username;
  const file = path.join(userHistoryPath, `${username}.json`);
  if (!fs.existsSync(file)) return res.json({ history: [] });

  const history = JSON.parse(fs.readFileSync(file));
  res.json({ history });
});

app.post('/update-password', authenticate, (req, res) => {
  const { password } = req.body;
  if (!password) return res.json({ success: false, error: 'Password required' });

  const users = fs.existsSync(usersFile) ? JSON.parse(fs.readFileSync(usersFile)) : [];
  const idx = users.findIndex(u => u.username === req.user.username);
  if (idx === -1) return res.json({ success: false, error: 'User not found' });

  users[idx].password = password;
  fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));
  res.json({ success: true });
});

app.get('/admin/users', authenticate, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admins only' });
  const users = fs.existsSync(usersFile) ? JSON.parse(fs.readFileSync(usersFile)) : [];
  res.json({ users });
});

app.listen(PORT, () => console.log(`🚀 Kyle running at http://localhost:${PORT}`));
