import os
import shutil
import subprocess
import frontmatter

# Local testing: Clean up from previous run
try:
    shutil.rmtree("dendron-personal")
    shutil.rmtree("cconrad.github.io")
except FileNotFoundError:
    pass

# Clone PKM repo
subprocess.run(
    ["git", "clone", "--depth", "1", "git@github.com:cconrad/dendron-personal.git"],
    check=True,
)

# Clone blog repo
subprocess.run(
    ["git", "clone", "--depth", "1", "git@github.com:cconrad/cconrad.github.io.git"],
    check=True,
)

# Make temporary directory for PKM files that should be published
os.mkdir("cconrad.github.io/content/pkm")

# Copy files that start with "r." and have frontmatter "published: true"
for pathlike_file in [f for f in os.scandir("dendron-personal") if f.is_file() and f.name.startswith("r.") and f.name.endswith(".md")]:
    post = frontmatter.load(pathlike_file)
    if post.get("published"):
        shutil.copy(pathlike_file, "cconrad.github.io/content/pkm/")

# TODO Change Dendron links to regular MD links
# See <https://regexr.com/768ul>
#
# Remember - there are 3-5 types:
# [[a.b.c]]
# [[link title|a.b.c]]
# [[dendron://vault/a.b.c]]
# [[link title|dendron://vault/a.b.c]]
# @a.b.c
# 
# Alternative: npx dendron exportPod --podId dendron.markdown --wsRoot pkm

# TODO Replace broken (unpublished) links with something

# TODO Replace lang.XX tags with flag

# TODO Respect frontmatter "noindex: true"

# TODO In the rendering template, include:
#   - "link" from frontmatter
#   - Last updated
#   - (Maybe) Reading time

# TODO Copy assets

# # For testing only: Assign layout
# cat << EOF > ./pkm/pkm.11tydata.js
# module.exports = function () {
#   return {
#     layout: "test.njk",
#     // permalink: "blog/{{title | slugify}}/",
#     tags: ["pkm"]
#   };
# };
# EOF

# Final build
# npx @11ty/eleventy
