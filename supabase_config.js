/* ============================
   GLOBAL SUPABASE CLIENT
============================ */

// ✅ Put them on window so ALL pages can use window.SUPABASE_URL / window.SUPABASE_ANON_KEY
window.SUPABASE_URL = "https://duyjcsycienwnfjmyjyb.supabase.co";

window.SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR1eWpjc3ljaWVud25mam15anliIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAwMjkyOTIsImV4cCI6MjA3NTYwNTI5Mn0.V46fni3GxDQTeayiUQEmBGYGfrVIxMuk17-FozPghf8";

// ✅ Create client globally
window.supabase = supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);

// ✅ Compatibility aliases (helps older pages)
window.supabaseUrl = window.SUPABASE_URL;
window.supabaseKey = window.SUPABASE_ANON_KEY;
window.supabaseAnonKey = window.SUPABASE_ANON_KEY;

console.log("✅ Supabase config loaded:", {
  SUPABASE_URL: window.SUPABASE_URL,
  HAS_ANON: !!window.SUPABASE_ANON_KEY,
  HAS_CLIENT: !!window.supabase
});
