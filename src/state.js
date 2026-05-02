export let documents    = [];
export let chatMessages = [];
export let selectedDoc  = '';
export let isQuerying   = false;
export let authMode     = 'login';          // for legacy auth screen
export let sheetAuthMode = 'login';         // for bottom sheet
export let _currentSession = null;

export const setDocuments      = (val) => { documents       = val; };
export const setSelectedDoc    = (val) => { selectedDoc     = val; };
export const setIsQuerying     = (val) => { isQuerying      = val; };
export const setAuthMode       = (val) => { authMode        = val; };
export const setSheetAuthMode  = (val) => { sheetAuthMode   = val; };
export const setCurrentSession = (val) => { _currentSession = val; };