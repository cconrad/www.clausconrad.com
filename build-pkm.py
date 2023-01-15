import os
import shutil
import subprocess
import frontmatter

# Clean up from previous run (for local testing)
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

# grep -L "^published: true$" pkm/*.md | xargs rm
# # TODO Change Dendron links to regular MD links
# # See <https://regexr.com/768ul>
# # npx dendron exportPod --podId dendron.markdown --wsRoot pkm
# # Assign layout
# cat << EOF > ./pkm/pkm.11tydata.js
# module.exports = function () {
#   return {
#     layout: "test.njk",
#     // permalink: "blog/{{title | slugify}}/",
#     tags: ["pkm"]
#   };
# };
# EOF
# npx @11ty/eleventy
