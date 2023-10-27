#!/usr/bin/env bash

# Clean up
rm -rf obsidian-personal
rm -rf cconrad.github.io

# Check out notes
git clone --depth=1 --branch=main git@github.com:cconrad/obsidian-personal.git

# Install Python dependencies
pip install -r requirements.txt

# Check out blog
git clone --depth=1 --branch=main git@github.com:cconrad/cconrad.github.io.git

# Install node dependencies
npm install --prefix cconrad.github.io

# Transform notes
python3.11 build-pkm.py

# Build site
npm run build --prefix cconrad.github.io

# Test site
python3.11 -m http.server --directory cconrad.github.io/_site
