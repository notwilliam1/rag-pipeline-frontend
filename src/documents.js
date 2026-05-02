import * as state from "./state";
import { getHeaders } from "./auth";
import { DYNAMO_URL } from "./config";

export async function loadDocuments() {
  try {
    const res  = await fetch(DYNAMO_URL, { headers: await getHeaders() });
    const data = await res.json();
    state.setDocuments(Array.isArray(data) ? data : (data.items || data.documents || [])); 
    renderDocList();
    rebuildFilter();
  } catch(e) { console.error(e); }
}

export function renderDocList() {
  const el = document.getElementById('docList');
  if (!state.documents.length) {
    el.innerHTML = '<div class="doc-list-empty">No documents yet.<br>Upload a PDF to get started.</div>';
    return;
  }
  el.innerHTML = state.documents.map(doc => {
    const name   = doc.documentId || doc.fileName || 'Unknown';
    const status = doc.status || 'ready';
    const pages  = doc.pageCount  ? `${doc.pageCount}p` : '';
    const chunks = doc.chunkCount ? `${doc.chunkCount} chunks` : '';
    const date   = doc.uploadDate
      ? new Date(doc.uploadDate).toLocaleDateString('en-US', { month:'numeric', day:'numeric', year:'2-digit' })
      : '';
    const isSelected = state.selectedDoc === name;
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

export function rebuildFilter() {
  const sel     = document.getElementById('docFilter');
  const current = sel.value;
  sel.innerHTML = '<option value="">All documents</option>';
  state.documents.filter(d => d.status === 'ready').forEach(doc => {
    const name = doc.documentId || doc.fileName || '';
    const opt  = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    sel.appendChild(opt);
  });
  sel.value = current;
}

export function selectDoc(name) {
  state.setSelectedDoc(state.selectedDoc === name ? '' : name);
  document.getElementById('docFilter').value = state.selectedDoc;
  updateScopePill();
  renderDocList();
}

export function onFilterChange() {
  state.setSelectedDoc(document.getElementById('docFilter').value);
  updateScopePill();
  renderDocList();
}

export function cycleScopeFilter() {
  const readyDocs = state.documents.filter(d => d.status === 'ready');
  if (!readyDocs.length) return;
  if (!state.selectedDoc) {
    state.setSelectedDoc(readyDocs[0]?.documentId || readyDocs[0]?.fileName || '');
  } else {
    const idx  = readyDocs.findIndex(d => (d.documentId || d.fileName) === state.selectedDoc);
    const next = readyDocs[idx + 1];
    state.setSelectedDoc(next ? (next.documentId || next.fileName) : '');
  }
  document.getElementById('docFilter').value = state.selectedDoc;
  updateScopePill();
  renderDocList();
}

export function updateScopePill() {
  const pill  = document.getElementById('scopePill');
  const label = document.getElementById('scopeLabel');
  const dot   = pill?.querySelector('.scope-dot');
  const hint = document.getElementById('docSelectHint');
  
  if (!pill || !label) return;
  if (state.selectedDoc) {
    label.textContent = state.selectedDoc.length > 18 ? state.selectedDoc.slice(0, 16) + '…' : state.selectedDoc;
    if (dot) dot.style.background = 'var(--accent)';
  } else {
    label.textContent = 'All docs';
    if (dot) dot.style.background = 'var(--text-muted)';
  }
}