import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

const supabaseUrl = 'https://gqqgzwfiwillxfjecoqj.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdxcWd6d2Zpd2lsbHhmamVjb3FqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwMTc3OTQsImV4cCI6MjA4NzU5Mzc5NH0.7C8vSYNpWXwLCSoywpGXMPC28n4pFqOKA_F9TqMllj8';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testEdgeFunction() {
    console.log("Signing in anonymously...");
    const { data: authData, error: authError } = await supabase.auth.signInAnonymously();
    if (authError) {
        console.error("Auth error:", authError);
        return;
    }
    
    console.log("Logged in user:", authData.user?.id);
    
    // Create a dummy base64 1x1 pixel webp image
    const dummyImage = "UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==";

    console.log("Invoking edge function...");
    const response = await fetch(`${supabaseUrl}/functions/v1/analyze-pet-vibe`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authData.session?.access_token}`
        },
        body: JSON.stringify({
            user_id: authData.user?.id,
            image_base64: dummyImage
        })
    });

    const text = await response.text();
    console.log(`Status: ${response.status}`);
    console.log("Response body:", text);
}

testEdgeFunction();
