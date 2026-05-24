import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

// Server-side passwords. Rotate here to invalidate access.
const ADMIN_PASSWORD = Deno.env.get('PORTAL_ADMIN_PASSWORD') ?? 'Manager-2026-Rotate$';
const BUYER_PASSWORD = Deno.env.get('PORTAL_BUYER_PASSWORD') ?? 'Buyer-2026-Rotate$';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
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
