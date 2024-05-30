import sys
import re

def parse_diff_file(diff_file):
    changes = []
    current_file = None
    hunk_info = None

    with open(diff_file, 'r') as file:
        for line in file:
            print('DUMM->', line)
            if line.startswith('diff --git'):
                current_file = re.search(r'b/(.*)', line).group(1)
            elif line.startswith('@@') and current_file is not None and '.py' in current_file:
                hunk_info = re.search(r'@@ -(\d+),(\d+) \+(\d+),(\d+) @@', line)
                if hunk_info is not None:
                    old_start = int(hunk_info.group(1))
                    old_length = int(hunk_info.group(2))
                    new_start = int(hunk_info.group(3))
                    new_length = int(hunk_info.group(4))
                    hunk_data = {
                        'file': current_file,
                        'old_start': old_start,
                        'old_length': old_length,
                        'new_start': new_start,
                        'new_length': new_length,
                        'old_code': [],
                        'new_code': []
                    }
                    changes.append(hunk_data)
            elif line.startswith('-') and hunk_info and current_file is not None and '.py' in current_file:
                hunk_data['old_code'].append(line[1:].strip())
            elif line.startswith('+') and hunk_info and current_file is not None and '.py' in current_file:
                hunk_data['new_code'].append(line[1:].strip())

    print('FINAL CHANGE->', changes)
    return changes

def main():
    if len(sys.argv) != 2:
        print("Usage: python analyze_changes.py <diff_file>")
        sys.exit(1)

    diff_file = sys.argv[1]
    changes = parse_diff_file(diff_file)

    for change in changes:
        print(f"File: {change['file']}")
        print(f"Old code starts at line {change['old_start']} with length {change['old_length']}:")
        print("\n".join(change['old_code']))
        print(f"New code starts at line {change['new_start']} with length {change['new_length']}:")
        print("\n".join(change['new_code']))
        print("-" * 80)

if __name__ == "__main__":
    main()

