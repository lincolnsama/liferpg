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
- `NEXT_PUBLIC_SUPABASE_URL` (if using Supabase)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` (if using Supabase)

For local development:

- Copy `.env.example` values into `.env.local`
- Replace placeholders with real values

## 4) Deploy

Click **Deploy**. Vercel will build with `next build` and generate a URL like:

`https://life-rpg-xxx.vercel.app`

## Notes

- This project includes `vercel.json` for build/output settings.
- If routes behave unexpectedly in production, review rewrite rules in `vercel.json`.
- Run a local production check before deploy:

```bash
npm run build
```
