import type { Config } from "https://edge.netlify.com";

export default async (request: Request) => {
  const url = new URL(request.url);
  const supabaseUrl = `https://kvmgiutjertspbexjuzn.supabase.co/functions/v1/seo-item-page${url.pathname}`;

  const upstream = await fetch(supabaseUrl, {
    method: request.method,
    headers: { "user-agent": request.headers.get("user-agent") ?? "Netlify-Edge" },
  });

  const body = await upstream.arrayBuffer();
  const headers = new Headers(upstream.headers);
  headers.set("content-type", "text/html; charset=utf-8");
  headers.delete("content-length");
  headers.delete("content-encoding");
  headers.delete("transfer-encoding");

  return new Response(body, {
    status: upstream.status,
    headers,
  });
};

export const config: Config = {
  path: "/item/*",
};
