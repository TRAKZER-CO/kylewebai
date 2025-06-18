const form = document.getElementById('chatForm');
const input = document.getElementById('input');
const messages = document.getElementById('messages');

form.addEventListener('submit', async e => {
  e.preventDefault();
  const text = input.value;
  if (!text) return;

  appendMsg('You', text);
  input.value = '';

  const res = await fetch('/ask', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ input: text, username: localStorage.getItem('user') || 'guest' })
  });

  const data = await res.json();
  appendMsg('Kyle', data.response);
});

function appendMsg(sender, msg) {
  const div = document.createElement('div');
  div.innerHTML = `<strong>${sender}:</strong> ${msg}`;
  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
}
