import './styles.css';
import { sb } from './config.js';
import * as state from './state.js';
import * as auth from './auth.js';
import * as docs from './documents.js';
import * as chat from './chat.js';
import * as upload from './upload.js';
import * as ui from './ui.js';

window.handleAuth        = auth.handleAuth;
window.handleGuestLogin  = auth.handleGuestLogin;
window.handleLogout      = auth.handleLogout;
window.switchAuthTab     = auth.switchAuthTab;
window.openAuthSheet     = auth.openAuthSheet;
window.closeAuthSheet    = auth.closeAuthSheet;
window.closeSheetOnly    = auth.closeSheetOnly;
window.closeSheetAsGuest = auth.closeSheetAsGuest;
window.switchSheetTab    = auth.switchSheetTab;
window.handleSheetAuth   = auth.handleSheetAuth;

window.loadDocuments     = docs.loadDocuments;
window.selectDoc         = docs.selectDoc;
window.onFilterChange    = docs.onFilterChange;
window.cycleScopeFilter  = docs.cycleScopeFilter;

window.sendQuery         = chat.sendQuery;
window.runDemoQuery      = chat.runDemoQuery;
window.sendSuggestedQuery= chat.sendSuggestedQuery;
window.onInputKey        = chat.onInputKey;

window.handleUploadClick = upload.handleUploadClick;
window.onDragOver        = upload.onDragOver;
window.onDragLeave       = upload.onDragLeave;
window.onDrop            = upload.onDrop;
window.onFileSelect      = upload.onFileSelect;

window.autoResize        = ui.autoResize;


window.addEventListener('DOMContentLoaded', async () => {
  const { data: { session } } = await sb.auth.getSession();
  if (session) {
    auth.showApp(session);
  } else {
    await auth.silentGuestSignIn();
  }

  sb.auth.onAuthStateChange((_event, session) => {
    state.setCurrentSession(session);
    if (session) auth.showApp(session);
    else auth.silentGuestSignIn();
  });
});