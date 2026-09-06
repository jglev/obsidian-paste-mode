#!/bin/bash

# Script to copy icons from individual-icons to individual-icons/dark
# and add a dark mode style filter to each copy

ICONS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SOURCE_DIR="$ICONS_DIR/individual-icons"
DEST_DIR="$ICONS_DIR/individual-icons/dark"

# Ensure destination directory exists
mkdir -p "$DEST_DIR"

# Find all files in individual-icons, excluding the dark subdirectory
find "$SOURCE_DIR" -maxdepth 1 -type f | while read -r file; do
    filename=$(basename "$file")
    dest_file="$DEST_DIR/$filename"
    
    # Copy the file
    cp "$file" "$dest_file"
    
    # Insert the style tag after the closing > of the <svg tag
    # Use Python for reliable multi-line pattern matching
    python3 << EOF
import re
with open('$dest_file', 'r') as f:
    content = f.read()

# Find the first occurrence of the <svg tag closing > and insert style after it
pattern = r'(<svg[^>]*>)'
replacement = r'\1\n  <style>svg {filter: invert(1) !important;}</style>'
content = re.sub(pattern, replacement, content, count=1, flags=re.DOTALL)

with open('$dest_file', 'w') as f:
    f.write(content)
EOF
    
    echo "Processed: $filename"
done

echo "Icons copied and styled successfully!"
