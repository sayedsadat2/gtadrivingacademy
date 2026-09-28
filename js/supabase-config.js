// Public browser credentials only. Never place the Supabase service_role/secret key here.
const GTA_SUPABASE_URL = 'https://xfjxiujileseimjhdimj.supabase.co';
const GTA_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_aE9I6hIQhE0nNzAWw5w0lA_liE88SqG';

window.gtaSupabase = supabase.createClient(
  GTA_SUPABASE_URL,
  GTA_SUPABASE_PUBLISHABLE_KEY
);
