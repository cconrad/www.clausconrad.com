# Build www.clausconrad.com

1. On push to the default branch of `cconrad/dendron-personal` (personal notes) or `cconrad/cconrad.github.io` (Eleventy blog), a workflow in those repositories should trigger a repository dispatch event in this one (`cconrad/www.clausconrad.com`).
2. The workflow in this repository then checks out itself and the two repositories mentioned above.
3. The workflow in this repository then copies the personal notes that should be published to the checkout of the blog, changing frontmatter and body (content) to make them readable by Eleventy.
4. The blog, including the notes, is then built using the workflow in this repository and deployed to production at Netlify.
