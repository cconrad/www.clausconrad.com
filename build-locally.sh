#!/usr/bin/env bash

# Check out notes
git clone git@github.com:cconrad/obsidian-personal.git

# Install Python dependencies
pip install -r requirements.txt

# Clean up
rm -rf cconrad.github.io

# Check out blog
git clone git@github.com:cconrad/cconrad.github.io.git

# Install node dependencies
cd cconrad.github.io && npm install

# Transform notes
cd .. && python3.11 build-pkm.py

# Build site
cd cconrad.github.io && npm run build

# Test site
cd .. && python3.11 -m http.server --directory cconrad.github.io/_site
