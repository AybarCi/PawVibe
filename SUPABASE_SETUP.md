# 🚀 PawVibe: Supabase & Edge Function Deployment Guide

The local structure for the **PawVibe Edge Function** (`analyze-pet-vibe`) is ready! 

Since deployment requires your Supabase Project ID and OpenAI Key, here are the steps to deploy it to your production or staging Supabase project.

## 1. Link Your Project

First, link your local directory to your Supabase project using the project reference ID found in your Supabase Dashboard settings:

```bash
npx supabase link --project-ref <your-project-id>
```

*(You may be asked for your database password during this step.)*

## 2. Set Up Environment Variables (Secrets)

The Edge Function requires an OpenAI API key to work. You need to set this as a secret in your Supabase project:

```bash
npx supabase secrets set OPENAI_API_KEY=sk-your-openai-api-key-here
```

*(Note: `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are automatically provided to Edge Functions by Supabase, so you don't need to set them manually.)*

## 3. Deploy the Edge Function

Now, deploy the function to the cloud. We use the `--no-verify-jwt` flag if we want this function to be callable without an auth token (e.g. for complete anonymous initial access before a session is fully established), or omit it if you strictly enforce the anonymous user session token.

Given the architecture of PawVibe (Anonymous First), if the app has already retrieved an anonymous token, you **don't** need the flag.

```bash
npx supabase functions deploy analyze-pet-vibe
```

## 4. Testing the Function Locally

If you want to test the function before deploying, you can run Supabase locally and hit the function with `curl`:

1. Start Supabase locally:
   ```bash
   npx supabase start
   ```

2. Add your local `.env` file at `supabase/functions/.env` for local testing:
   ```env
   OPENAI_API_KEY=sk-your-openai-api-key-here
   ```

3. Serve the function locally:
   ```bash
   npx supabase functions serve analyze-pet-vibe --env-file ./supabase/functions/.env
   ```

4. You can then `POST` to `http://127.0.0.1:54321/functions/v1/analyze-pet-vibe` with `{ "user_id": "...", "image_base64": "..." }`.
