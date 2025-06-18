const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = 3000;

app.use(express.static('public'));
app.use(express.json());

const usersFile = path.join(__dirname, 'users.json');
const brainPath = path.join(__dirname, 'brain', 'responses.txt');
const userBrainsPath = path.join(__dirname, 'brain', 'users');

if (!fs.existsSync(userBrainsPath)) fs.mkdirSync(userBrainsPath);

let defaultBrain = {};

function loadDefaultBrain() {
  defaultBrain = {};
  if (!fs.existsSync(brainPath)) {
    console.warn('⚠️ responses.txt not found');
    return;
  }
  const lines = fs.readFileSync(brainPath, 'utf-8').split('\n');
  lines.forEach(line => {
    const match = line.match(/^"(.+?)"\s+"(.+?)"$/);
    if (match) {
      const q = match[1].trim().toLowerCase();
      const a = match[2].trim();
      defaultBrain[q] = a;
    }
  });
  console.log(`🧠 Default brain loaded with ${Object.keys(defaultBrain).length} entries`);
}

loadDefaultBrain();

fs.watchFile(brainPath, () => {
  console.log('🔄 Reloading brain...');
  loadDefaultBrain();
});

function getUserBrain(username = 'guest') {
  const file = path.join(userBrainsPath, `${username}.json`);
  if (!fs.existsSync(file)) fs.writeFileSync(file, JSON.stringify({}));
  const raw = fs.readFileSync(file, 'utf-8');
  try {
    return JSON.parse(raw);
  } catch {
    console.error(`⚠️ Broken brain file for "${username}". Resetting.`);
    fs.writeFileSync(file, JSON.stringify({}));
    return {};
  }
}

function saveUserBrain(username = 'guest', brain) {
  const file = path.join(userBrainsPath, `${username}.json`);
  fs.writeFileSync(file, JSON.stringify(brain, null, 2));
}

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!fs.existsSync(usersFile)) {
    return res.json({ success: false, error: '❌ No users file found' });
  }
  const users = JSON.parse(fs.readFileSync(usersFile));
  const user = users.find(u => u.username === username && u.password === password);
  res.json({ success: !!user, username: user?.username });
});

app.post('/ask', (req, res) => {
  const { input, username = 'guest' } = req.body;
  console.log(`🗣️ ASK from "${username}": ${input}`);
  const clean = input.trim().toLowerCase();
  const userBrain = getUserBrain(username);
  const response = userBrain[clean] || defaultBrain[clean];

  if (response) {
    console.log('✅ Response:', response);
    return res.json({ response });
  }

  const fallback = `
    👾 Kyle: I don't know this yet.<br>
    Want to teach me?<br><br>
    Type:<br>
    <code>learn: your question | your answer</code><br><br>
    Or <a href="https://www.google.com/search?q=${encodeURIComponent(input)}" target="_blank">🔍 Search Google</a>
  `;
  console.log('❌ Not in brain.');
  res.json({ response: fallback });
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

  console.log(`🧠 ${username} taught: "${question}" => "${answer}"`);
  res.json({ response: "✅ Kyle has learned it!" });
});

app.listen(PORT, () => console.log(`🚀 Kyle running at http://localhost:${PORT}`));
