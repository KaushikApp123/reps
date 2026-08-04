#!/usr/bin/env bash
#
# Creates the AWS side of SetSwipe:
#   - a private S3 bucket for progress photos (presigned uploads only)
#   - an IAM user scoped to just that bucket, for the Next.js app
#   - a Lambda that writes weekly digests into Postgres
#   - an EventBridge schedule that runs it every Monday
#
# Everything here sits inside the AWS free tier at this scale: Lambda's 1M
# monthly requests never expire and the schedule fires ~4 times a month.
#
# Prerequisites: aws CLI configured (`aws sts get-caller-identity` works)
# and the Supabase service-role key to hand.
#
# Usage:  bash aws/setup.sh
# Safe to re-run — every step is skipped if the resource already exists.

set -euo pipefail

REGION="${AWS_REGION:-us-east-1}"
ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"

BUCKET="setswipe-photos-${ACCOUNT_ID}"
APP_USER="setswipe-app"
LAMBDA_NAME="setswipe-weekly-digest"
LAMBDA_ROLE="setswipe-digest-role"
RULE_NAME="setswipe-weekly-digest-schedule"

say() { printf "\n\033[1m==> %s\033[0m\n" "$1"; }

# ---------------------------------------------------------------- S3 bucket
say "S3 bucket: $BUCKET"
if aws s3api head-bucket --bucket "$BUCKET" 2>/dev/null; then
  echo "already exists, skipping"
else
  # us-east-1 is the one region that rejects a LocationConstraint.
  if [ "$REGION" = "us-east-1" ]; then
    aws s3api create-bucket --bucket "$BUCKET" --region "$REGION"
  else
    aws s3api create-bucket --bucket "$BUCKET" --region "$REGION" \
      --create-bucket-configuration LocationConstraint="$REGION"
  fi
fi

say "Locking the bucket down (no public access, encrypted, versionless)"
aws s3api put-public-access-block --bucket "$BUCKET" \
  --public-access-block-configuration \
  "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"

aws s3api put-bucket-encryption --bucket "$BUCKET" \
  --server-side-encryption-configuration \
  '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'

# Browser PUTs go straight to S3 via a presigned URL, so the bucket needs CORS.
aws s3api put-bucket-cors --bucket "$BUCKET" --cors-configuration '{
  "CORSRules": [{
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["PUT", "GET"],
    "AllowedOrigins": ["http://localhost:3000", "https://setswipe.vercel.app", "https://*.vercel.app"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3000
  }]
}'

# Anything left in the scratch prefix disappears after a day, so an abandoned
# upload can never accumulate cost.
aws s3api put-bucket-lifecycle-configuration --bucket "$BUCKET" \
  --lifecycle-configuration '{
    "Rules": [{
      "ID": "expire-tmp",
      "Status": "Enabled",
      "Filter": {"Prefix": "tmp/"},
      "Expiration": {"Days": 1}
    }]
  }'

# ------------------------------------------------------------- IAM app user
say "IAM user for the app: $APP_USER"
if aws iam get-user --user-name "$APP_USER" >/dev/null 2>&1; then
  echo "already exists, skipping creation"
else
  aws iam create-user --user-name "$APP_USER" >/dev/null
fi

# Scoped to object access on this one bucket — deliberately not s3:* and
# deliberately not a bucket-level wildcard.
aws iam put-user-policy --user-name "$APP_USER" \
  --policy-name setswipe-photos-rw \
  --policy-document "{
    \"Version\": \"2012-10-17\",
    \"Statement\": [{
      \"Effect\": \"Allow\",
      \"Action\": [\"s3:PutObject\", \"s3:GetObject\", \"s3:DeleteObject\"],
      \"Resource\": \"arn:aws:s3:::${BUCKET}/*\"
    }]
  }"

echo
echo "Create an access key for the app with:"
echo "  aws iam create-access-key --user-name $APP_USER"
echo "Then put the pair in .env.local and Vercel as AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY."
echo "(Skipped automatically — a key is only shown once, so it should not scroll past in a log.)"

# ---------------------------------------------------------- Lambda IAM role
say "Lambda execution role: $LAMBDA_ROLE"
if aws iam get-role --role-name "$LAMBDA_ROLE" >/dev/null 2>&1; then
  echo "already exists, skipping"
