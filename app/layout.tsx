import type { Metadata } from "next";
import Script from "next/script";
import { createClient } from "@/lib/supabase-server";
import type { Profile } from "@/lib/types";
import "./globals.css";

export const metadata: Metadata = {
  title: "Game Links Galore",
  description: "Mobile-friendly customer portal with Supabase auth, platform links and LiveChat support."
};

export default async function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase.from("profiles").select("*").eq("id", user.id).single<Profile>()
    : { data: null };
  const visitorEmail = user?.email ?? profile?.email;
  const liveChatVisitor =
    visitorEmail || profile?.full_name
      ? {
          ...(profile?.full_name ? { name: profile.full_name } : visitorEmail ? { name: visitorEmail } : {}),
          ...(visitorEmail ? { email: visitorEmail } : {})
        }
      : null;
  const liveChatVisitorScript = liveChatVisitor
    ? `
    window.__lc.visitor = ${JSON.stringify(liveChatVisitor)};
    window.__lc.params = [
      ...(window.__lc.params || []),
      ${liveChatVisitor.name ? `{ name: "Name", value: ${JSON.stringify(liveChatVisitor.name)} },` : ""}
      ${liveChatVisitor.email ? `{ name: "Email", value: ${JSON.stringify(liveChatVisitor.email)} },` : ""}
    ];
    function setLiveChatVisitor() {
      if (!window.LiveChatWidget) return;
      ${liveChatVisitor.name ? `window.LiveChatWidget.call("set_customer_name", ${JSON.stringify(liveChatVisitor.name)});` : ""}
      ${liveChatVisitor.email ? `window.LiveChatWidget.call("set_customer_email", ${JSON.stringify(liveChatVisitor.email)});` : ""}
    }
    `
    : "";

  return (
    <html lang="en">
      <body>
        {children}
        <Script
          id="livechat-widget"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
    window.__lc = window.__lc || {};
    window.__lc.license = 19736930;
    window.__lc.integration_name = "manual_channels";
    window.__lc.product_name = "livechat";
    ${liveChatVisitorScript}
    ;(function(n,t,c){function i(n){return e._h?e._h.apply(null,n):e._q.push(n)}var e={_q:[],_h:null,_v:"2.0",on:function(){i(["on",c.call(arguments)])},once:function(){i(["once",c.call(arguments)])},off:function(){i(["off",c.call(arguments)])},get:function(){if(!e._h)throw new Error("[LiveChatWidget] You can't use getters before load.");return i(["get",c.call(arguments)])},call:function(){i(["call",c.call(arguments)])},init:function(){var n=t.createElement("script");n.async=!0,n.type="text/javascript",n.src="https://cdn.livechatinc.com/tracking.js",t.head.appendChild(n)}};!n.__lc.asyncInit&&e.init(),n.LiveChatWidget=n.LiveChatWidget||e}(window,document,[].slice))
    ${liveChatVisitor ? `window.LiveChatWidget.on("ready", setLiveChatVisitor); setLiveChatVisitor();` : ""}
            `
          }}
        />
        <noscript>
          <a href="https://www.livechat.com/chat-with/19736930/" rel="nofollow">
            Chat with us
          </a>
          , powered by{" "}
          <a
            href="https://www.livechat.com/?welcome"
            rel="noopener nofollow"
            target="_blank"
          >
            LiveChat
          </a>
        </noscript>
      </body>
    </html>
  );
}
