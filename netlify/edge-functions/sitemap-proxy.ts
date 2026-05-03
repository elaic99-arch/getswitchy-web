import type { Config } from "https://edge.netlify.com";

export default async () => {
  const upstream = await fetch("https://kvmgiutjertspbexjuzn.supabase.co/functions/v1/seo-sitemap");
  const body = await upstream.arrayBuffer();
  const headers = new Headers(upstream.headers);
  headers.set("content-type", "application/xml; charset=utf-8");
  headers.delete("content-length");
  headers.delete("content-encoding");
  headers.delete("transfer-encoding");

  return new Response(body, {
    status: upstream.status,
    headers,
  });
};

export const config: Config = {
  path: "/sitemap.xml",
};
