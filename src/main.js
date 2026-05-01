import { createClient } from '@supabase/supabase-js'
import './styles.css'

const BASE_API          = 'https://vrldyxjw1j.execute-api.us-east-1.amazonaws.com/prod';
const PRESIGN_URL       = `${BASE_API}/presign`;
const DYNAMO_URL        = `${BASE_API}/documents`;
const QUERY_URL         = import.meta.env.VITE_QUERY_URL;
const SUPABASE_URL      = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

const GUEST_EMAIL    = 'guest@demo.com';
const GUEST_PASSWORD = 'guestdemo123';


const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let documents    = [];
let chatMessages = [];
let selectedDoc  = '';
let isQuerying   = false;
let authMode     = 'login';

async function handleGuestLogin() {
  const btn = document.getElementById('guestBtn');
  btn.textContent = 'Loading...';
  btn.disabled = true;
  await sb.auth.signInWithPassword({ email: GUEST_EMAIL, password: GUEST_PASSWORD });
}

function isGuest(session) {
  return session?.user?.email === GUEST_EMAIL;
}

async function getHeaders() {
  const { data: { session } } = await sb.auth.getSession();

  if (!session) {
    console.error("No session found — user not authenticated yet");
    return {
      'Content-Type': 'application/json'
    };
  }

  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session.access_token}`
  };
}

function switchAuthTab(mode) {
  authMode = mode;
  document.querySelectorAll('.auth-tab').forEach((t, i) =>
    t.classList.toggle('active', ['login','signup'][i] === mode)
  );
  document.getElementById('authSubmitBtn').textContent = mode === 'login' ? 'Login' : 'Sign Up';
  document.getElementById('authError').style.display = 'none';
}

async function handleAuth() {
  const email    = document.getElementById('authEmail').value.trim();
  const password = document.getElementById('authPassword').value;
  const btn      = document.getElementById('authSubmitBtn');
  const errEl    = document.getElementById('authError');

  btn.disabled = true;
  btn.textContent = 'Loading...';
  errEl.style.display = 'none';

  const { error } = authMode === 'login'
    ? await sb.auth.signInWithPassword({ email, password })
    : await sb.auth.signUp({ email, password });

  if (error) {
    errEl.textContent = error.message;
    errEl.style.display = 'block';
    btn.disabled = false;
    btn.textContent = authMode === 'login' ? 'Login' : 'Sign Up';
  }
}

async function handleLogout() {
  await sb.auth.signOut();
}

function showApp(session) {
  document.getElementById('authScreen').style.display = 'none';
  document.getElementById('appScreen').style.display  = 'flex';

  if (isGuest(session)) {
    document.getElementById('guestBanner').style.display = 'block';
    document.getElementById('dropZone').style.display    = 'none';
    document.getElementById('fileInput').style.display   = 'none';
  }

  loadDocuments();
}

function showAuth() {
  document.getElementById('authScreen').style.display = 'flex';
  document.getElementById('appScreen').style.display  = 'none';
  documents    = [];
  chatMessages = [];
}

window.addEventListener('DOMContentLoaded', async () => {
  const { data: { session } } = await sb.auth.getSession();

  if (session) {
    showApp(session);
  } else {
    showAuth();
  }

  sb.auth.onAuthStateChange((_event, session) => {
    if (session) {
      showApp(session);
    } else {
      showAuth();
    }
  });
});

function autoResize(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 120) + 'px';
}

async function loadDocuments() {
  try {
    const res  = await fetch(DYNAMO_URL, { headers: await getHeaders() });
    const data = await res.json();
    documents  = Array.isArray(data) ? data : (data.items || data.documents || []);
    renderDocList();
    rebuildFilter();
  } catch(e) {
    console.error('Failed to load documents:', e);
  }
}

function renderDocList() {
  const el = document.getElementById('docList');
  if (!documents.length) {
    el.innerHTML = '<div class="doc-list-empty">No documents yet.<br>Upload a PDF to get started.</div>';
    return;
  }
  el.innerHTML = documents.map(doc => {
    const name   = doc.documentId || doc.fileName || 'Unknown';
    const status = doc.status || 'ready';
    const pages  = doc.pageCount  ? `${doc.pageCount} pages`  : '—';
    const chunks = doc.chunkCount ? `${doc.chunkCount} chunks` : '';
    const date   = doc.uploadDate
      ? new Date(doc.uploadDate).toLocaleDateString('en-US', { month:'numeric', day:'numeric', year:'numeric', hour:'2-digit', minute:'2-digit' })
      : '';
    const isSelected = selectedDoc === name;
    return `
      <div class="doc-card ${isSelected ? 'selected' : ''}" onclick="selectDoc('${name}')">
        <div class="doc-top">
          <span class="doc-name" title="${name}">${name}</span>
          <span class="doc-status ${status}">${status.charAt(0).toUpperCase() + status.slice(1)}</span>
        </div>
        <div class="doc-meta">
          <span>${pages}${chunks ? ' • ' + chunks : ''}</span>
          <span>${date}</span>
        </div>
      </div>`;
  }).join('');
}

function rebuildFilter() {
  const sel     = document.getElementById('docFilter');
  const current = sel.value;
  sel.innerHTML = '<option value="">All Documents</option>';
  documents.filter(d => d.status === 'ready').forEach(doc => {
    const name = doc.documentId || doc.fileName || '';
    const opt  = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    sel.appendChild(opt);
  });
  sel.value = current;
}

function selectDoc(name) {
  selectedDoc = name;
  document.getElementById('docFilter').value = name;
  renderDocList();
}

function onFilterChange() {
  selectedDoc = document.getElementById('docFilter').value;
  renderDocList();
}

function onDragOver(e)  { e.preventDefault(); document.getElementById('dropZone').classList.add('drag'); }
function onDragLeave(e) { document.getElementById('dropZone').classList.remove('drag'); }

function onDrop(e) {
  e.preventDefault();
  document.getElementById('dropZone').classList.remove('drag');
  const f = Array.from(e.dataTransfer.files).find(f => f.type === 'application/pdf');
  if (f) uploadFile(f);
}

function onFileSelect(e) {
  if (e.target.files[0]) uploadFile(e.target.files[0]);
  e.target.value = '';
}

async function uploadFile(file) {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) {
    alert("You must be logged in.");
    return;
  }

  if (documents.filter(d => d.status !== 'failed').length >= 15) {
    alert('Maximum 15 documents reached.');
    return;
  }
  if (file.size > 25 * 1024 * 1024) {
    alert('File exceeds 25MB limit.');
    return;
  }

  const prog  = document.getElementById('uploadProgress');
  const fill  = document.getElementById('upFill');
  const fname = document.getElementById('upFileName');
  prog.classList.add('visible');
  fname.textContent = file.name;
  fill.style.width  = '0%';

  try {
    const presignRes = await fetch(PRESIGN_URL, {
      method:  'POST',
      headers: await getHeaders(),
      body:    JSON.stringify({ fileName: file.name, contentType: 'application/pdf' })
    });
    if (!presignRes.ok) {
      const err = await presignRes.json();
      throw new Error(err.error || 'Presign failed');
    }
    const { uploadUrl } = await presignRes.json();

    fill.style.width = '40%';

    await fetch(uploadUrl, { method: 'PUT', body: file });

    fill.style.width = '100%';
    setTimeout(() => {
      prog.classList.remove('visible');
      fill.style.width = '0%';
      const docName = file.name.replace('.pdf', '');
      if (!documents.find(d => d.documentId === docName)) {
        documents.unshift({ documentId: docName, fileName: file.name, uploadDate: new Date().toISOString(), status: 'processing' });
        renderDocList();
        rebuildFilter();
      }
      setTimeout(loadDocuments, 5000);
    }, 800);
  } catch(e) {
    alert('Upload failed: ' + e.message);
    prog.classList.remove('visible');
  }
}

function onInputKey(e) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendQuery(); }
}

async function sendQuery() {
  if (isQuerying) return;
  const input = document.getElementById('chatInput');
  const q     = input.value.trim();
  if (!q) return;

  isQuerying = true;
  input.value        = '';
  input.style.height = 'auto';
  document.getElementById('sendBtn').disabled = true;

  document.getElementById('chatEmpty')?.remove();
  appendMessage('user', q);

  const statusId = 'status-' + Date.now();
  const statusEl = document.createElement('div');
  statusEl.className = 'status-line';
  statusEl.id        = statusId;
  statusEl.innerHTML = '<div class="status-dot"></div><span>Searching documents...</span>';
  document.getElementById('chatArea').appendChild(statusEl);
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

  isQuerying = false;
  document.getElementById('sendBtn').disabled = false;
  input.focus();
  scrollToBottom();
}

function appendMessage(role, text) {
  const area = document.getElementById('chatArea');
  const div  = document.createElement('div');
  div.className = 'msg ' + role;
  div.innerHTML = `<div class="msg-bubble">${text}</div>`;
  area.appendChild(div);
  scrollToBottom();
}

function scrollToBottom() {
  const area = document.getElementById('chatArea');
  area.scrollTop = area.scrollHeight;
}

window.switchAuthTab = switchAuthTab;
window.handleAuth    = handleAuth;
window.handleLogout  = handleLogout;
window.loadDocuments = loadDocuments;
window.selectDoc     = selectDoc;
window.onFilterChange = onFilterChange;
window.onDragOver    = onDragOver;
window.onDragLeave   = onDragLeave;
window.onDrop        = onDrop;
window.onFileSelect  = onFileSelect;
window.onInputKey    = onInputKey;
window.sendQuery     = sendQuery;
window.autoResize    = autoResize;