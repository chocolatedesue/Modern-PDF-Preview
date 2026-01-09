#!/bin/bash

# Load environment variables
if [ -f .env ]; then
  export $(cat .env | xargs)
fi

# VS Code Marketplace
if [ -z "$VSCE_PAT" ]; then
  echo "Error: VSCE_PAT is not set in .env file."
  exit 1
fi


echo "Publishing to VS Code Marketplace..."
# Uses @vscode/vsce from devDependencies
npx vsce publish -p "$VSCE_PAT" "$@"

# Open VSX Registry
if [ -n "$OVSX_TOKEN" ]; then
  echo "Publishing to Open VSX Registry..."
  npx ovsx publish -p "$OVSX_TOKEN" "$@"
else
  echo "Warning: OVSX_TOKEN is not set. Skipping Open VSX publish."
fi
