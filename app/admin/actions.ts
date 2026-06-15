"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import type { Role } from "@/lib/types";

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, disabled")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin" || profile.disabled) redirect("/dashboard");
  return supabase;
}

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function normalizePlatformUrl(url: string) {
  if (url.toLowerCase().startsWith("www.")) return `https://${url}`;
  return url;
}

function normalizeImageUrl(url: string) {
  return normalizePlatformUrl(url);
}

function plainTextToHtml(body: string) {
  return body
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${paragraph.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replace(/\n/g, "<br />")}</p>`)
    .join("");
}

function chunk<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

type PromoCampaign = {
  id: string;
  subject: string;
  body: string;
};

type PromoSubscriberForSend = {
  id: string;
  email: string;
  unsubscribe_token: string;
};

async function sendPromotionalEmail(supabase: Awaited<ReturnType<typeof createClient>>, campaign: PromoCampaign) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.PROMO_EMAIL_FROM;
  const siteUrl = (process.env.SITE_URL ?? "").replace(/\/$/, "");

  if (!apiKey || !from) {
    throw new Error("Set RESEND_API_KEY and PROMO_EMAIL_FROM before sending promotional email.");
  }

  const { data: subscribers, error: subscribersError } = await supabase
    .from("promo_subscribers")
    .select("id, email, unsubscribe_token")
    .is("unsubscribed_at", null)
    .order("subscribed_at", { ascending: true })
    .returns<PromoSubscriberForSend[]>();

  if (subscribersError) throw new Error(subscribersError.message);
  if (!subscribers?.length) throw new Error("There are no active promo subscribers yet.");

  await supabase
    .from("promotional_emails")
    .update({
      status: "sending",
      recipient_count: subscribers.length,
      sent_count: 0,
      send_error: null,
      sent_at: null
    })
    .eq("id", campaign.id);

  let sentCount = 0;
  const bodyHtml = plainTextToHtml(campaign.body);

  for (const subscriberChunk of chunk(subscribers, 100)) {
    const response = await fetch("https://api.resend.com/emails/batch", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `promo-${campaign.id}-${sentCount}`
      },
      body: JSON.stringify(
        subscriberChunk.map((subscriber) => {
          const unsubscribeUrl = siteUrl
            ? `${siteUrl}/unsubscribe/${subscriber.unsubscribe_token}`
            : "";

          return {
            from,
            to: [subscriber.email],
            subject: campaign.subject,
            html: `${bodyHtml}${
              unsubscribeUrl
                ? `<p style="font-size:12px;color:#536176;margin-top:24px">No longer want promos? <a href="${unsubscribeUrl}">Unsubscribe</a>.</p>`
                : ""
            }`,
            text: `${campaign.body}${unsubscribeUrl ? `\n\nUnsubscribe: ${unsubscribeUrl}` : ""}`
          };
        })
      )
    });

    const result = (await response.json().catch(() => null)) as
      | { data?: { id?: string }[]; message?: string; error?: string }
      | null;

    if (!response.ok) {
      throw new Error(result?.message || result?.error || `Email provider returned ${response.status}.`);
    }

    const deliveries = subscriberChunk.map((subscriber, index) => ({
      promotional_email_id: campaign.id,
      subscriber_id: subscriber.id,
      email: subscriber.email,
      provider_message_id: result?.data?.[index]?.id ?? null,
      status: "sent"
    }));

    await supabase.from("promotional_email_deliveries").insert(deliveries);
    sentCount += subscriberChunk.length;
    await supabase.from("promotional_emails").update({ sent_count: sentCount }).eq("id", campaign.id);
  }

  await supabase
    .from("promotional_emails")
    .update({
      status: "sent",
      sent_count: sentCount,
      sent_at: new Date().toISOString()
    })
    .eq("id", campaign.id);
}

export async function savePlatformLink(formData: FormData) {
  const supabase = await requireAdmin();
  const id = text(formData, "id");
  const payload = {
    title: text(formData, "title"),
    description: text(formData, "description") || null,
    url: normalizePlatformUrl(text(formData, "url")),
    image_url: text(formData, "image_url") ? normalizeImageUrl(text(formData, "image_url")) : null,
    is_featured: formData.get("isFeatured") === "on",
    button_label: text(formData, "button_label") || "Open",
    sort_order: Number(text(formData, "sort_order") || 0),
    active: formData.get("active") === "on"
  };

  if (id) {
    await supabase.from("platform_links").update(payload).eq("id", id);
  } else {
    await supabase.from("platform_links").insert(payload);
  }

  revalidatePath("/admin");
  revalidatePath("/dashboard");
  revalidatePath("/");
}

export async function deletePlatformLink(formData: FormData) {
  const supabase = await requireAdmin();
  await supabase.from("platform_links").delete().eq("id", text(formData, "id"));
  revalidatePath("/admin");
  revalidatePath("/dashboard");
  revalidatePath("/");
}

export async function saveMainFeature(formData: FormData) {
  const supabase = await requireAdmin();
  const imageUrl = text(formData, "main_feature_image_url");
  const linkUrl = text(formData, "main_feature_link_url");

  await supabase.from("main_feature").upsert({
    id: "main",
    image_url: imageUrl ? normalizeImageUrl(imageUrl) : null,
    link_url: linkUrl ? normalizePlatformUrl(linkUrl) : null
  });

  revalidatePath("/admin");
  revalidatePath("/");
}

export async function saveAnnouncement(formData: FormData) {
  const supabase = await requireAdmin();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  await supabase.from("announcements").insert({
    title: text(formData, "title"),
    body: text(formData, "body"),
    status: formData.get("published") === "on" ? "published" : "draft",
    created_by: user?.id
  });

  revalidatePath("/admin");
  revalidatePath("/dashboard");
}

export async function savePromotionalEmail(formData: FormData) {
  const supabase = await requireAdmin();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  const intent = text(formData, "intent");
  const payload = {
    subject: text(formData, "subject"),
    body: text(formData, "body"),
    created_by: user?.id
  };

  const { data: campaign, error } = await supabase
    .from("promotional_emails")
    .insert(payload)
    .select("id, subject, body")
    .single<PromoCampaign>();

  if (!error && campaign && intent === "send") {
    try {
      await sendPromotionalEmail(supabase, campaign);
    } catch (sendError) {
      await supabase
        .from("promotional_emails")
        .update({
          status: "failed",
          send_error: sendError instanceof Error ? sendError.message : "Unable to send promotional email."
        })
        .eq("id", campaign.id);
    }
  }

  revalidatePath("/admin");
}

export async function sendSavedPromotionalEmail(formData: FormData) {
  const supabase = await requireAdmin();
  const id = text(formData, "id");
  const { data: campaign, error } = await supabase
    .from("promotional_emails")
    .select("id, subject, body")
    .eq("id", id)
    .single<PromoCampaign>();

  if (!error && campaign) {
    try {
      await sendPromotionalEmail(supabase, campaign);
    } catch (sendError) {
      await supabase
        .from("promotional_emails")
        .update({
          status: "failed",
          send_error: sendError instanceof Error ? sendError.message : "Unable to send promotional email."
        })
        .eq("id", campaign.id);
    }
  }

  revalidatePath("/admin");
}

export async function updatePromoSubscriber(formData: FormData) {
  const supabase = await requireAdmin();
  const id = text(formData, "id");
  const email = text(formData, "email").toLowerCase();
  const phone = text(formData, "phone") || null;
  const isActive = formData.get("active") === "on";

  await supabase
    .from("promo_subscribers")
    .update({
      email,
      phone,
      unsubscribed_at: isActive ? null : new Date().toISOString()
    })
    .eq("id", id);

  revalidatePath("/admin");
}

export async function deletePromoSubscriber(formData: FormData) {
  const supabase = await requireAdmin();
  await supabase.from("promo_subscribers").delete().eq("id", text(formData, "id"));
  revalidatePath("/admin");
}

export async function updateUserStatus(formData: FormData) {
  const supabase = await requireAdmin();
  const userId = text(formData, "user_id");
  const role = text(formData, "role");
  const nextRole: Role = role === "admin" || role === "agent" ? role : "customer";

  await supabase
    .from("profiles")
    .update({
      disabled: formData.get("disabled") === "on",
      role: nextRole
    })
    .eq("id", userId);

  revalidatePath("/admin");
  revalidatePath("/chat");
}
