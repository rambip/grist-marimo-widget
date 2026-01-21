const bridge = window._marimo_private_PyodideBridge;
bridge.rpc.addMessageListener("kernelMessage", ({ message }) => {
  const data = JSON.parse(message)["data"];
  console.log(`DATA:`);
  console.log(data);
  if (data["op"] == "send-ui-element-message") {
    if (data["ui_element"] == "grist") {
      const m = data["message"];
      grist.docApi.applyUserActions(m["actions"]);
    }
  }
});

grist.ready({ requiredAccess: "full" });

grist.onOptions(async (options, settings) => {
  const access = settings.accessLevel;
  if (access == "none") {
    console.log("no access to document");
    await bridge.sendRun({
      cellIds: ["setup"],
      codes: [
        `raise ValueError("This widget does not have the permission to read the table. Please change the widget permissions")`,
      ],
    });
  }
});
grist.onRecords(async (table) => {
  console.log("TABLE:");
  console.log(table);

  await bridge.sendUpdateFile({
    path: "/marimo/data.json",
    contents: JSON.stringify(table),
  });

  await bridge.sendRun({
    cellIds: ["setup"],
    codes: [`GRIST_DATA_PATH = "data.json"`],
  });
});
