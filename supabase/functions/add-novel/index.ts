import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 1. Parse JSON safely
    const body = await req.json().catch(() => ({}));
    const { novel_url } = body;

    console.log("Processing Request for URL:", novel_url);

    if (!novel_url) {
      return new Response(JSON.stringify({ error: "Missing novel_url in request body" }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    const githubToken = Deno.env.get('GITHUB_PAT')
    const githubOwner = Deno.env.get('GITHUB_OWNER')
    const githubRepo = Deno.env.get('GITHUB_REPO')

    if (!githubToken || !githubOwner || !githubRepo) {
      console.error("Missing GitHub config in Secrets!");
      return new Response(JSON.stringify({ error: "Server Configuration Error: Missing GitHub Secrets" }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      })
    }

    // 2. Trigger Action
    const response = await fetch(
      `https://api.github.com/repos/${githubOwner}/${githubRepo}/actions/workflows/scraper.yml/dispatches`,
      {
        method: "POST",
        headers: {
          "Accept": "application/vnd.github.v3+json",
          "Authorization": `token ${githubToken}`,
          "Content-Type": "application/json",
          "User-Agent": "Arcadia-Reader"
        },
        body: JSON.stringify({
          ref: "main",
          inputs: { novel_url: novel_url }
        }),
      }
    )

    if (!response.ok) {
        const errorDetail = await response.text();
        console.error("GitHub API Error:", errorDetail);
        return new Response(JSON.stringify({ error: `GitHub API: ${response.status} - ${errorDetail}` }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        })
    }

    return new Response(JSON.stringify({ message: "Successfully triggered scraper for: " + novel_url }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    console.error("Unexpected Worker Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
