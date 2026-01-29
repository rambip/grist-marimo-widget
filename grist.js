// ============================================================================
// MARIMO-GRIST WIDGET INTEGRATION
// ============================================================================

const GRIST_OPTION_KEY = "marimo_code";

const SETUP_CODE = `
GRIST_DATA_PATH = "data.json"

def send_grist_actions(actions):
    from marimo._messaging.notification import UIElementMessageNotification
    from marimo._messaging.serde import serialize_kernel_message
    from marimo._runtime.context import get_context
    from marimo import ui

    if len(actions) == 0:
        return
    assert isinstance(actions[0], list) or isinstance(actions[0], tuple), (
        "You must provide a list of actions"
    )

    msg = UIElementMessageNotification(
        ui_element="grist",
        model_id=None,
        message={"actions": actions},
    )

    kernel_msg = serialize_kernel_message(msg)
    ctx = get_context()
    return ui.run_button(
        label="update grist table",
        on_change=lambda x: ctx.stream.write(kernel_msg)
    )
`;

const NOTEBOOK_BASE = `# /// script
# requires-python = ">=3.11"
# dependencies = [
#     "pandas",
#     "matplotlib",
#     "polars",
# ]
# ///

import marimo

__generated_with = "0.19.0"
app = marimo.App(width="medium")

with app.setup(hide_code=True):
    # Don't touch ! This cell will be overwritten each time
    # the grist data is updated.
    ${SETUP_CODE.split("\n").join("\n    ")}
`;

// Default empty notebook template
const POLARS_NOTEBOOK = `${NOTEBOOK_BASE}
@app.cell()
def _():
    import polars as pl
    import json
    return (pd,json)


@app.cell()
def _(pd):
    with open(GRIST_DATA_PATH) as f:
        df = pl.DataFrame(json.load(f))
    df
`;

const DEFAULT_NOTEBOOK = `${NOTEBOOK_BASE}
@app.cell()
def _():
    import pandas as pd
    return (pd,)


@app.cell()
def _(pd):
    df = pd.read_json(GRIST_DATA_PATH).set_index("id")
    df
`;

const DATA_DUPLICATION_NOTEBOOK = `${NOTEBOOK_BASE}
@app.cell()
def _():
    import pandas as pd
    return (pd,)


@app.cell()
def _(pd):
    df = pd.read_json(GRIST_DATA_PATH).set_index("id")
    df

@app.cell()
def _(pd, df, send_grist_actions):
    CURRENT_TABLE_NAME = "Table1"
    send_grist_actions([
        ["AddRecord", CURRENT_TABLE_NAME, None, dict(d)] for _, d in df.iterrows()
    ])
`;

const NOTEBOOK_TEMPLATES = {
  default: DEFAULT_NOTEBOOK,
  polars: POLARS_NOTEBOOK,
  duplicate: DATA_DUPLICATION_NOTEBOOK,
};

let bridge = null;
let pendingRecords = null;
let hasTableAccess = false;

// ============================================================================
// MARIMO INITIALIZATION
// ============================================================================

