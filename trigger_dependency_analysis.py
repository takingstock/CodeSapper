import sys
import re

def parse_diff_file(diff_file):
    changes = []
    current_file = None

    with open(diff_file, 'r') as file:
        for line in file:
            print('DUMMS->', line)
            if line.startswith('diff --git'):
                current_file = re.search(r'b/(.*)', line).group(1)
            if line.startswith('@@') and current_file is not None and '.py' in current_file:
                line_numbers = re.search(r'@@ -(\d+),\d+ \+(\d+),\d+ @@', line)
                start_line = int(line_numbers.group(2))
                changes.append({
                    'file': current_file,
                    'line': start_line
                })
    print('ANALYSIS->', changes)
    return changes

def main():
    if len(sys.argv) != 2:
        print("Usage: python analyze_changes.py <diff_file>")
        sys.exit(1)

    diff_file = sys.argv[1]
    changes = parse_diff_file(diff_file)

    for change in changes:
        print(f"File: {change['file']}, Line: {change['line']}")

if __name__ == "__main__":
    main()

