import shutil
from pathlib import Path
from typing import Callable, Optional

import click
from marimo._cli.print import echo, green
from marimo._server.export import (
    ExportResult,
    export_as_wasm,
)
from marimo._server.export.exporter import Exporter
from marimo._utils.marimo_path import MarimoPath
from marimo._utils.paths import maybe_make_dirs


def watch_and_export(
    marimo_path: MarimoPath,
    output: Optional[Path],
    export_callback: Callable[[MarimoPath], ExportResult],
    force: bool,
) -> None:
    def write_data(data: str) -> None:
        if output:
            # Make dirs if needed
            maybe_make_dirs(output)
            output.write_text(data, encoding="utf-8")
        else:
            echo(data)
        return

    result = export_callback(marimo_path)
    write_data(result.contents)
    if result.did_error:
        raise click.ClickException(
            "Export was successful, but some cells failed to execute."
        )


if __name__ == "__main__":
    name = "notebook_template.py"

    out_dir = Path("dist")
    filename = "index.html"
    ignore_index_html = False

    marimo_file = MarimoPath(name)

    def export_callback(file_path: MarimoPath) -> ExportResult:
        return export_as_wasm(file_path, mode="edit", show_code=True)

    # Export assets first
    Exporter().export_assets(out_dir, ignore_index_html=ignore_index_html)

    # Create .nojekyll file to prevent GitHub Pages from interfering with asset
    # resolution
    (Path(out_dir) / ".nojekyll").touch()

    echo(
        f"Assets copied to {green(str(out_dir))}. These assets are required for the "
        "notebook to run in the browser."
    )

    did_export_public = Exporter().export_public_folder(out_dir, marimo_file)
    if did_export_public:
        echo(
            f"The public folder next to your notebook was copied to "
            f"{green(str(out_dir))}."
        )

    echo(
        "To run the exported notebook, use:\n"
        f"  python -m http.server --directory {out_dir}\n"
        "Then open the URL that is printed to your terminal."
    )

    outfile = out_dir / filename

    watch_and_export(MarimoPath(name), outfile, export_callback, force=True)

    with open(outfile, "r") as f:
        modified = f.read().replace(
            "</head>",
            ' <script src="https://docs.getgrist.com/grist-plugin-api.js"></script><script src="grist.js" defer></script>\n</head>',
        )
    with open(outfile, "w") as f:
        f.write(modified)

    shutil.copyfile("grist.js", out_dir / "grist.js")
