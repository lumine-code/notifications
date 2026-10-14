const path = require("path");

describe("notifications in editor windows", () => {
  let main, logs;

  beforeEach(async () => {
    jasmine.useRealClock();
    await lumine.packages.deactivatePackage("notifications");
    lumine.notifications.clear();
    jasmine.attachToDOM(lumine.workspace.getElement());
    main = (await lumine.packages.activatePackage(path.join(__dirname, ".."))).mainModule;
    logs = [];
  });

  afterEach(async () => {
    for (const log of logs) log.destroy();
    await lumine.packages.deactivatePackage("notifications");
    lumine.notifications.clear();
    await lumine.workspace.discardEditorWindows();
  });

  it("places an explicit warning and its buttons in the owning window", async () => {
    const workspace = lumine.workspace;
    const extra = await workspace.openEditorWindow({ show: false });
    const save = jasmine.createSpy("save");
    const cancel = jasmine.createSpy("cancel");
    const notification = lumine.notifications.addWarning("Save the example before running it.", {
      window: extra,
      dismissable: true,
      buttons: [
        { text: "Save", onDidClick: save },
        { text: "Cancel", onDidClick: cancel },
      ],
    });
    const view = lumine.views.getView(notification);

    expect(view.element.ownerDocument).toBe(extra.getDocument());
    expect(extra.getElement().querySelector("lumine-notifications").contains(view.element)).toBe(
      true,
    );
    expect(workspace.getElement().contains(view.element)).toBe(false);
    expect(lumine.views.getView(notification)).toBe(view);
    view.element.querySelectorAll(".btn-toolbar .btn")[1].click();
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(save).not.toHaveBeenCalled();
  });

  it("keeps default notifications in main even when another window holds focus", async () => {
    const workspace = lumine.workspace;
    const extra = await workspace.openEditorWindow({ show: false });
    spyOn(workspace, "getFocusedWindow").and.returnValue(extra);
    const notification = lumine.notifications.addInfo("Default notification.", {
      dismissable: true,
    });
    const element = lumine.views.getView(notification).element;

    expect(element.ownerDocument).toBe(workspace.getMainWindow().getDocument());
    expect(main.notificationsElement.contains(element)).toBe(true);
    expect(extra.getElement().querySelector("lumine-notifications")).toBeNull();
  });

  it("shows the same informational message independently in different windows", async () => {
    const workspace = lumine.workspace;
    const extra = await workspace.openEditorWindow({ show: false });
    const Notification = require("lumine").Notification;
    const local = new Notification("warning", "The file cannot be saved.", {
      dismissable: true,
    });
    const remote = new Notification("warning", "The file cannot be saved.", {
      window: extra,
      dismissable: true,
    });
    local.timestamp = remote.timestamp = new Date(0);

    lumine.notifications.addNotification(local);
    lumine.notifications.addNotification(remote);

    expect(main.notificationsElement.contains(lumine.views.getView(local).element)).toBe(true);
    expect(extra.getElement().contains(lumine.views.getView(remote).element)).toBe(true);
    const log = main.createLog();
    logs.push(log);
    expect(log.logItems.map((item) => item.notification)).toEqual([local, remote]);
  });

  it("keeps an immediately repeated decision reachable after the previous one is cancelled", () => {
    const Notification = require("lumine").Notification;
    const options = {
      dismissable: true,
      buttons: [{ text: "Save", onDidClick: jasmine.createSpy("save") }],
    };
    const first = new Notification("warning", "Save the file before running it.", options);
    const second = new Notification("warning", "Save the file before running it.", options);
    first.timestamp = second.timestamp = new Date(0);
    lumine.notifications.addNotification(first);
    first.dismiss();

    lumine.notifications.addNotification(second);

    const view = lumine.views.getView(second);
    expect(main.notificationsElement.contains(view.element)).toBe(true);
    expect(view.element.classList.contains("remove")).toBe(false);
    view.element.querySelector(".btn-toolbar .btn").click();
    expect(options.buttons[0].onDidClick).toHaveBeenCalledTimes(1);
    const log = main.createLog();
    logs.push(log);
    expect(log.logItems.map((item) => item.notification)).toEqual([first, second]);
  });

  it("restores the same view locally and falls back to main after its window closes", async () => {
    const workspace = lumine.workspace;
    const extra = await workspace.openEditorWindow({ show: false });
    const log = main.createLog();
    logs.push(log);
    const notification = lumine.notifications.addWarning("Window-owned notification.", {
      window: extra,
      dismissable: true,
    });
    const view = lumine.views.getView(notification);
    const root = view.element.parentElement;
    notification.dismiss();
    log.logItems[0].getElement().click();
    expect(view.element.parentElement).toBe(root);
    expect(view.element.classList.contains("remove")).toBe(false);

    await workspace.attachWindow(extra);

    expect(main.windowRoots.has(extra)).toBe(false);
    expect(root.parentElement).toBeNull();
    expect(notification.isDismissed()).toBe(true);
    log.logItems[0].getElement().click();
    expect(lumine.views.getView(notification)).toBe(view);
    expect(view.element.ownerDocument).toBe(workspace.getMainWindow().getDocument());
    expect(view.element.parentElement).toBe(main.notificationsElement);
    expect(notification.isDismissed()).toBe(false);
    expect(main.windowRoots.has(extra)).toBe(false);
  });

  it("removes every window root when the package deactivates", async () => {
    const workspace = lumine.workspace;
    const extra = await workspace.openEditorWindow({ show: false });
    const local = lumine.notifications.addInfo("Main window notification.", { dismissable: true });
    const remote = lumine.notifications.addInfo("Other window notification.", {
      window: extra,
      dismissable: true,
    });
    const dismissed = jasmine.createSpy("notification dismissed");
    local.onDidDismiss(dismissed);
    remote.onDidDismiss(dismissed);
    const roots = [...main.windowRoots.values()].map((record) => record.element);

    await lumine.packages.deactivatePackage("notifications");

    expect(roots.every((element) => element.parentElement == null)).toBe(true);
    expect(local.isDismissed()).toBe(true);
    expect(remote.isDismissed()).toBe(true);
    expect(dismissed).toHaveBeenCalledTimes(2);
    expect(main.windowRoots).toBeNull();
    await workspace.attachWindow(extra);
    expect(main.windowRoots).toBeNull();
  });
});
