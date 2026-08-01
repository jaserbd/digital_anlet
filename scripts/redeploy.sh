#!/usr/bin/env bash
# Rebuild the Docker image from the current working tree and redeploy it to
# the existing Cloud Run service. Run this after committing new changes.
#
# Prerequisites: gcloud CLI installed and authenticated
# (gcloud auth login), with access to the anlet-504021 project.
set -euo pipefail

PROJECT_ID=anlet-504021
REGION=europe-west1
SERVICE=anlet
REPO=anlet
IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}/${SERVICE}:latest"

cd "$(dirname "$0")/.."

echo "==> Building and pushing image (Cloud Build)..."
gcloud builds submit --tag "$IMAGE" --project="$PROJECT_ID" .

echo "==> Deploying new revision to Cloud Run..."
gcloud run deploy "$SERVICE" \
  --image "$IMAGE" \
  --region "$REGION" \
  --project="$PROJECT_ID"

echo "==> Done. Service URL:"
gcloud run services describe "$SERVICE" --region "$REGION" --project="$PROJECT_ID" \
  --format="value(status.url)"
