const express = require('express');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const app = express();
const PORT = 3000;

const JWT_SECRET = 'your-secret-key';

app.use(express.static('public'));
app.use(express.json());

const usersFile = path.join(__dirname, 'users.json');
const brainPath = path.join(__dirname, 'brain', 'responses.txt');
const userHistoryPath = path.join(__dirname, 'brain', 'history');

if (!fs.existsSync(userHistoryPath)) fs.mkdirSync(userHistoryPath, { recursive: true });

let defaultBrain = {};

function loadDefaultBrain() {
  defaultBrain = {};
  if (!fs.existsSync(brainPath)) return;

  const raw = fs.readFileSync(brainPath, 'utf-8');
  const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);

  lines.forEach(line => {
    const match = line.match(/^"(.+?)"\s+"(.+?)"$/);
    if (match) {
      const q = match[1].trim().toLowerCase();
      const a = match[2].trim();
      defaultBrain[q] = a;
    }
  });
}

loadDefaultBrain();
fs.watchFile(brainPath, () => {
  console.log('🔁 Brain updated...');
  loadDefaultBrain();
});

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

function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access only' });
  next();
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

app.post('/logout', (req, res) => {
  res.json({ success: true, message: 'Logged out' });
});

app.post('/ask', (req, res) => {
  const { input, username = 'guest' } = req.body;
  const clean = input.trim().toLowerCase();

  let rawResponse = defaultBrain[clean] || `👾 Kyle: I don't know that yet, but I'm still learning!`;
  const capitalizedUser = username.charAt(0).toUpperCase() + username.slice(1);
  const finalResponse = rawResponse.replace(/{{username}}/gi, capitalizedUser);
  const timestamp = new Date().toLocaleTimeString();

  saveChatHistory(username, input, finalResponse);

  res.json({
    response: finalResponse,
    time: timestamp,
    avatar: '/img/kyle.png' // Add image in public/img/
  });
});

app.post('/history', authenticate, (req, res) => {
  const username = req.user.username;
  const file = path.join(userHistoryPath, `${username}.json`);
  const history = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file)) : [];
  res.json({ history });
});

// 💡 ADMIN ONLY: GET/ADD/DELETE brain entries
app.get('/admin/brain', authenticate, requireAdmin, (req, res) => {
  res.json({ brain: defaultBrain });
});

app.post('/admin/brain', authenticate, requireAdmin, (req, res) => {
  const { question, answer } = req.body;
  if (!question || !answer) return res.status(400).json({ error: 'Missing fields' });

  const newLine = `"${question}" "${answer}"\n`;
  fs.appendFileSync(brainPath, newLine);
  loadDefaultBrain();
  res.json({ success: true });
});

app.delete('/admin/brain', authenticate, requireAdmin, (req, res) => {
  const { question } = req.body;
  if (!question) return res.status(400).json({ error: 'Question required' });

  const raw = fs.readFileSync(brainPath, 'utf-8');
  const lines = raw.split('\n').filter(line => !line.startsWith(`"${question}"`));
  fs.writeFileSync(brainPath, lines.join('\n').trim());
  loadDefaultBrain();
  res.json({ success: true });
});

app.listen(PORT, () => console.log(`🚀 Kyle is live at http://localhost:${PORT}`));
