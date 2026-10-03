const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export async function pushToSupabase(userId: string, payload: any): Promise<void> {
  if (!SUPABASE_URL || !SUPABASE_KEY) return;
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/debts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Prefer': 'resolution=merge-duplicates',
      },
      body: JSON.stringify({
        user_id: userId,
        data: payload,
      }),
    });
  } catch (err) {
    console.warn('Supabase push error:', err);
  }
}

export async function pullFromSupabase(userId: string): Promise<any | null> {
  if (!SUPABASE_URL || !SUPABASE_KEY) return null;
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/debts?user_id=eq.${encodeURIComponent(userId)}&select=data&order=created_at.desc&limit=1`,
      {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Cache-Control': 'no-cache',
        },
      }
    );
    if (!res.ok) return null;
    const records = await res.json();
    if (Array.isArray(records) && records.length > 0 && records[0].data) {
      return records[0].data;
    }
  } catch (err) {
    console.warn('Supabase pull error:', err);
  }
  return null;
}
