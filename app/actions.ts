"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function subscribeToPromos(formData: FormData) {
  const supabase = await createClient();
  const email = normalizeEmail(text(formData, "email"));
  const phone = text(formData, "phone") || null;

  if (!isValidEmail(email)) {
    redirect("/?subscribe=invalid#subscribe");
  }

  const { error } = await supabase.rpc("subscribe_promo", {
    subscriber_email: email,
    subscriber_phone: phone
  });

  revalidatePath("/");
  redirect(`/?subscribe=${error ? "error" : "success"}#subscribe`);
}
