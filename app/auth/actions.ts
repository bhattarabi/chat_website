"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase-server";

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

async function sendPasswordResetEmail(email: string) {
  if (!email) return "Enter an email address for password reset.";

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: await getPasswordResetRedirectUrl()
  });

  return error ? error.message : "Password reset email sent. Check your inbox.";
}

async function getPasswordResetRedirectUrl() {
  const headersList = await headers();
  const origin =
    headersList.get("origin") ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    `${headersList.get("x-forwarded-proto") ?? "http"}://${headersList.get("host")}`;

  return `${origin}/auth/callback?next=/auth/update-password`;
}

export async function signIn(formData: FormData) {
  const supabase = await createClient();
  const email = getString(formData, "email");
  const password = getString(formData, "password");

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) redirect(`/auth?message=${encodeURIComponent(error.message)}`);

  revalidatePath("/", "layout");
  redirect("/");
}

export async function signUp(formData: FormData) {
  const supabase = await createClient();
  const email = getString(formData, "email");
  const password = getString(formData, "password");
  const fullName = getString(formData, "full_name");

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName }
    }
  });

  if (error) redirect(`/auth?message=${encodeURIComponent(error.message)}`);

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function resetPassword(formData: FormData) {
  const email = getString(formData, "email");
  const message = await sendPasswordResetEmail(email);
  redirect(`/auth?message=${encodeURIComponent(message)}`);
}

export async function sendCurrentUserPasswordReset() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth");

  const email = user.email;
  if (!email) {
    redirect(`/dashboard?message=${encodeURIComponent("No email address is attached to this account.")}`);
  }

  const message = await sendPasswordResetEmail(email);
  redirect(`/dashboard?message=${encodeURIComponent(message)}`);
}

export async function updatePassword(formData: FormData) {
  const supabase = await createClient();
  const password = getString(formData, "password");
  const confirmPassword = getString(formData, "confirm_password");

  if (password.length < 8) {
    redirect(`/auth/update-password?message=${encodeURIComponent("Password must be at least 8 characters.")}`);
  }

  if (password !== confirmPassword) {
    redirect(`/auth/update-password?message=${encodeURIComponent("Passwords do not match.")}`);
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    redirect(`/auth/update-password?message=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/", "layout");
  redirect(`/dashboard?message=${encodeURIComponent("Password updated.")}`);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}

export async function updateProfile(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth");

  await supabase
    .from("profiles")
    .update({
      full_name: getString(formData, "full_name") || null,
      phone: getString(formData, "phone") || null
    })
    .eq("id", user.id);

  revalidatePath("/dashboard");
  redirect(`/dashboard?message=${encodeURIComponent("Account changes saved.")}`);
}
