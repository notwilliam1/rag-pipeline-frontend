import { getHeaders, isGuest, openAuthSheet } from "./auth";
import { setPipelineStep, resetPipelineSteps } from "./ui";
import { sb, PRESIGN_URL } from "./config";
import { documents } from "./state";
import { renderDocList, rebuildFilter, loadDocuments } from "./documents";


export async function uploadFile(file) {
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

export async function handleUploadClick() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session || isGuest(session)) {
    openAuthSheet();
    return;
  }
  document.getElementById('fileInput').click();
}

export function onDragOver(e)  {
  e.preventDefault();
  document.getElementById('dropZone').classList.add('drag');
}
export function onDragLeave()  {
  document.getElementById('dropZone').classList.remove('drag');
}
export async function onDrop(e) {
  e.preventDefault();
  document.getElementById('dropZone').classList.remove('drag');
  const { data: { session } } = await sb.auth.getSession();
  if (!session || isGuest(session)) { openAuthSheet(); return; }
  const f = Array.from(e.dataTransfer.files).find(f => f.type === 'application/pdf');
  if (f) uploadFile(f);
}

export function onFileSelect(e) {
  if (e.target.files[0]) uploadFile(e.target.files[0]);
  e.target.value = '';
}