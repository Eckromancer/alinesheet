import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const ADMIN_PASSWORD = Deno.env.get('PORTAL_ADMIN_PASSWORD');
    const BUYER_PASSWORD = Deno.env.get('PORTAL_BUYER_PASSWORD');

    // Fail closed if secrets are not configured — never fall back to hardcoded defaults.
    if (!ADMIN_PASSWORD || !BUYER_PASSWORD) {
      console.error('Portal password secrets are not configured.');
      return new Response(JSON.stringify({ ok: false, error: 'not_configured' }), {
        status: 503,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json().catch(() => ({}));
    const password = typeof body?.password === 'string' ? body.password : '';
    if (!password || password.length > 200) {
      return new Response(JSON.stringify({ ok: false }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const ok = password === ADMIN_PASSWORD || password === BUYER_PASSWORD;
    return new Response(JSON.stringify({ ok }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch {
    return new Response(JSON.stringify({ ok: false }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
