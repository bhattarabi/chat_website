"use client";

import { sendCurrentUserPasswordReset } from "@/app/auth/actions";

export function ResetPasswordButton() {
  return (
    <form
      action={sendCurrentUserPasswordReset}
      className="reset-password-form"
      onSubmit={(event) => {
        if (!window.confirm("Send a password reset link to your account email address?")) {
          event.preventDefault();
        }
      }}
    >
      <button type="submit" className="secondary">
        Reset Password
      </button>
    </form>
  );
}
