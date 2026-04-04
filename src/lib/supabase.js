import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://svpfcfgmonxukcsqnly.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN2cGZjZmdybm9ueHVrY3Nxbmx5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyNjYyMTAsImV4cCI6MjA4Njg0MjIxMH0.kixATD6p5mDhchdUBgKUFU4Qyei4AXNDPVmcXfzzBwo';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false
  }
});