#!/usr/bin/env bash
set -euo pipefail
: "${WEB_BUCKET_NAME:?Set WEB_BUCKET_NAME}"
: "${WEB_DISTRIBUTION_ID:?Set WEB_DISTRIBUTION_ID}"
: "${AWS_REGION:?Set AWS_REGION}"
for file in index.html service-worker.js manifest.webmanifest api/browser.json legal/privacy.html legal/terms.html legal/privacy.pdf legal/terms.pdf; do
  test -s "packages/web-digital-pet/dist-static/$file"
done
site=packages/web-digital-pet/dist-static
# Retried historical tags may still export the previous revisions layout.
for immutable_dir in assets revisions; do
  if [ -d "$site/$immutable_dir" ]; then
    aws s3 sync "$site/$immutable_dir" "s3://$WEB_BUCKET_NAME/$immutable_dir" \
      --cache-control "public,max-age=31536000,immutable"
  fi
done
aws s3 sync "$site" "s3://$WEB_BUCKET_NAME/" \
  --exclude "assets/*" --exclude "revisions/*" --exclude "index.html" \
  --exclude "service-worker.js" --exclude "manifest.webmanifest" \
  --exclude "api/browser.json" \
  --exclude "legal/*" \
  --cache-control "no-cache"
# Extensionless S3 objects keep public legal URLs stable without a new CDN rewrite.
for document in privacy terms; do
  aws s3 cp "$site/legal/$document.html" "s3://$WEB_BUCKET_NAME/legal/$document" \
    --content-type "text/html; charset=utf-8" --cache-control "no-cache"
  aws s3 cp "$site/legal/$document.pdf" "s3://$WEB_BUCKET_NAME/legal/$document.pdf" \
    --content-type "application/pdf" --cache-control "no-cache"
done
aws s3 cp "$site/api/browser.json" "s3://$WEB_BUCKET_NAME/api/browser.json" \
  --content-type "application/json" --cache-control "no-cache"
aws s3 cp "$site/manifest.webmanifest" \
  "s3://$WEB_BUCKET_NAME/manifest.webmanifest" \
  --content-type "application/manifest+json" \
  --cache-control "no-cache"
aws s3 cp "$site/index.html" "s3://$WEB_BUCKET_NAME/index.html" \
  --content-type "text/html; charset=utf-8" \
  --cache-control "no-cache"
aws s3 cp "$site/service-worker.js" \
  "s3://$WEB_BUCKET_NAME/service-worker.js" \
  --content-type "text/javascript" \
  --cache-control "no-cache"
aws cloudfront create-invalidation \
  --distribution-id "$WEB_DISTRIBUTION_ID" \
  --paths "/" "/index.html" "/dex*" "/history*" "/view/*" \
    "/service-worker.js" "/manifest.webmanifest" "/api/*" "/legal/*" \
    "/fonts/*" "/images/*" "/icons/*" "/regions/*" "/favicon.ico"
