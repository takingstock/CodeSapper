import os
import sys

def analyze_changes(file_list):
    for file_name in file_list:
        if file_name.endswith('.py'):
            print(f"Analyzing {file_name}")
            with open(file_name, 'r') as file:
                lines = file.readlines()
                for i, line in enumerate(lines):
                    if 'def ' in line:
                        method_name = line.split('def ')[1].split('(')[0].strip()
                        with open( 'DUMB.txt', 'w+' ) as fp:
                          fp.write("Found method: {+"method_name"+} in file: {+"file_name"+}\n")

                        # Add your logic here to handle the method and file name
                        # For example, you can call another function or perform some analysis
                        # ...

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python analyze_changes.py <changed_files.txt>")
        sys.exit(1)

    changed_files_path = sys.argv[1]

    if not os.path.exists(changed_files_path):
        print(f"File {changed_files_path} does not exist.")
        sys.exit(1)

    with open(changed_files_path, 'r') as file:
        changed_files = [line.strip() for line in file.readlines()]

    analyze_changes(changed_files)

