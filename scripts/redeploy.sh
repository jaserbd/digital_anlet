#!/usr/bin/env bash
# Rebuild the Docker image from the current working tree and redeploy it to
# the existing Cloud Run service (see gcp_deployment.md). Run this after
# committing new changes. Only the image changes — the service keeps its
# env vars, secrets and Cloud SQL connection.
#
# Prerequisites: gcloud CLI installed and authenticated
# (gcloud auth login), with access to the anlet-504115 project.
set -euo pipefail

PROJECT_ID=anlet-504115
REGION=europe-west3
SERVICE=anlet
REPO=anlet
IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}/${SERVICE}:latest"

cd "$(dirname "$0")/.."

echo "==> Building and pushing image (Cloud Build, regional — EU location policy)..."
gcloud builds submit --project="$PROJECT_ID" --region "$REGION" \
  --default-buckets-behavior regional-user-owned-bucket \
  --tag "$IMAGE" .

echo "==> Deploying new revision to Cloud Run..."
gcloud run deploy "$SERVICE" \
  --image "$IMAGE" \
  --region "$REGION" \
  --project="$PROJECT_ID"

echo "==> Done. Service URL:"
gcloud run services describe "$SERVICE" --region "$REGION" --project="$PROJECT_ID" \
  --format="value(status.url)"
