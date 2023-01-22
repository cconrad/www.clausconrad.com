# Build www.clausconrad.com

[![Netlify Status](https://api.netlify.com/api/v1/badges/7fa0cae1-5c3a-4f12-beae-1ca61a3da0d1/deploy-status)](https://app.netlify.com/sites/cconrad/deploys)

1. On push to the repository containing my personal Dendron notes or my Eleventy blog, a workflow in those repositories triggers a repository dispatch event in this repository.
2. The workflow in this repository then checks out all three repositories.
3. The Python script in this repository copies the publishable notes to the checkout of the blog, changing frontmatter and body (content) to make them suitable for Eleventy.
4. The blog, including the notes, is then built using Eleventy and deployed to production at Netlify using their CLI.
