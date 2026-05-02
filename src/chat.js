import { getHeaders } from "./auth";
import { setPipelineStep, resetPipelineSteps, autoResize } from "./ui";
import { selectedDoc, isQuerying, chatMessages, setIsQuerying } from "./state";
import { QUERY_URL, DEMO_QUERY } from "./config";

export async function sendQuery() {
  if (isQuerying) return;
  const input = document.getElementById('chatInput');
  const q     = input.value.trim();
  if (!q) return;

  setIsQuerying(true);
  input.value        = '';
  input.style.height = 'auto';
  document.getElementById('sendBtn').disabled = true;
  resetPipelineSteps();

  const empty = document.getElementById('chatEmpty');
  if (empty) empty.remove();

  appendMessage('user', q);

  const statusId = 'status-' + Date.now();
  const statusEl = document.createElement('div');
  statusEl.className = 'status-line';
  statusEl.id        = statusId;
  statusEl.innerHTML = '<div class="status-dot"></div><span>Searching documents...</span>';
  document.getElementById('chatArea').appendChild(statusEl);
  setPipelineStep(4); // Step 4: semantic search
  scrollToBottom();

  const payload = { prompt: q };
  if (selectedDoc) payload.document = selectedDoc;
  const history = chatMessages.slice(-6).map(m => ({ role: m.role, content: m.text }));
  if (history.length) payload.history = history;

  let answerText    = '';
  let sources       = [];
  let answerStarted = false;
  let answerBody    = null;

  try {
    const headers = await getHeaders();
    const res = await fetch(QUERY_URL, {
      method:  'POST',
      headers,
      body:    JSON.stringify(payload)
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const reader  = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer    = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();

      for (const line of lines) {
        const statusMatch = line.match(/<!--STATUS:(.+?)-->/);
        if (statusMatch) {
          const s = document.getElementById(statusId);
          if (s) s.querySelector('span').textContent = statusMatch[1];
          continue;
        }
        const srcMatch = line.match(/<!--SOURCES:(.+?)-->/);
        if (srcMatch) {
          try { sources = JSON.parse(srcMatch[1]); } catch(_) {}
          continue;
        }
        if (line.includes('<!--ANSWER_START-->')) {
          answerStarted = true;
          setPipelineStep(5); // Step 5: streaming answer
          document.getElementById(statusId)?.remove();
          const wrap = document.createElement('div');
          wrap.className = 'msg assistant';
          wrap.innerHTML = `<div class="msg-bubble"><span class="cursor"></span></div>`;
          document.getElementById('chatArea').appendChild(wrap);
          answerBody = wrap.querySelector('.msg-bubble');
          scrollToBottom();
          continue;
        }
        if (answerStarted && answerBody) {
          answerText += line + '\n';
          answerBody.textContent = answerText;
          scrollToBottom();
        }
      }
    }

    if (buffer && answerStarted && answerBody) {
      answerText += buffer;
      answerBody.textContent = answerText.trim();
    }

    if (sources.length && answerBody) {
      const srcRow = document.createElement('div');
      srcRow.className = 'sources-row';
      srcRow.innerHTML = sources.map(s => {
        const score = Math.round(s.score * 100);
        const cls   = score >= 70 ? 'high' : score >= 40 ? 'mid' : 'low';
        return `<span class="src-chip"><span class="src-score ${cls}"></span>${s.document} · ${score}%</span>`;
      }).join('');
      answerBody.appendChild(srcRow);
    }

    chatMessages.push({ role: 'user',      text: q });
    chatMessages.push({ role: 'assistant', text: answerText.trim() });

  } catch(e) {
    document.getElementById(statusId)?.remove();
    appendMessage('assistant', `Error: ${e.message}\n\nCheck your endpoint URLs and CORS settings.`);
  }

  setIsQuerying(false);
  document.getElementById('sendBtn').disabled = false;
  input.focus();
  scrollToBottom();
  setTimeout(resetPipelineSteps, 1500);
}

export function runDemoQuery() {
  const input = document.getElementById('chatInput');
  input.value = DEMO_QUERY;
  autoResize(input);
  sendQuery();
}

export function sendSuggestedQuery(el) {
  const q = el.querySelector('.sug-q')?.textContent?.trim();
  if (!q) return;
  document.getElementById('chatInput').value = q;
  sendQuery();
}

export function onInputKey(e) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendQuery(); }
}


export function appendMessage(role, text) {
  const area = document.getElementById('chatArea');
  const div  = document.createElement('div');
  div.className = 'msg ' + role;
  div.innerHTML = `<div class="msg-bubble">${text}</div>`;
  area.appendChild(div);
  scrollToBottom();
}

export function scrollToBottom() {
  const area = document.getElementById('chatArea');
  area.scrollTop = area.scrollHeight;
}