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
let authMode     = 'login';          // for legacy auth screen
let sheetAuthMode = 'login';         // for bottom sheet
let _currentSession = null;



function isGuest(session) {
  return session?.user?.email === GUEST_EMAIL;
}

async function getHeaders() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return { 'Content-Type': 'application/json' };
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session.access_token}`
  };
}

function switchAuthTab(mode) {
  authMode = mode;
  document.querySelectorAll('#authScreen .auth-tab').forEach((t, i) =>
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

function switchSheetTab(mode) {
  sheetAuthMode = mode;
  document.getElementById('sheetTabLogin').classList.toggle('active', mode === 'login');
  document.getElementById('sheetTabSignup').classList.toggle('active', mode === 'signup');
  document.getElementById('sheetAuthBtn').textContent = mode === 'login' ? 'Login' : 'Sign Up';
  document.getElementById('sheetAuthError').style.display = 'none';
}

async function handleSheetAuth() {
  const email    = document.getElementById('sheetEmail').value.trim();
  const password = document.getElementById('sheetPassword').value;
  const btn      = document.getElementById('sheetAuthBtn');
  const errEl    = document.getElementById('sheetAuthError');

  btn.disabled = true;
  btn.textContent = 'Loading...';
  errEl.style.display = 'none';

  const { error } = sheetAuthMode === 'login'
    ? await sb.auth.signInWithPassword({ email, password })
    : await sb.auth.signUp({ email, password });

  if (error) {
    errEl.textContent = error.message;
    errEl.style.display = 'block';
    btn.disabled = false;
    btn.textContent = sheetAuthMode === 'login' ? 'Login' : 'Sign Up';
  } else {
    closeSheetOnly();
  }
}

async function handleGuestLogin() {
  const btn = document.getElementById('guestBtn');
  btn.textContent = 'Loading...';
  btn.disabled = true;
  await sb.auth.signInWithPassword({ email: GUEST_EMAIL, password: GUEST_PASSWORD });
}

async function handleLogout() {
  await sb.auth.signOut();
}

function openAuthSheet() {
  document.getElementById('sheetOverlay').classList.add('open');
}

function closeAuthSheet(e) {
  if (e && e.target !== document.getElementById('sheetOverlay')) return;
  closeSheetOnly();
}

function closeSheetOnly() {
  document.getElementById('sheetOverlay').classList.remove('open');
}

async function closeSheetAsGuest() {
  closeSheetOnly();
  // If not already signed in as guest, sign in
  const { data: { session } } = await sb.auth.getSession();
  if (!session) {
    await sb.auth.signInWithPassword({ email: GUEST_EMAIL, password: GUEST_PASSWORD });
  }
}



window.addEventListener('DOMContentLoaded', async () => {
  const { data: { session } } = await sb.auth.getSession();

  if (session) {
    showApp(session);
  } else {
    await silentGuestSignIn();
  }

  sb.auth.onAuthStateChange((_event, session) => {
    _currentSession = session;
    if (session) {
      showApp(session);
    } else {
      silentGuestSignIn();
    }
  });
});

async function silentGuestSignIn() {
  const { data, error } = await sb.auth.signInWithPassword({
    email: GUEST_EMAIL,
    password: GUEST_PASSWORD
  });
  if (error) {
    showLegacyAuth();
  }
}

function showLegacyAuth() {
  document.getElementById('authScreen').style.display = 'flex';
  document.getElementById('appScreen').style.display  = 'none';
}

function showApp(session) {
  document.getElementById('authScreen').style.display = 'none';
  const appEl = document.getElementById('appScreen');
  appEl.style.display = 'flex';

  const guest = isGuest(session);

  const banner = document.getElementById('guestBanner');
  if (banner) banner.style.display = guest ? 'block' : 'none';

  const dropZone = document.getElementById('dropZone');
  const guestNotice = document.getElementById('guestUploadNotice');
  const fileInput = document.getElementById('fileInput');

  if (dropZone) {
    if (guest) {
      dropZone.classList.add('guest-disabled');
    } else {
      dropZone.classList.remove('guest-disabled');
    }
  }

  const signupBtn = document.querySelector('.topbar-btn');
  if (signupBtn) signupBtn.style.display = guest ? 'block' : 'none';

  const loginBtn = document.querySelector('.topbar-login-btn');
  if (loginBtn) loginBtn.style.display = guest ? 'inline-flex' : 'none';

  /* Logout button — hide for guests */
  const logoutBtn = document.querySelector('.topbar-logout');
  if (logoutBtn) logoutBtn.style.display = guest ? 'none' : 'inline-flex';

  /* Drop zone — visually disabled for guests */
  if (dropZone) {
    if (guest) {
      dropZone.classList.add('guest-disabled');
    } else {
      dropZone.classList.remove('guest-disabled');
    }
  }

  loadDocuments();
}

async function handleUploadClick() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session || isGuest(session)) {
    openAuthSheet();
    return;
  }
  document.getElementById('fileInput').click();
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
    const pages  = doc.pageCount  ? `${doc.pageCount}p` : '';
    const chunks = doc.chunkCount ? `${doc.chunkCount} chunks` : '';
    const date   = doc.uploadDate
      ? new Date(doc.uploadDate).toLocaleDateString('en-US', { month:'numeric', day:'numeric', year:'2-digit' })
      : '';
    const isSelected = selectedDoc === name;
    return `
      <div class="doc-card ${isSelected ? 'selected' : ''}" onclick="selectDoc('${name}')">
        <div class="doc-top">
          <span class="doc-name" title="${name}">${name}</span>
          <span class="doc-status ${status}">${status.charAt(0).toUpperCase() + status.slice(1)}</span>
        </div>
        <div class="doc-meta">
          <span>${[pages, chunks].filter(Boolean).join(' · ')}</span>
          <span>${date}</span>
        </div>
      </div>`;
  }).join('');
}

function rebuildFilter() {
  const sel     = document.getElementById('docFilter');
  const current = sel.value;
  sel.innerHTML = '<option value="">All documents</option>';
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
  selectedDoc = (selectedDoc === name) ? '' : name; // toggle
  document.getElementById('docFilter').value = selectedDoc;
  updateScopePill();
  renderDocList();
}

function onFilterChange() {
  selectedDoc = document.getElementById('docFilter').value;
  updateScopePill();
  renderDocList();
}

function cycleScopeFilter() {
  const readyDocs = documents.filter(d => d.status === 'ready');
  if (!readyDocs.length) return;
  if (!selectedDoc) {
    selectedDoc = readyDocs[0]?.documentId || readyDocs[0]?.fileName || '';
  } else {
    const idx  = readyDocs.findIndex(d => (d.documentId || d.fileName) === selectedDoc);
    const next = readyDocs[idx + 1];
    selectedDoc = next ? (next.documentId || next.fileName) : '';
  }
  document.getElementById('docFilter').value = selectedDoc;
  updateScopePill();
  renderDocList();
}

function updateScopePill() {
  const pill  = document.getElementById('scopePill');
  const label = document.getElementById('scopeLabel');
  const dot   = pill?.querySelector('.scope-dot');
  const hint = document.getElementById('docSelectHint');
  
  if (!pill || !label) return;
  if (selectedDoc) {
    label.textContent = selectedDoc.length > 18 ? selectedDoc.slice(0, 16) + '…' : selectedDoc;
    if (dot) dot.style.background = 'var(--accent)';
  } else {
    label.textContent = 'All docs';
    if (dot) dot.style.background = 'var(--text-muted)';
  }
}


function setPipelineStep(step) {
  // step: 0 = reset all, 1-5 = light up through that step
  for (let i = 1; i <= 5; i++) {
    const el = document.getElementById('pipeStep' + i);
    if (!el) continue;
    el.classList.remove('lit', 'active');
    if (i < step) el.classList.add('lit');
    else if (i === step) el.classList.add('lit', 'active');
  }
}

function resetPipelineSteps() {
  setPipelineStep(0);
}


function onDragOver(e)  {
  e.preventDefault();
  document.getElementById('dropZone').classList.add('drag');
}
function onDragLeave()  {
  document.getElementById('dropZone').classList.remove('drag');
}
async function onDrop(e) {
  e.preventDefault();
  document.getElementById('dropZone').classList.remove('drag');
  const { data: { session } } = await sb.auth.getSession();
  if (!session || isGuest(session)) { openAuthSheet(); return; }
  const f = Array.from(e.dataTransfer.files).find(f => f.type === 'application/pdf');
  if (f) uploadFile(f);
}

function onFileSelect(e) {
  if (e.target.files[0]) uploadFile(e.target.files[0]);
  e.target.value = '';
}

async function uploadFile(file) {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) { openAuthSheet(); return; }

  if (documents.filter(d => d.status !== 'failed').length >= 15) {
    alert('Maximum 15 documents reached.');
    return;
  }
  if (file.size > 25 * 1024 * 1024) {
    alert('File exceeds 25 MB limit.');
    return;
  }

  const prog  = document.getElementById('uploadProgress');
  const fill  = document.getElementById('upFill');
  const fname = document.getElementById('upFileName');
  prog.classList.add('visible');
  fname.textContent = file.name;
  fill.style.width  = '0%';
  setPipelineStep(1); // Step 1: uploading to S3

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
    fill.style.width = '75%';
    setPipelineStep(2); // Step 2: chunking + embedding (Lambda triggered by S3)

    setTimeout(() => {
      fill.style.width = '100%';
      setPipelineStep(3); // Step 3: Pinecone upsert (optimistic — Lambda is async)
    }, 800);

    setTimeout(() => {
      prog.classList.remove('visible');
      fill.style.width = '0%';
      resetPipelineSteps();
      const docName = file.name.replace('.pdf', '');
      if (!documents.find(d => d.documentId === docName)) {
        documents.unshift({
          documentId: docName,
          fileName: file.name,
          uploadDate: new Date().toISOString(),
          status: 'processing'
        });
        renderDocList();
        rebuildFilter();
      }
      setTimeout(loadDocuments, 5000);
    }, 2000);
  } catch(e) {
    alert('Upload failed: ' + e.message);
    prog.classList.remove('visible');
  }
}


function runDemoQuery() {
  const input = document.getElementById('chatInput');
  input.value = DEMO_QUERY;
  autoResize(input);
  sendQuery();
}

function sendSuggestedQuery(el) {
  const q = el.querySelector('.sug-q')?.textContent?.trim();
  if (!q) return;
  document.getElementById('chatInput').value = q;
  sendQuery();
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

  isQuerying = false;
  document.getElementById('sendBtn').disabled = false;
  input.focus();
  scrollToBottom();
  setTimeout(resetPipelineSteps, 1500);
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

function autoResize(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 120) + 'px';
}

window.switchAuthTab     = switchAuthTab;
window.handleAuth        = handleAuth;
window.handleGuestLogin  = handleGuestLogin;
window.handleLogout      = handleLogout;
window.openAuthSheet     = openAuthSheet;
window.closeAuthSheet    = closeAuthSheet;
window.closeSheetOnly    = closeSheetOnly;
window.closeSheetAsGuest = closeSheetAsGuest;
window.switchSheetTab    = switchSheetTab;
window.handleSheetAuth   = handleSheetAuth;
window.handleUploadClick = handleUploadClick;
window.loadDocuments     = loadDocuments;
window.selectDoc         = selectDoc;
window.onFilterChange    = onFilterChange;
window.cycleScopeFilter  = cycleScopeFilter;
window.onDragOver        = onDragOver;
window.onDragLeave       = onDragLeave;
window.onDrop            = onDrop;
window.onFileSelect      = onFileSelect;
window.runDemoQuery      = runDemoQuery;
window.sendSuggestedQuery= sendSuggestedQuery;
window.onInputKey        = onInputKey;
window.sendQuery         = sendQuery;
window.autoResize        = autoResize;