import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

// Get these from your Supabase Dashboard
const supabaseUrl = 'https://gqqgzwfiwillxfjecoqj.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdxcWd6d2Zpd2lsbHhmamVjb3FqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwMTc3OTQsImV4cCI6MjA4NzU5Mzc5NH0.7C8vSYNpWXwLCSoywpGXMPC28n4pFqOKA_F9TqMllj8';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
