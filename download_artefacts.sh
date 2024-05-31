# Replace these variables with your values
REPO_OWNER="AmyGB-ai"
REPO_NAME="IKG"
ARTIFACT_NAME="generated-files"
GITHUB_TOKEN="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"
WORKFLOW_ID="analyze_changes.yml"
# Fetch the latest successful workflow run ID
RUN_ID=$(curl -H "Authorization: token $GITHUB_TOKEN" \
  "https://api.github.com/repos/$REPO_OWNER/$REPO_NAME/actions/workflows/$WORKFLOW_ID/runs?status=success" \
  | jq -r ".workflow_runs[0].id")

if [ -z "$RUN_ID" ]; then
  echo "No successful runs found for the workflow."
  exit 1
fi

echo "LATEST RUN ID->$RUN_ID"

# Fetch the artifact URL
ARTIFACT_URL=$(curl -H "Authorization: token $GITHUB_TOKEN" \
  "https://api.github.com/repos/$REPO_OWNER/$REPO_NAME/actions/runs/$RUN_ID/artifacts" \
  | jq -r ".artifacts[] | select(.name==\"$ARTIFACT_NAME\") | .archive_download_url")

# Download the artifact
echo $ARTIFACT_URL
curl -L -H "Authorization: token $GITHUB_TOKEN" -o $ARTIFACT_NAME.zip $ARTIFACT_URL

# Unzip the artifact
unzip $ARTIFACT_NAME.zip -d ./local-directory
