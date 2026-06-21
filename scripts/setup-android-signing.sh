#!/bin/bash
# Setup Android signing for GitHub Actions
# Run this script locally, then add the output values as GitHub Secrets

set -e

KEYSTORE_FILE="release.keystore"
KEY_ALIAS="bikebinder"
KEYSTORE_PASSWORD=$(openssl rand -base64 12 | tr -d '/+=' | cut -c1-16)
KEY_PASSWORD=$KEYSTORE_PASSWORD
VALIDITY_DAYS=10000

echo "=== Generating Android keystore ==="
echo ""

# Generate keystore
keytool -genkey -v \
  -keystore "$KEYSTORE_FILE" \
  -alias "$KEY_ALIAS" \
  -keyalg RSA \
  -keysize 2048 \
  -validity "$VALIDITY_DAYS" \
  -storepass "$KEYSTORE_PASSWORD" \
  -keypass "$KEY_PASSWORD" \
  -dname "CN=BikeBinder, OU=Development, O=BikeBinder, L=Unknown, ST=Unknown, C=US"

echo ""
echo "=== Keystore generated: $KEYSTORE_FILE ==="
echo ""

# Base64 encode
BASE64=$(base64 < "$KEYSTORE_FILE")

echo "==========================================="
echo "Add these secrets to your GitHub repository:"
echo "==========================================="
echo ""

echo "Secret: ANDROID_KEYSTORE_BASE64"
echo "Value: (copy the entire block below)"
echo ""
echo "$BASE64"
echo ""
echo "---"
echo "Secret: ANDROID_KEYSTORE_PASSWORD"
echo "Value: $KEYSTORE_PASSWORD"
echo ""
echo "Secret: ANDROID_KEY_ALIAS"
echo "Value: $KEY_ALIAS"
echo ""
echo "Secret: ANDROID_KEY_PASSWORD"
echo "Value: $KEY_PASSWORD"
echo ""
echo "==========================================="
echo ""
echo "Keep $KEYSTORE_FILE safe — you'll need it for"
echo "updating the app on Google Play Console."
echo ""
echo "To add secrets to GitHub:"
echo "1. Go to your repo on GitHub"
echo "2. Settings > Secrets and variables > Actions"
echo "3. Add each secret above"
echo "==========================================="
