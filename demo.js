// Authentic package usage. Run with lumine/script/demo.js; fixtures stay in demo/.
module.exports = {
  version: 1,
  dependencies: ["tree-view", "language-json", "folder-sync"],
  viewport: { width: 1150, height: 520 },
  async before() {},
  async prepare(context) {
    const { lumine, state, fixture, open, project } = context;
    const fs = require("node:fs");
    const config = JSON.parse(fs.readFileSync(fixture("sync-source/.sync"), "utf8"));
    config.name = "sync-output";
    delete config.target;
    lumine.config.set("folder-sync.storagePath", project);
    fs.mkdirSync(fixture("sync-output"), { recursive: true });
    fs.writeFileSync(fixture("sync-source/.sync"), JSON.stringify(config, null, 2));
    state.editor = await open("sync-source/.sync");
    await lumine.project.setPaths([fixture("sync-source")]);
  },
  scenes: [
    {
      id: "scene-1",
      file: "demo.png",
      caption: "Read the real completion notification after synchronizing a project folder.",
      timeout: 60000,
      allowNotifications: true,
      async run(context) {
        const { lumine, state, waitFor } = context;
        {
          lumine.commands.dispatch(state.editor.getElement(), "tree-view:reveal-active-file");
          await new Promise((resolve) => setTimeout(resolve, 800));
        }
        {
          await lumine.packages.getActivePackage("folder-sync").mainModule.run();
        }
        for (const notice of lumine.notifications.getNotifications()) {
          if (notice.message === "Folder sync started...") notice.dismiss();
        }
        await waitFor(
          () => !document.querySelector("lumine-notification.hint"),
          "completed synchronization without the progress notice",
        );
      },
      ready(context) {
        const { fixture, project } = context;
        const visibleText = document.body.innerText;
        return Boolean(
          require("fs").existsSync(fixture("sync-output/samples.csv")) &&
          document
            .querySelector("lumine-notification.success")
            ?.innerText.includes("Folder synced") &&
          !visibleText.includes(project) &&
          !/[a-z]:[\\/]/i.test(visibleText),
        );
      },
    },
  ],
  async cleanup() {},
};
