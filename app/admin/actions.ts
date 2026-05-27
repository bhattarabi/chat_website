"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";

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

export async function updateUserStatus(formData: FormData) {
  const supabase = await requireAdmin();
  const userId = text(formData, "user_id");
  await supabase
    .from("profiles")
    .update({
      disabled: formData.get("disabled") === "on",
      role: formData.get("admin") === "on" ? "admin" : "customer"
    })
    .eq("id", userId);

  revalidatePath("/admin");
}
