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
    const { novel_url } = await req.json()

    if (!novel_url) {
      return new Response(JSON.stringify({ error: "novel_url is required" }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    const githubToken = Deno.env.get('GITHUB_PAT')
    const githubOwner = Deno.env.get('GITHUB_OWNER')
    const githubRepo = Deno.env.get('GITHUB_REPO')

    if (!githubToken || !githubOwner || !githubRepo) {
      throw new Error("GitHub credentials are not configured in environment variables")
    }

    // Trigger GitHub Action Workflow Dispatch
    const response = await fetch(
      `https://api.github.com/repos/${githubOwner}/${githubRepo}/actions/workflows/scraper.yml/dispatches`,
      {
        method: "POST",
        headers: {
          "Accept": "application/vnd.github.v3+json",
          "Authorization": `token ${githubToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ref: "main",
          inputs: {
            novel_url: novel_url
          }
        }),
      }
    )

    if (!response.ok) {
        const errorText = await response.text();
        console.error("GitHub API Error:", errorText);
        throw new Error(`Failed to trigger GitHub Action: ${response.status} ${response.statusText}`);
    }

    return new Response(JSON.stringify({ message: "Scraper triggered successfully for " + novel_url }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
