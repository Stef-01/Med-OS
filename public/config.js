/* config.js - optional. To share progress (attempts, saved stations, your names, case requests) between your two devices, create a free
   Supabase project, run supabase/migrations/0001_osce_state.sql in its SQL editor, and paste the project URL and its
   anon (publishable) key below. Left empty, everything stays in each browser, and Settings → Export / Import progress
   moves it between you instead. */
window.OSCE_CONFIG = {
  supabaseUrl: '',
  supabaseAnonKey: '',
  /* Duel a Mate only: Casa, Optimus's Supabase project, where the duel is its own set of pup_* tables (run
     supabase/migrations/0002_pup_duel.sql and 0004_pup_duel_store.sql there once; README, "Duel a Mate"). This turns on
     duels with a mate and nothing else: progress sync above stays off while supabaseUrl is empty. The anon key is the
     public one Optimus's own page carries; the duel's tables are closed to it except through their functions. */
  duelSupabaseUrl: 'https://psozzmlxhhajcszlplns.supabase.co',
  duelSupabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBzb3p6bWx4aGhhamNzemxwbG5zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMyMzA0OTcsImV4cCI6MjA5ODgwNjQ5N30.uSRSplJrBC10zXUC5q2CbTN9PhzHnSM71XQ3tSB09h4',
};
