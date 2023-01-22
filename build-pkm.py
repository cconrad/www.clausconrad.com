import datetime
import os
import re
import frontmatter


def convert_dendron_link_to_markdown(match_object):
    groups = match_object.groups()
    return "[" + (groups[0] if groups[0] else groups[1]) + "](../" + groups[1] + "/)"


# Copy files that start with "r." and have frontmatter "published: true"
for pathlike_file in [
    f
    for f in os.scandir("dendron-personal")
    if f.is_file() and f.name.startswith("r.") and f.name.endswith(".md")
]:
    post = frontmatter.load(pathlike_file)
    if post.get("published") == True:
        created = post.get("created")
        if created:
            created = datetime.datetime.fromtimestamp(created / 1000).isoformat()
            post["date"] = created
            del post["created"]
        updated = post.get("updated")
        if updated:
            updated = datetime.datetime.fromtimestamp(updated / 1000).isoformat()
            post["updated"] = updated
        del post["id"], post["published"]
        # Change Dendron links to regular MD links
        #
        # Remember - there are 3-5 types - this only converts the first two ones correctly:
        # [[a.b.c]]
        # [[link title|a.b.c]]
        # [[dendron://vault/a.b.c]]
        # [[link title|dendron://vault/a.b.c]]
        # @a.b.c
        post.content = re.sub(
            r"\[\[" + r"([^\s\0|]*?)" + r"\|?" + r"([^ \s\0|]+)" + r"\]\]",
            convert_dendron_link_to_markdown,
            post.content,
        )
        frontmatter.dump(
            post, os.path.join("cconrad.github.io/content/notes/", pathlike_file.name)
        )
        print(f"Wrote {pathlike_file.name}")

# TODO Replace broken (unpublished) links with something

# TODO Replace lang.XX tags with flag

# TODO Respect frontmatter "noindex: true"

# TODO Copy related assets
