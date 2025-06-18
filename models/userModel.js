const fs = require('fs');
const path = require('path');
const usersFile = path.join(__dirname, '..', 'users.json');

function getAllUsers() {
  if (!fs.existsSync(usersFile)) return [];
  return JSON.parse(fs.readFileSync(usersFile, 'utf-8'));
}

function findUser(username) {
  const users = getAllUsers();
  return users.find(u => u.username === username);
}

function addUser(user) {
  const users = getAllUsers();
  users.push(user);
  fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));
}

module.exports = { findUser, addUser };
