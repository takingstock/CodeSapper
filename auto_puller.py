import os
import subprocess
import trigger_dependency_analysis

def is_git_repo(path):
    """Check if a given path is a Git repository."""
    return os.path.isdir(os.path.join(path, '.git'))

def run_git_pull(path):
    """Run git pull in the given directory."""
    os.chdir(path)  # Change to the directory
    result = subprocess.run(['git', 'pull'], capture_output=True, text=True)
    return result.stdout, result.stderr

def run_git_diff(path):
    """Run git diff between the last two commits."""
    os.chdir(path)  # Change to the directory
    result = subprocess.run(['git', 'diff', 'HEAD^..HEAD'], capture_output=True, text=True)
    return result.stdout, result.stderr

def main(directories, output_file):
    """Perform git pull and git diff in each directory and aggregate results into one file."""
    with open(output_file, 'w') as f:
        for directory in directories:
            if is_git_repo(directory):
                print(f"Processing Git repository: {directory}")

                # Perform git pull
                print(f"Performing git pull in: {directory}")
                pull_stdout, pull_stderr = run_git_pull(directory)
                #f.write(f"Output of git pull in {directory}:\n{pull_stdout}\n")
                #if pull_stderr:
                #    f.write(f"Errors during git pull in {directory}:\n{pull_stderr}\n")

                # Perform git diff
                print(f"Performing git diff in: {directory}")
                diff_stdout, diff_stderr = run_git_diff(directory)
                f.write(f"Output of git diff in {directory}:\n{diff_stdout}\n")
                if diff_stderr:
                    f.write(f"Errors during git diff in {directory}:\n{diff_stderr}\n")
            else:
                print(f"Not a Git repository: {directory}")

if __name__ == "__main__":
    # List of directories to check
    dirs_to_check = [
        '/datadrive/IMPACT_ANALYSIS/IKG/',
        '/datadrive/IMPACT_ANALYSIS/IKG/code_db/idp-frontend/',
        '/datadrive/IMPACT_ANALYSIS/IKG/code_db/idp_backend'
        # Add more directories as needed
    ]
    # File to aggregate all the changes
    output_file = '/datadrive/IMPACT_ANALYSIS/LOCAL_TEST/local-directory/aggregated_changes.txt'
    import time
    snooze_ = 120 # 2 mins
    while True:
        main(dirs_to_check, output_file)

        ## now call trigger dependency analysis
        print('CALLING DEP ANALYSIS=>')
        trigger_dependency_analysis.main( output_file )

        time.sleep( snooze_ )
