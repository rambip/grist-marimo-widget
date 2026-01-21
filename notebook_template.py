# /// script
# [tool.marimo.display]
# theme = "system"
# ///

import marimo

__generated_with = "0.19.0"
app = marimo.App(width="medium")

with app.setup(hide_code=True):
    # Don't touch ! This cell will be overwritten each time
    # the grist data is updated.
    GRIST_DATA_PATH = "data.json"


@app.function(hide_code=True)
def send_grist_actions(actions):
    from marimo._messaging.notification import UIElementMessageNotification
    from marimo._messaging.serde import serialize_kernel_message
    from marimo._runtime.context import get_context

    if len(actions) == 0:
        return
    assert isinstance(actions[0], list) or isinstance(actions[0], tuple), (
        "You must provide a list of actions"
    )

    # 1. Wrap your data in a valid Marimo notification
    msg = UIElementMessageNotification(
        ui_element="grist",  # Use this as your ID
        model_id=None,
        message={"actions": actions},
    )

    # 2. Serialize it to the strict bytes format Marimo expects
    kernel_msg = serialize_kernel_message(msg)

    # 3. Write to the stream
    get_context().stream.write(kernel_msg)


@app.cell()
def _():
    import pandas as pd

    return (pd,)


@app.cell()
def _(pd):
    df = pd.read_json(GRIST_DATA_PATH)
    df
