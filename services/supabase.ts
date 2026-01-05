import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../constants';

// Initialize Supabase client
// Note: In a real production app, ensure your RLS policies are set correctly in Supabase.
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
