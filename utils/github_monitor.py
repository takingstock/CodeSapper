# github_monitor.py
import os
import time
import requests
import json, traceback

import logging
from logging.handlers import TimedRotatingFileHandler
import sys
import os
import trigger_downstream

GITHUB_TOKEN = os.getenv('GITHUB_TOKEN')
REPO_OWNER = "AmyGB-ai" 
REPO_NAME = "IKG"
ARTIFACT_NAME = 'generated-files'
CHECK_INTERVAL = 10  # Check every 2 minutes
local_path = '/datadrive/IKG/utils/'
#local_path = os.getenv('GITHUB_MON_PATH')
RUN_ID_FILE = local_path + '/last_run_id.txt'
OUTPUT_DIR = local_path + '/downloaded_artifacts'
# Define a custom stream handler to redirect print statements

# Set up the logging configuration
log_dir = '/log_directory/'
log_file = 'github_monitor.log'
log_path = os.path.join( local_path + log_dir, log_file)

# Configure the TimedRotatingFileHandler
logger = logging.getLogger('GitHubMonitor')
logger.setLevel(logging.INFO)
handler = TimedRotatingFileHandler(log_path, when='midnight', interval=1, backupCount=7)
handler.suffix = "%Y-%m-%d"
formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
handler.setFormatter(formatter)
logger.addHandler(handler)

class StreamToLogger:
    def __init__(self, logger, log_level=logging.INFO):
        self.logger = logger
        self.log_level = log_level
        self.linebuf = ''

    def write(self, buf):
        for line in buf.rstrip().splitlines():
            self.logger.log(self.log_level, line.rstrip())

    def flush(self):
        pass

# Redirect stdout and stderr to the logger
sys.stdout = StreamToLogger(logger, logging.INFO)
sys.stderr = StreamToLogger(logger, logging.ERROR)

def get_latest_successful_run_id():
    url = f'https://api.github.com/repos/{REPO_OWNER}/{REPO_NAME}/actions/runs'
    headers = {'Authorization': f'token {GITHUB_TOKEN}'}
    response = requests.get(url, headers=headers)
    runs = response.json().get('workflow_runs', [])
    for run in runs:
        if run['conclusion'] == 'success':
            return run['id']
    return None

def get_artifact_url(run_id):
    url = f'https://api.github.com/repos/{REPO_OWNER}/{REPO_NAME}/actions/runs/{run_id}/artifacts'
    headers = {'Authorization': f'token {GITHUB_TOKEN}'}
    response = requests.get(url, headers=headers)
    artifacts = response.json().get('artifacts', [])

    for artifact in artifacts:
        if artifact['name'] == ARTIFACT_NAME:
            return artifact['archive_download_url']
    return None

def download_artifact(artifact_url):
    headers = {'Authorization': f'token {GITHUB_TOKEN}'}
    response = requests.get(artifact_url, headers=headers)
    artifact_path = os.path.join(OUTPUT_DIR, 'generated-files.zip')

    print('GOIN TO WRITE->', artifact_path)
    with open(artifact_path, 'wb') as f:
        print('IN WITH SCOPE->', artifact_path)
        f.write(response.content)
    return artifact_path

def extract_artifact(artifact_path):
    import zipfile

    with zipfile.ZipFile(artifact_path, 'r') as zip_ref:
        zip_ref.extractall(OUTPUT_DIR)

def main():

    while True:
        try:
            latest_run_id = get_latest_successful_run_id()
            if latest_run_id is None:
                print("No successful runs found. Retrying...")
                time.sleep(CHECK_INTERVAL)
                continue
            elif latest_run_id is not None:
                print('Extracted latest_run_id->', latest_run_id)

            if os.path.exists(RUN_ID_FILE):
                with open(RUN_ID_FILE, 'r') as f:
                    last_run_id = f.read().strip()
            else:
                last_run_id = None

            if str(latest_run_id) != last_run_id:
                artifact_url = get_artifact_url(latest_run_id)
                if artifact_url:
                    print(f"New artifact found. Downloading from {artifact_url}")
                    artifact_path = download_artifact(artifact_url)
                    extract_artifact(artifact_path)
                    with open(RUN_ID_FILE, 'w') as f:
                        f.write(str(latest_run_id))
                    print(f"Artifact downloaded and extracted successfully.", os.getenv('DAEMON_CONFIG'))

                    ## now trigger graph traversal for all the changes
                    with open( os.getenv('DAEMON_CONFIG'), 'r' ) as fp:
                        cfg = json.load( fp )

                    trigger_downstream.start( cfg['python']['git_change_summary_file'] )
                else:
                    print("No artifact found for the latest successful run.")
            else:
                print("No new successful runs. Retrying...")

        except Exception as e:
            print(f"An error occurred: {e}", traceback.format_exc())

        time.sleep(CHECK_INTERVAL)
        #break

if __name__ == '__main__':
    main()

