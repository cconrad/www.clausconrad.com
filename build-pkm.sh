# Clone dendron-personal into pkm
git clone --depth 1 git@github.com:cconrad/dendron-personal.git pkm
# Delete directories except assets
find pkm -maxdepth 1 -not -name 'assets' -not -name pkm -type d -exec rm -r {} \;
# Delete files except r.*
find pkm -maxdepth 1 -not -name 'r.*' -type f -exec rm {} \;
# Delete files except with frontmatter published: true
grep -L "^published: true$" pkm/*.md | xargs rm
# TODO Change Dendron links to regular MD links
# See <https://regexr.com/768ul>
# npx dendron exportPod --podId dendron.markdown --wsRoot pkm
# Assign layout
cat << EOF > ./pkm/pkm.11tydata.js
module.exports = function () {
  return {
    layout: "test.njk",
    // permalink: "blog/{{title | slugify}}/",
    tags: ["pkm"]
  };
};
EOF
npx @11ty/eleventy
