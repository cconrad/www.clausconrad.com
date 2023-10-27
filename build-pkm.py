import datetime
import os
import re
import frontmatter


def convert_obsidian_link_to_markdown(match_object):
    groups = match_object.groups()
    return "[" + (groups[2] if groups[2] else groups[0]) + "](../" + groups[0] + "/" + ('#' + groups[1] if groups[1] else '') + ")"


# Copy files that start with "r." and have frontmatter "published: true"
for pathlike_file in [
    f
    for f in os.scandir("obsidian-personal")
    if f.is_file()
    and not f.name.startswith("daily.journal.")
    and not f.name.startswith("user.")
    and f.name.endswith(".md")
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

        # If title is not set explicitly, set title to first alias (if exists)
        if not post.get("title"):
            aliases = post.get("aliases")
            if aliases:
                if isinstance(aliases, list) and len(aliases) > 0:
                    post["title"] = aliases[0]
                elif isinstance(aliases, str) and len(aliases) > 0:
                    post["title"] = aliases
                else:
                    continue
        
        # Remove forgotten IDs from Dendron times
        if post.get("id"):
            del post["id"]

        del post["published"]

        # Change Obsidian links to regular MD links
        #
        # Remember - there are these types - this only converts the first two ones correctly:
        # [[a.b.c]]
        # [[a.b.c|link title]]
        # [link title](obsidian://open?vault=VAULTNAME&file=a%2F%b%2Fc)
        # [link title](obsidian://vault/VAULTNAME/a.b.c)
        # <a href="obsidian://vault/VAULTNAME/a.b.c">link title</a>
        post.content = re.sub(
            r"(?<!!)\[\[([a-zA-ZÀ-ÿ0-9-'?%.():&,+\/€! ]+)#?([a-zA-ZÀ-ÿ0-9-'?%.():&,+\/€! ]+)?\|?([a-zA-ZÀ-ÿ0-9-'?%.():&,+\/€! ]+)?\]\]",
            convert_obsidian_link_to_markdown,
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
