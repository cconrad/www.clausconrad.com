import subprocess
import frontmatter

subprocess.run(
    [
        "git",
        "clone",
        "--depth",
        "1",
        "git@github.com:cconrad/dendron-personal.git",
        "pkm",
    ],
    check=True,
)
