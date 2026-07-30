'use strict';

const extensionApi = globalThis.browser ?? globalThis.chrome;
const historyStatus = document.getElementById('historyStatus');

function render(events) {
  const container = document.getElementById('events');
  const empty = document.getElementById('emptyState');
  container.replaceChildren();
  empty.hidden = events.length > 0;

  for (const event of events) {
    const article = document.createElement('article');
    const heading = document.createElement('h2');
    const time = document.createElement('time');
    const details = document.createElement('p');
    const outcome = document.createElement('p');

    heading.textContent = event.hostname;
    time.dateTime = event.timestamp;
    time.textContent = new Date(event.timestamp).toLocaleString();
    details.textContent = Array.isArray(event.reasons)
      ? event.reasons.join('; ')
      : 'Suspicious scareware behavior';
    outcome.className = 'event-outcome';
    outcome.textContent = event.outcome === 'continued-once'
      ? 'Review flag: someone chose the one-time Continue option.'
      : 'Action: blocked';

    article.append(heading, time, details, outcome);
    container.append(article);
  }
}

async function load() {
  const { detectionEvents = [] } = await extensionApi.storage.local.get({ detectionEvents: [] });
  render(detectionEvents);
}

document.getElementById('clearHistory').addEventListener('click', async () => {
  await extensionApi.storage.local.set({
    detectionEvents: [],
    pendingDecisions: [],
    temporaryBypasses: []
  });
  render([]);
  historyStatus.textContent = 'Detection history and pending one-time exceptions were cleared.';
});

load();
