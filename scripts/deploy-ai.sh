#!/bin/bash

# Load environment variables from .env
set -a
source .env
set +a

if [ -z "$GEMINI_API_KEY" ]; then
  echo "Error: GEMINI_API_KEY is not set in .env"
  exit 1
fi

# Extract Project ID from SUPABASE_URL
# URL format: https://<project_id>.supabase.co
PROJECT_ID=$(echo $EXPO_PUBLIC_SUPABASE_URL | sed -E 's/https:\/\/([a-z0-9]+)\.supabase\.co/\1/')

if [ -z "$PROJECT_ID" ]; then
    echo "Error: Could not extract Project ID from EXPO_PUBLIC_SUPABASE_URL"
    exit 1
fi

echo "Targeting Supabase Project ID: $PROJECT_ID"

echo "Setting Supabase secrets..."
npx supabase secrets set --project-ref "$PROJECT_ID" GEMINI_API_KEY="$GEMINI_API_KEY"

echo "Deploying ai-proxy function..."
npx supabase functions deploy ai-proxy --project-ref "$PROJECT_ID"

echo "Done! AI service should now be operational."
