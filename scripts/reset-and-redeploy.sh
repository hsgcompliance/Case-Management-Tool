#!/usr/bin/env bash
set -euo pipefail

PROJECT="${1:-housing-db-v2}"
DEPLOY_HOSTING="${2:-}"
REGION="us-central1"

echo "Project: $PROJECT"
echo "Listing deployed functions..."

flush_batch() {
  if [ "${#DELETE_BATCH[@]}" -eq 0 ]; then
    return
  fi
  echo "Deleting batch (${#DELETE_BATCH[@]}): ${DELETE_BATCH[*]}"
  firebase functions:delete "${DELETE_BATCH[@]}" \
    --region "$REGION" \
    --project "$PROJECT" \
    --force || true
  DELETE_BATCH=()
}

DELETE_BATCH=()

while IFS= read -r fn; do
  [ -z "$fn" ] && continue
  short="${fn##*/}"
  [ -z "$short" ] && continue

  if [ "$short" = "sendMonthlyDigests" ]; then
    flush_batch
    echo "Deleting special-case gen2 scheduled function: $short"
    gcloud functions delete "$short" \
      --gen2 \
      --region="$REGION" \
      --project="$PROJECT" \
      --quiet || true
    continue
  fi

  DELETE_BATCH+=("$short")
  if [ "${#DELETE_BATCH[@]}" -ge 20 ]; then
    flush_batch
  fi
done < <(gcloud functions list --project "$PROJECT" --format="value(name)" | tr -d '\r')

flush_batch

echo "Deploying functions..."
firebase deploy --only functions --project "$PROJECT" --force

if [ "$DEPLOY_HOSTING" = "--hosting" ]; then
  echo "Deploying hosting..."
  firebase deploy --only hosting --project "$PROJECT"
fi