async function initializeMarimo(savedCode) {
  const code = savedCode || DEFAULT_NOTEBOOK;
  localStorage.setItem("marimo:file", JSON.stringify(code));

  // Set marimo mount config with our code
  window.__MARIMO_MOUNT_CONFIG__ = {
    filename: "notebook.py",
    mode: "edit",
    version: "0.19.4",
    serverToken: "unused",
    // code: JSON.stringify(code),
    config: {
      ai: {
        custom_providers: {},
        models: { custom_models: [], displayed_models: [] },
      },
      completion: {
        activate_on_typing: true,
        copilot: false,
        signature_hint_on_typing: false,
      },
      diagnostics: { sql_linter: true },
      display: {
        cell_output: "below",
        code_editor_font_size: 14,
        dataframes: "rich",
        default_table_max_columns: 50,
        default_table_page_size: 10,
        default_width: "medium",
        reference_highlighting: false,
        theme: "system",
      },
      formatting: { line_length: 79 },
      keymap: { overrides: {}, preset: "default" },
      language_servers: {
        pylsp: {
          enable_flake8: false,
          enable_mypy: true,
          enable_pydocstyle: false,
          enable_pyflakes: false,
          enable_pylint: false,
          enable_ruff: true,
          enabled: false,
        },
      },
      mcp: { mcpServers: {}, presets: [] },
      package_management: { manager: "uv" },
      runtime: {
        auto_instantiate: true,
        auto_reload: "off",
        default_sql_output: "auto",
        on_cell_change: "autorun",
        output_max_bytes: 8000000,
        reactive_tests: true,
        std_stream_max_bytes: 1000000,
        watcher_on_save: "lazy",
      },
      save: {
        autosave: "after_delay",
        autosave_delay: 1000,
        format_on_save: false,
      },
      server: { browser: "default", follow_symlink: false },
      snippets: { custom_paths: [], include_default_snippets: true },
    },
    configOverrides: {},
    appConfig: { sql_output: "auto", width: "medium" },
    view: { showAppCode: true },
    notebook: null,
    session: null,
    runtimeConfig: null,
  };

  const script = document.createElement("script");
  script.type = "module";
  script.crossOrigin = "anonymous";
  script.src = window.__MARIMO_ENTRYPOINT_URL__;
  document.head.appendChild(script);

  // Wait for bridge to be available
  console.info("WAIT FOR BRIDGE");
  await waitForBridge();
  bridge.rpc.addMessageListener("kernelMessage", handleKernelMessage);
  console.info("SETUP DONE");

  // Check permissions and show error if needed
  if (!hasTableAccess) {
    console.error("Widget does not have permission to read the table");
    console.log(bridge);
    await bridge.sendRun({
      cellIds: ["setup"],
      codes: [
        'raise ValueError("This widget does not have permission to read the table. Please change the widget permissions")',
      ],
    });
  }

  // Sync any records that arrived before bridge was ready
  if (pendingRecords) {
    console.log("Syncing pending records from initial load...");
    await syncGristData(pendingRecords);
    pendingRecords = null;
  }
}

function waitForBridge() {
  return new Promise((resolve) => {
    const checkBridge = setInterval(() => {
      if (window._marimo_private_PyodideBridge) {
        bridge = window._marimo_private_PyodideBridge;
        clearInterval(checkBridge);
        resolve();
      }
    }, 100);
  });
}

// ============================================================================
// RPC LISTENERS
// ============================================================================

function handleKernelMessage({ message }) {
  const data = JSON.parse(message).data;

  // Handle Grist actions from marimo
  if (data.op === "send-ui-element-message" && data.ui_element === "grist") {
    const actions = data.message.actions;
    grist.docApi.applyUserActions(actions);
  }
}

// ============================================================================
// GRIST DATA SYNC
// ============================================================================

async function syncGristData(records) {
  if (!bridge) {
    console.warn("Bridge not ready, skipping data sync");
    return;
  }

  console.log("Syncing Grist data to marimo...");

  // Write data to pyodide filesystem
  await bridge.sendUpdateFile({
    path: "/marimo/data.json",
    contents: JSON.stringify(records),
  });

  // Run setup cell to update GRIST_DATA_PATH
  await bridge.sendRun({
    cellIds: ["setup"],
    codes: [SETUP_CODE],
  });

  console.log("✓ Data synced successfully");
}

// ============================================================================
// GRIST INTEGRATION
// ============================================================================

grist.ready({
  requiredAccess: "full",
  // TODO: show button to chose notebook template
  onEditOptions: async () => {
    console.warn("options not implemented");
  },
});

// Sync data when table updates
grist.onRecords(async (records) => {
  if (!bridge) {
    console.log("Bridge not ready yet, storing records for later sync...");
    pendingRecords = records;
    return;
  }
  await syncGristData(records);
});

grist.onOptions(async (options, settings) => {
  if (settings.accessLevel != "none") {
    hasTableAccess = true;
  }
});

window.addEventListener("hashchange", async function () {
  const hash = window.location.hash;
  const match_template = hash.match(/\#grist_marimo_template\/(.*)/)?.at(1);
  const match_code = hash.match(/\#code\/(.*)/)?.at(1);
  if (match_template) {
    if (NOTEBOOK_TEMPLATES[match_template] === null) {
      console.error(`template not found: ${match_template}`);
      return;
    }
    await grist.setOption(GRIST_OPTION_KEY, NOTEBOOK_TEMPLATES[match_template]);
    window.location.reload();
  }
  if (match_code) {
    const notebook_code =
      LZString.decompressFromEncodedURIComponent(match_code);
    grist.setOption(GRIST_OPTION_KEY, notebook_code);
  }
});

async function init() {
  const options = await grist.getOptions();
  const savedCode = (options && options[GRIST_OPTION_KEY]) || null;

  await initializeMarimo(savedCode);
  console.log("Marimo-Grist widget initialized");
}

init();
