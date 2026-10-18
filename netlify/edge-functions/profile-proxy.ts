import type { Config } from "https://edge.netlify.com";

// Only these of Supabase's response headers reach the visitor. Copying all of them carried
// Supabase's own `content-security-policy: default-src 'none'; sandbox` (its gateway puts it on
// every HTML page a function serves), which blocked the page's styles, photos and scripts: a
// shared shop link opened as bare text with no design. Its cookie, HSTS and alt-svc are its own too.
const PASS_HEADERS = ["cache-control", "vary", "server-timing", "retry-after"];

// The page's styles and scripts are inline and its photos and store badges come over https.
// Allows exactly that; keeps plugins, <base> rewrites and framing by other sites out.
const PAGE_CSP = "default-src https: data: 'unsafe-inline'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'";

export default async (request: Request) => {
  const url = new URL(request.url);
  // The page speaks the link's ?lang= (the app adds the sharer's language) or, without one, the
  // browser's language; only those two travel on, so the page is English exactly as before otherwise.
  const lang = url.searchParams.get("lang");
  const supabaseUrl = `https://kvmgiutjertspbexjuzn.supabase.co/functions/v1/seo-profile-page${url.pathname}${
    lang ? `?lang=${encodeURIComponent(lang)}` : ""
  }`;
  const requestHeaders: Record<string, string> = { "user-agent": request.headers.get("user-agent") ?? "Netlify-Edge" };
  const acceptLanguage = request.headers.get("accept-language");
  if (acceptLanguage) requestHeaders["accept-language"] = acceptLanguage;

  const upstream = await fetch(supabaseUrl, {
    method: request.method,
    headers: requestHeaders,
  });

  const body = await upstream.arrayBuffer();
  const headers = new Headers();
  for (const name of PASS_HEADERS) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }
  headers.set("content-type", "text/html; charset=utf-8");
  headers.set("content-security-policy", PAGE_CSP);
  headers.set("x-content-type-options", "nosniff");

  return new Response(body, {
    status: upstream.status,
    headers,
  });
};

export const config: Config = {
  path: ["/profile/*", "/p/*"],
};
