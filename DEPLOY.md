# Vercel Deployment Guide

## 1) Push code to GitHub

```bash
git add .
git commit -m "prepare vercel deployment"
git push
```

## 2) Import project in Vercel

1. Open [vercel.com](https://vercel.com)
2. Click **Add New Project**
3. Import this GitHub repository

## 3) Configure environment variables

In Vercel Project Settings -> Environment Variables, add:

- `NEXT_PUBLIC_APP_URL` (your Vercel URL or custom domain)
- `NEXT_PUBLIC_SUPABASE_URL` (required, for example `https://your-project.supabase.co`)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` (required)
- `NEXT_PUBLIC_FEEDBACK_URL` (optional, a form or issue link for demo testers)

Before sharing the demo URL, apply `supabase/schema.sql` to the Supabase project so the
required tables, RLS policies, auth trigger, and RPCs exist. In the Supabase Auth
dashboard, set the Site URL and allowed redirect URLs to the demo origin, for example:

- `https://life-rpg-xxx.vercel.app`
- `https://life-rpg-xxx.vercel.app/api/auth/callback`

For local development:

- Copy `.env.example` values into `.env.local`
- Replace placeholders with real values

## 4) Deploy

Click **Deploy**. Vercel will build with `next build` and generate a URL like:

`https://life-rpg-xxx.vercel.app`

## Notes

- This project includes `vercel.json` for build/output settings.
- Local development skips middleware auth checks, but production requires a Supabase session for protected pages.
- Run a local production check before deploy:

```bash
npm run lint
npm run build
```
