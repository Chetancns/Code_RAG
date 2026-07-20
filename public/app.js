const indexForm = document.getElementById('indexForm');
const folderPathInput = document.getElementById('folderPath');
const indexStatus = document.getElementById('indexStatus');
const indexResult = document.getElementById('indexResult');

const chatForm = document.getElementById('chatForm');
const questionInput = document.getElementById('question');
const chatStatus = document.getElementById('chatStatus');
const chatResult = document.getElementById('chatResult');
const isHttpPage =
  window.location.protocol === 'http:' || window.location.protocol === 'https:';
const apiBaseUrl = isHttpPage
  ? window.location.origin
  : 'http://localhost:3030';

function setStatus(element, state, text) {
  element.classList.remove('pending', 'ok', 'error');

  if (state) {
    element.classList.add(state);
  }

  element.textContent = text;
}

function showOutput(element, payload) {
  element.textContent =
    typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2);
}

async function postJson(path, body) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  let json;

  try {
    json = await response.json();
  } catch {
    json = null;
  }

  if (!response.ok) {
    const message =
      (json && (json.message || json.error)) ||
      `Request failed with status ${response.status}`;
    throw new Error(Array.isArray(message) ? message.join('; ') : message);
  }

  return json;
}

if (!isHttpPage) {
  const note =
    'This page is opened with file://. API calls are being sent to http://localhost:3030. ' +
    'For the best experience, open the app from http://localhost:3030/ after starting the Nest server.';

  showOutput(indexResult, note);
  showOutput(chatResult, note);
}

indexForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const folderPath = folderPathInput.value.trim();

  if (!folderPath) {
    setStatus(indexStatus, 'error', 'Missing path');
    showOutput(indexResult, 'Please provide a folder path.');
    return;
  }

  setStatus(indexStatus, 'pending', 'Indexing...');
  showOutput(indexResult, 'Starting index request...');

  const submitButton = indexForm.querySelector('button');
  submitButton.disabled = true;

  try {
    const result = await postJson('/index', { folderPath });
    setStatus(indexStatus, 'ok', 'Indexed');
    showOutput(indexResult, result);
  } catch (error) {
    setStatus(indexStatus, 'error', 'Failed');
    showOutput(
      indexResult,
      error instanceof Error ? error.message : String(error),
    );
  } finally {
    submitButton.disabled = false;
  }
});

chatForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const question = questionInput.value.trim();

  if (!question) {
    setStatus(chatStatus, 'error', 'Missing question');
    showOutput(chatResult, 'Please provide a question.');
    return;
  }

  setStatus(chatStatus, 'pending', 'Querying...');
  showOutput(chatResult, 'Asking the RAG API...');

  const submitButton = chatForm.querySelector('button');
  submitButton.disabled = true;

  try {
    const result = await postJson('/chat', { question });
    setStatus(chatStatus, 'ok', 'Answered');
    showOutput(chatResult, result);
  } catch (error) {
    setStatus(chatStatus, 'error', 'Failed');
    showOutput(chatResult, error instanceof Error ? error.message : String(error));
  } finally {
    submitButton.disabled = false;
  }
});
