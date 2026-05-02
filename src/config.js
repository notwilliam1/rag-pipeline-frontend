import { createClient } from '@supabase/supabase-js'

export const BASE_API          = 'https://vrldyxjw1j.execute-api.us-east-1.amazonaws.com/prod';
export const PRESIGN_URL       = `${BASE_API}/presign`;
export const DYNAMO_URL        = `${BASE_API}/documents`;
export const QUERY_URL         = import.meta.env.VITE_QUERY_URL;
export const SUPABASE_URL      = import.meta.env.VITE_SUPABASE_URL;
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const GUEST_EMAIL    = 'guest@demo.com';
export const GUEST_PASSWORD = 'guestdemo123';
export const DEMO_QUERY     = "What are Seneca's views on the shortness of life?";

export const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);