import { loadDocuments } from "./documents";
import { GUEST_EMAIL, GUEST_PASSWORD, sb } from "./config";
import * as state from "./state";


export async function handleAuth() {
  const email    = document.getElementById('authEmail').value.trim();
  const password = document.getElementById('authPassword').value;
  const btn      = document.getElementById('authSubmitBtn');
  const errEl    = document.getElementById('authError');

  btn.disabled = true;
  btn.textContent = 'Loading...';
  errEl.style.display = 'none';

  const { error } = state.authMode === 'login'
    ? await sb.auth.signInWithPassword({ email, password })
    : await sb.auth.signUp({ email, password });

  if (error) {
    errEl.textContent = error.message;
    errEl.style.display = 'block';
    btn.disabled = false;
    btn.textContent = state.authMode === 'login' ? 'Login' : 'Sign Up';
  }
}

export async function handleSheetAuth() {
  const email    = document.getElementById('sheetEmail').value.trim();
  const password = document.getElementById('sheetPassword').value;
  const btn      = document.getElementById('sheetAuthBtn');
  const errEl    = document.getElementById('sheetAuthError');

  btn.disabled = true;
  btn.textContent = 'Loading...';
  errEl.style.display = 'none';

  const { error } = state.sheetAuthMode === 'login'
    ? await sb.auth.signInWithPassword({ email, password })
    : await sb.auth.signUp({ email, password });

  if (error) {
    errEl.textContent = error.message;
    errEl.style.display = 'block';
    btn.disabled = false;
    btn.textContent = state.sheetAuthMode === 'login' ? 'Login' : 'Sign Up';
  } else {
    closeSheetOnly();
  }
}

export async function handleGuestLogin() {
  const btn = document.getElementById('guestBtn');
  btn.textContent = 'Loading...';
  btn.disabled = true;
  await sb.auth.signInWithPassword({ email: GUEST_EMAIL, password: GUEST_PASSWORD });
}

export async function handleLogout() {
  await sb.auth.signOut();
}

export function switchAuthTab(mode) {
  state.setAuthMode(mode);
  document.querySelectorAll('#authScreen .auth-tab').forEach((t, i) =>
    t.classList.toggle('active', ['login','signup'][i] === mode)
  );
  document.getElementById('authSubmitBtn').textContent = mode === 'login' ? 'Login' : 'Sign Up';
  document.getElementById('authError').style.display = 'none';
}

export function switchSheetTab(mode) {
  state.setSheetAuthMode(mode);
  document.getElementById('sheetTabLogin').classList.toggle('active', mode === 'login');
  document.getElementById('sheetTabSignup').classList.toggle('active', mode === 'signup');
  document.getElementById('sheetAuthBtn').textContent = mode === 'login' ? 'Login' : 'Sign Up';
  document.getElementById('sheetAuthError').style.display = 'none';
}

export function openAuthSheet() {
  document.getElementById('sheetOverlay').classList.add('open');
}

export function closeAuthSheet(e) {
  if (e && e.target !== document.getElementById('sheetOverlay')) return;
  closeSheetOnly();
}

export function closeSheetOnly() {
  document.getElementById('sheetOverlay').classList.remove('open');
}

export async function closeSheetAsGuest() {
  closeSheetOnly();
  // If not already signed in as guest, sign in
  const { data: { session } } = await sb.auth.getSession();
  if (!session) {
    await sb.auth.signInWithPassword({ email: GUEST_EMAIL, password: GUEST_PASSWORD });
  }
}

export function showLegacyAuth() {
  document.getElementById('authScreen').style.display = 'flex';
  document.getElementById('appScreen').style.display  = 'none';
}

export function showApp(session) {
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

export async function getHeaders() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return { 'Content-Type': 'application/json' };
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session.access_token}`
  };
}

export function isGuest(session) {
  return session?.user?.email === GUEST_EMAIL;
}

export async function silentGuestSignIn() {
  const { data, error } = await sb.auth.signInWithPassword({
    email: GUEST_EMAIL,
    password: GUEST_PASSWORD
  });
  if (error) {
    showLegacyAuth();
  }
}