else
  aws iam create-role --role-name "$LAMBDA_ROLE" \
    --assume-role-policy-document '{
      "Version": "2012-10-17",
      "Statement": [{
        "Effect": "Allow",
        "Principal": {"Service": "lambda.amazonaws.com"},
        "Action": "sts:AssumeRole"
      }]
    }' >/dev/null

  # CloudWatch Logs only — the function talks to Supabase over HTTPS and
  # needs no other AWS permissions.
  aws iam attach-role-policy --role-name "$LAMBDA_ROLE" \
    --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole

  echo "waiting for the role to propagate..."
  sleep 10
fi

ROLE_ARN="arn:aws:iam::${ACCOUNT_ID}:role/${LAMBDA_ROLE}"

# ------------------------------------------------------------------ Lambda
say "Packaging the function"
SRC_DIR="$(cd "$(dirname "$0")/digest-lambda" && pwd)"
ZIP="$(mktemp -d)/digest.zip"

if command -v zip >/dev/null 2>&1; then
  (cd "$SRC_DIR" && zip -q -r "$ZIP" index.mjs)
else
  # Git Bash on Windows ships no zip; PowerShell can make the archive instead.
  echo "zip not found, falling back to PowerShell Compress-Archive"
  WIN_SRC="$(cygpath -w "$SRC_DIR/index.mjs" 2>/dev/null || echo "$SRC_DIR/index.mjs")"
  WIN_ZIP="$(cygpath -w "$ZIP" 2>/dev/null || echo "$ZIP")"
  powershell.exe -NoProfile -Command \
    "Compress-Archive -Path '$WIN_SRC' -DestinationPath '$WIN_ZIP' -Force" >/dev/null
fi

[ -s "$ZIP" ] || { echo "failed to build the deployment package"; exit 1; }

# The AWS CLI on Windows is a native binary and cannot resolve Git Bash's
# /tmp/... paths, so hand it a Windows path when one is available.
ZIP_ARG="$(cygpath -w "$ZIP" 2>/dev/null || echo "$ZIP")"
echo "built $ZIP_ARG"

say "Lambda function: $LAMBDA_NAME"
if aws lambda get-function --function-name "$LAMBDA_NAME" >/dev/null 2>&1; then
  aws lambda update-function-code --function-name "$LAMBDA_NAME" \
    --zip-file "fileb://$ZIP_ARG" --no-cli-pager >/dev/null
  echo "code updated"
else
  aws lambda create-function --function-name "$LAMBDA_NAME" \
    --runtime nodejs20.x \
    --handler index.handler \
    --role "$ROLE_ARN" \
    --zip-file "fileb://$ZIP_ARG" \
    --timeout 60 \
    --memory-size 256 \
    --no-cli-pager >/dev/null
  echo "created"
fi

cat <<EOF

The function still needs its secrets. Run this yourself so the service-role
key is never pasted into a chat or a shared log:

  aws lambda update-function-configuration \\
    --function-name $LAMBDA_NAME \\
    --environment "Variables={SUPABASE_URL=https://YOUR-REF.supabase.co,SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY}"

The service-role key is in Supabase under Project Settings -> API. It bypasses
row-level security, so it belongs only here and never in the app or the repo.
EOF

# ------------------------------------------------------------- EventBridge
say "EventBridge schedule: $RULE_NAME (Mondays 13:00 UTC)"
aws events put-rule --name "$RULE_NAME" \
  --schedule-expression "cron(0 13 ? * MON *)" \
  --description "Weekly SetSwipe digest" \
  --no-cli-pager >/dev/null

LAMBDA_ARN="arn:aws:lambda:${REGION}:${ACCOUNT_ID}:function:${LAMBDA_NAME}"

aws events put-targets --rule "$RULE_NAME" \
  --targets "Id=1,Arn=${LAMBDA_ARN}" --no-cli-pager >/dev/null

# Idempotent: adding the same statement id twice is an error, so ignore it.
aws lambda add-permission --function-name "$LAMBDA_NAME" \
  --statement-id "${RULE_NAME}-invoke" \
  --action lambda:InvokeFunction \
  --principal events.amazonaws.com \
  --source-arn "arn:aws:events:${REGION}:${ACCOUNT_ID}:rule/${RULE_NAME}" \
  --no-cli-pager >/dev/null 2>&1 || echo "invoke permission already present"

say "Done"
cat <<EOF
Bucket   : $BUCKET
App user : $APP_USER  (create an access key, see above)
Lambda   : $LAMBDA_NAME
Schedule : $RULE_NAME

Test the digest once the environment variables are set:
  aws lambda invoke --function-name $LAMBDA_NAME /dev/stdout

Tail its logs:
  aws logs tail /aws/lambda/$LAMBDA_NAME --follow
EOF
