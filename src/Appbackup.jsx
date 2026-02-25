import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import TatvaAyurvedLogin from './TatvaAyurvedLogin';
import MainDashboard from './MainDashboard';

// Supabase configuration
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-emerald-50 to-teal-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-emerald-600 mx-auto mb-4"></div>
          <p className="text-xl font-semibold text-slate-700">Loading Tatva Ayurved HMS...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-screen overflow-hidden">
      {!session ? (
        <TatvaAyurvedLogin supabase={supabase} />
      ) : (
        <MainDashboard supabase={supabase} />
      )}
    </div>
  );
}

export default App;
