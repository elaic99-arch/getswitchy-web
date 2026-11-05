import type { Config } from "https://edge.netlify.com";

// The item list for search engines (/sitemap.xml) comes from the Supabase function seo-sitemap.
// Only these of its response headers travel on: copying all of them also carried Supabase's own
// cookie (for supabase.co), its HSTS / alt-svc and its `content-security-policy: sandbox`, which
// do not belong to getswitchy.com (same allow-list idea as item-proxy / profile-proxy).
const PASS_HEADERS = ["cache-control", "vary", "retry-after"];

export default async () => {
  let upstream: Response;
  try {
    upstream = await fetch("https://kvmgiutjertspbexjuzn.supabase.co/functions/v1/seo-sitemap", {
      signal: AbortSignal.timeout(20000),
    });
  } catch {
    // Supabase unreachable or too slow: tell the crawler to come back later instead of a broken file.
    return new Response("Sitemap temporarily unavailable", {
      status: 503,
      headers: { "content-type": "text/plain; charset=utf-8", "retry-after": "600" },
    });
  }

  const body = await upstream.arrayBuffer();
  const headers = new Headers();
  for (const name of PASS_HEADERS) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }
  headers.set("content-type", "application/xml; charset=utf-8");
  headers.set("x-content-type-options", "nosniff");

  return new Response(body, {
    status: upstream.status,
    headers,
  });
};

export const config: Config = {
  path: "/sitemap.xml",
};
