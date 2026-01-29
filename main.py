import re
import shutil
from pathlib import Path

from marimo._server.export.exporter import Exporter, get_html_contents

OKGREEN = "\033[92m"
OKBLUE = "\033[94m"
ENDC = "\033[0m"


HTML_TEMPLATE = r"""
<!DOCTYPE html><html>
<head>
\1
<script data-marimo="true">window.__MARIMO_ENTRYPOINT_URL__ = "\2"</script>
\3
<script src="https://docs.getgrist.com/grist-plugin-api.js"></script>
<script src="https://cdn.jsdelivr.net/npm/lz-string@1.5.0/libs/lz-string.min.js"></script>
<script src="grist.js" defer></script>
<marimo-filename hidden>notebook.py</marimo-filename>
<marimo-wasm hidden=""></marimo-wasm>
<marimo-version data-version="0.19.0" hidden></marimo-version>
<style>
.template-nav {
    background: #99999922;
    text-align: center;
}
.template-links-container {
    background: #BBBBBB22;
    display:flex;
    flex-direction: column;
}
</style>
</head>
<body>
<nav>
<details class="template-nav">
<summary>
Load Templates
</summary>
<ul class="template-links-container">
<li><a href="#grist_marimo_template/default">Default template</a></li>
<li><a href="#grist_marimo_template/polars">Polars template</a></li>
<li><a href="#grist_marimo_template/duplicate">Data duplication template</a></li>
</div>
</details>
</nav>
<div style="position:absolute" id="root"></div><div id="portal"></div>
</body></html>
"""

if __name__ == "__main__":
    out_dir = Path("dist")

    # Export assets first
    Exporter().export_assets(out_dir, ignore_index_html=True)

    outfile = out_dir / "index.html"

    html = re.sub(
        r'^.*<head>(.*)<script data-marimo="true">.*<script type="module" crossorigin src="([^"]*)"></script>(.*)</head>.*$',
        HTML_TEMPLATE,
        get_html_contents(),
        flags=re.DOTALL,
    )

    with open(outfile, "w") as f:
        f.write(html)

    shutil.copyfile("grist.js", out_dir / "grist.js")

    print(f"{OKBLUE}Build complete !{ENDC}")
    print(f"Widget ready at {OKGREEN}{str(outfile)}{ENDC}")
