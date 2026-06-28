# Google Cloud Run Deployment Guide

Use this guide for the final Vibe2Ship deployment. The deployed link must stay public and active during evaluation.

## Cloud Project

```bash
gcloud config set project gen-lang-client-0629595569
```

## Clone Or Update The Repo In Cloud Shell

Fresh clone:

```bash
git clone https://github.com/Paaarthiv/clutch--The-Last-Minute-Life-Saver-.git
cd clutch--The-Last-Minute-Life-Saver-
```

If the repo is already cloned:

```bash
cd ~/clutch--The-Last-Minute-Life-Saver-
git pull origin main
```

## Enable Required Google Cloud APIs

```bash
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com \
  firestore.googleapis.com \
  texttospeech.googleapis.com \
  calendar-json.googleapis.com
```

## Gemini API Key Secret

Create the secret only if it does not already exist:

```bash
printf 'PASTE_YOUR_GEMINI_API_KEY_HERE' | gcloud secrets create gemini-api-key --data-file=-
```

If the secret already exists and you need to update the key:

```bash
printf 'PASTE_YOUR_GEMINI_API_KEY_HERE' | gcloud secrets versions add gemini-api-key --data-file=-
```

Give the Cloud Run service account permission to read the secret:

```bash
gcloud secrets add-iam-policy-binding gemini-api-key \
  --member="serviceAccount:433410067334-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

## Firestore Permission

If Cloud Run cannot read or write Firestore state, grant Datastore user permission:

```bash
gcloud projects add-iam-policy-binding gen-lang-client-0629595569 \
  --member="serviceAccount:433410067334-compute@developer.gserviceaccount.com" \
  --role="roles/datastore.user"
```

## Deploy To Cloud Run

Replace `YOUR_GOOGLE_CALENDAR_CLIENT_ID` with the OAuth Client ID from Google Auth Platform.

```bash
gcloud run deploy clutch \
  --source . \
  --region asia-south1 \
  --allow-unauthenticated \
  --clear-base-image \
  --set-env-vars GEMINI_MODEL=gemini-2.5-flash,GOOGLE_CALENDAR_CLIENT_ID=YOUR_GOOGLE_CALENDAR_CLIENT_ID \
  --set-secrets GEMINI_API_KEY=gemini-api-key:latest
```

Cloud Run will print the public URL after deployment. Use this URL as the deployed application link.

Current expected service URL:

```text
https://clutch-433410067334.asia-south1.run.app/
```

## Google Calendar OAuth Checklist

In Google Auth Platform:

1. App publishing status can stay in Testing for demo if your judge/test account is added as a test user.
2. Add this authorized JavaScript origin:

```text
https://clutch-433410067334.asia-south1.run.app
```

3. Make sure the OAuth Client ID is passed as `GOOGLE_CALENDAR_CLIENT_ID` in the Cloud Run deploy command.
4. Test in the app by clicking Add to Calendar and confirming events appear in Google Calendar.

## Final Smoke Test

After deployment:

1. Open the Cloud Run URL.
2. Brain-dump multiple tasks, including a fixed-time task such as "gym from 6 PM to 8 PM".
3. Confirm Clutch creates a Today plan.
4. Break down a large task.
5. Trigger Clutch Mode and confirm voice output works.
6. Click Add to Calendar and verify calendar events.
7. Reload the app and confirm state restores from Firestore.

## Notes

- Do not commit `.env.local`.
- Keep the Cloud Run service public for judging.
- Keep the GitHub repository public.
- Make the Google Doc public with "Anyone with the link can view".
