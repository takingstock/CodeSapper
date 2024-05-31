import sys, os

def main():
    if len(sys.argv) != 2:
        print("Usage: python download_artefacts.py <run_id>")
        sys.exit(1)

    diff_file = sys.argv[1]
    print('THOR RUNN IDDD->', diff_file)
