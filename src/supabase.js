// src/supabase.js
import { createClient } from '@supabase/supabase-js/dist/module/index.js';

// 1. Go to https://supabase.com and create a new project
// 2. Go to Project Settings -> API
// 3. Paste the URL and ANON KEY below

const supabaseUrl = 'https://kodhmgkjknchysmbjnik.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtvZGhtZ2tqa25jaHlzbWJqbmlrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUzNzM2NzcsImV4cCI6MjA4MDk0OTY3N30.ymzq3AGJN-_2egWCqdJ7eo3f9QfBH0J27hiHuZI2K40';

export const supabase = createClient(supabaseUrl, supabaseKey);