# Google Cloud Run Deployment

Use these steps for the Vibe2Ship submission deployable link.

## 1. Open Cloud Shell

Go to Google Cloud Console, open Cloud Shell, and clone your GitHub repo:

```bash
git clone YOUR_GITHUB_REPO_URL
cd YOUR_REPO_FOLDER/clutch_app
```

If your repo root is already `clutch_app`, just `cd` into that folder.

## 2. Select Project And Enable Services

```bash
gcloud config set project YOUR_PROJECT_ID
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com
```

Use the Google Cloud project you want the final hackathon link deployed under.

## 3. Store Gemini Key In Secret Manager

```bash
printf 'PASTE_YOUR_GEMINI_API_KEY_HERE' | gcloud secrets create gemini-api-key --data-file=-
```

If the secret already exists and you are rotating the key:

```bash
printf 'PASTE_YOUR_GEMINI_API_KEY_HERE' | gcloud secrets versions add gemini-api-key --data-file=-
```

## 4. Deploy To Cloud Run

```bash
gcloud run deploy clutch \
  --source . \
  --region asia-south1 \
  --allow-unauthenticated \
  --set-env-vars GEMINI_MODEL=gemini-2.5-flash \
  --set-secrets GEMINI_API_KEY=gemini-api-key:latest
```

Cloud Run prints a public service URL when deployment finishes. Use that URL as the hackathon deployed application link.

## 5. Verify

Open the Cloud Run URL and test this demo path:

1. Add a brain-dump with several tasks.
2. Confirm Clutch creates priorities and schedule blocks.
3. Break down a 60m+ task such as Exam prep.
4. Drop a task and confirm the replan prompt appears.

## Notes

- Do not commit `.env.local`.
- Keep the Cloud Run service public for judging.
- Keep the Google Doc and GitHub repo accessible through the evaluation period.
