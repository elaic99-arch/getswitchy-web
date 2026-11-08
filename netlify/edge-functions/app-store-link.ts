import type { Config, Context } from "https://edge.netlify.com";

// getswitchy.com/app is THE one link to share (Instagram bio, posts, WhatsApp groups, QR codes).
// Elai 2026-11-08: "1 clean link for both ... one tap on the link and straight to the page of the app
// inside the stores".
//
//  - iPhone / iPod            -> Switchy's page in the App Store (302, decided here, no page shown).
//  - Android (phone, tablet)  -> Switchy's page in Google Play (302).
//  - iPad                     -> its Safari says "Macintosh" like a computer, so the server cannot
//                                tell; the page itself sends a touch "Mac" to the App Store before
//                                anything is drawn (IPAD_SCRIPT). A real Mac has no touch points.
//  - Computer                 -> the "The app" page with both store buttons, exactly as before.
//  - Search engines and link previews (WhatsApp, iMessage, Facebook, Telegram, ...) -> the page, so
//    a shared link keeps its title and picture. Googlebot / Applebot say "Android" / "iPhone" too.
//
// A phone that already HAS Switchy never reaches this: /app is one of the app's own links (the live
// apple-app-site-association lists "/app"; Android claims every getswitchy.com address), so the
// system opens the app on its home screen instead (re-wear lib/deepLink.ts: '/app' -> '/(tabs)').
//
// Only "/app" itself. "/app/*" (the emails' /app/wallet) and "/application" (the site menu) are untouched.
//
// Same two store addresses as the site's badges and the app (re-wear constants/storeLinks.ts).
const APP_STORE_URL = "https://apps.apple.com/app/id6812874579";
const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=com.getswitchy.app";

// Crawlers and link-preview fetchers. "(?<!cu)" keeps the CUBOT phone brand ("Android 10; CUBOT X30") a person.
const BOT = /(?<!cu)bot\b|crawler|spider|facebookexternalhit|google-inspectiontool|lighthouse|headlesschrome/i;

const IPAD_SCRIPT = `<script>if(navigator.maxTouchPoints>1)location.replace(${JSON.stringify(APP_STORE_URL)})</script>`;

function storeFor(userAgent: string): string | null {
  if (/iPhone|iPod/i.test(userAgent)) return APP_STORE_URL;
  // iPadOS 12 and older, and iPad apps' built-in browsers, still say "iPad".
  if (/iPad/i.test(userAgent)) return APP_STORE_URL;
  if (/Android/i.test(userAgent)) return PLAY_STORE_URL;
  return null;
}

export default async (request: Request, context: Context) => {
  const userAgent = request.headers.get("user-agent") ?? "";
  if (BOT.test(userAgent)) return; // the page, unchanged

  const store = storeFor(userAgent);
  if (store) {
    return new Response(null, {
      status: 302,
      headers: {
        location: store,
        // Never kept by a browser or a cache: the next person to tap may hold the other phone.
        "cache-control": "private, no-store",
        vary: "User-Agent",
      },
    });
  }

  // Not a phone by its words: only a Mac-looking browser can be an iPad. Everyone else gets the page untouched.
  if (!/Macintosh/i.test(userAgent)) return;
  const response = await context.next();
  const type = response.headers.get("content-type") ?? "";
  if (response.status !== 200 || !type.includes("text/html")) return response;
  const html = await response.text();
  const headers = new Headers(response.headers);
  headers.delete("content-length");
  headers.delete("etag");
  return new Response(html.replace("<head>", `<head>${IPAD_SCRIPT}`), { status: 200, headers });
};

export const config: Config = {
  path: ["/app", "/app/"],
};
