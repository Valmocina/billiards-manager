import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://btxfqgttuttvresjpqwo.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ0eGZxZ3R0dXR0dnJlc2pwcXdvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU2Mjg4MTEsImV4cCI6MjA4MTIwNDgxMX0.xZ_iPW0XGbuiJwyZ3xRxz0cb8m0CBU4ywT3hC0exKU4';

export const supabase = createClient(supabaseUrl, supabaseKey);
