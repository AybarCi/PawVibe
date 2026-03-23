import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase credentials missing. Ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set.');
}

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '');

/**
 * Helpler to call Supabase Edge Functions with proper Admin Auth headers
 */
export const callEdgeFunction = async (functionName: string, body: any = {}) => {
  const { data: { session } } = await supabase.auth.getSession();
  
  const response = await fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session?.access_token}`,
      'apikey': supabaseAnonKey
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    let errorMsg = `Failed to call ${functionName}`;
    try {
      const error = await response.json();
      errorMsg = error.error || errorMsg;
    } catch (e) {
      // ignore json parse error
    }
    throw new Error(errorMsg);
  }

  return response.json();
};
