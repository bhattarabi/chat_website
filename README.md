# Support Portal

A mobile-friendly Next.js + Supabase starter based on `website_developer_instructions_updated.pdf`.

## What Is Included

- Email/password signup, login, logout, and password reset.
- Customer dashboard with editable phone number, platform/game cards, notices, and support access.
- Realtime support chat using Supabase Realtime.
- Image uploads in chat using Supabase Storage.
- Admin area for platform links, users, disabling accounts, announcements, and customer chat access.
- Supabase SQL schema with row level security policies.

## Recommended Stack

- Next.js App Router for the website.
- Supabase Auth for email/password accounts.
- Supabase Postgres for profiles, links, messages, announcements, and admin data.
- Supabase Realtime for instant chat updates.
- Supabase Storage for image attachments.
- Vercel or Netlify for hosting the Next.js app.

## Setup

1. Create a Supabase project under the final owner account.
2. Open the Supabase SQL editor and run `supabase/schema.sql`.
3. Copy `.env.example` to `.env.local`.
4. Add these values from Supabase project settings:

```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SITE_URL=https://your-production-domain.com
```

`SITE_URL` is used for password reset email links. In production, set it to the public Vercel/custom domain without a trailing slash. In Supabase Auth settings, add this redirect URL to the allow-list:

```text
https://your-production-domain.com/auth/callback
```

5. Install dependencies and start the app:

```bash
npm install
npm run dev
```

6. Create the first user through the website, then promote that user to admin in Supabase:

```sql
update public.profiles
set role = 'admin'
where email = 'owner@example.com';
```

## Ownership Checklist

The owner should create and control these accounts directly:

- Domain registrar account.
- Supabase project account.
- Hosting account such as Vercel or Netlify.
- Source repository account such as GitHub.
- Any email/SMS/provider accounts added later.

Do not keep production services inside a developer's personal account long-term.

## Rough Timeline And Price Guidance

For a small production-ready version of this scope:

- Starter build and deployment: 1-2 weeks.
- Polished production handoff with testing, content loading, and owner training: 2-4 weeks.
- Budget varies by market, but this is usually a small business web app rather than a native mobile app. Expect a fixed bid or milestone quote after branding, admin workflow, and support volume are confirmed.

## Maintenance

Bug fixes should be handled from a tracked issue list. For ongoing care, plan for small monthly maintenance covering dependency updates, Supabase usage checks, backups, and urgent production fixes.
