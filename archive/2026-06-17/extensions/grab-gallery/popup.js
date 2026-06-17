
const S = (type) => chrome.runtime.sendMessage({ type });
const stats = document.getElementById('stats');

async function refresh() {
  const r = await S('status');
  document.getElementById('rec').textContent = r.recording ? 'Stop recording' : 'Record';
  stats.textContent = 'collected: '+r.collected+' | sessions: '+r.sessions+' | events: '+r.events;
}

document.getElementById('rec').addEventListener('click', async () => {
  const r = await S('status');
  await S(r.recording ? 'stopRecording' : 'startRecording');
  refresh(); setTimeout(() => window.close(), 500);
});

document.getElementById('replay').addEventListener('click', async () => {
  await S('replay');
  stats.textContent = 'replay running...';
  window.close();
});

document.getElementById('dump').addEventListener('click', async () => {
  await S('dump');
  window.close();
});

document.getElementById('clear').addEventListener('click', async () => {
  await S('clear');
  refresh();
});

refresh();
