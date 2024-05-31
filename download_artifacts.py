import requests, json, os
import numpy as np

REPO_OWNER="AmyGB-ai"
REPO_NAME="IKG"
ARTIFACT_NAME="generated-files"
GITHUB_TOKEN="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"
WORKFLOW_ID="analyze_changes.yml"

def download( run_id ):

def main():
    if len(sys.argv) != 2:
        print("Usage: python download_artifacts.py <run_id>")
        sys.exit(1)

    run_id = sys.argv[1]
    download( run_id )

