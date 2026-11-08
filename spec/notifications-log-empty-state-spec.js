const { Notification } = require("lumine");

describe("Notifications Log empty state", () => {
  let log;

  beforeEach(async () => {
    const main = (await lumine.packages.activatePackage("notifications")).mainModule;
    main.initializeIfNotInitialized();
    lumine.notifications.clear();
    const NotificationsLog = require("../lib/notifications-log");
    const typesHidden = Object.fromEntries(
      ["fatal", "error", "warning", "info", "success", "hint"].map((type) => [type, false]),
    );
    log = new NotificationsLog(0, typesHidden);
    jasmine.attachToDOM(log.element);
  });

  afterEach(() => log.destroy());

  it("moves between empty, populated and filtered states without removing its controls or rows", () => {
    const header = log.element.querySelector("header");
    const clear = header.querySelector(".notifications-clear-log");
    expect(log.empty.hidden).toBeFalse();
    expect(log.empty.textContent).toBe("No notifications");
    expect(log.list.hidden).toBeTrue();
    const info = log.addNotification(new Notification("info", "Information"));
    expect(log.empty.hidden).toBeTrue();
    expect(log.list.hidden).toBeFalse();
    log.toggleType("info", false);
    expect(log.empty.hidden).toBeFalse();
    expect(log.empty.textContent).toBe("No matching notifications");
    expect(log.list.children.length).toBe(1);
    const warning = log.addNotification(new Notification("warning", "Warning"));
    expect(log.empty.hidden).toBeTrue();
    log.toggleType("warning", false);
    expect(log.empty.hidden).toBeFalse();
    log.toggleType("info", true);
    expect(log.empty.hidden).toBeTrue();
    expect(log.list.contains(info)).toBeTrue();
    expect(log.list.contains(warning)).toBeTrue();
    expect(log.element.querySelector("header")).toBe(header);
    expect(header.querySelector(".notifications-clear-log")).toBe(clear);
    lumine.notifications.clear();
    expect(log.list.children.length).toBe(0);
    expect(log.empty.hidden).toBeFalse();
    expect(log.empty.textContent).toBe("No notifications");
  });

  it("disposes populated state and ignores notification or filter updates after destruction", () => {
    log.addNotification(new Notification("info", "Information"));
    const element = log.element;
    log.destroy();
    expect(element.isConnected).toBeFalse();
    expect(log.list.children.length).toBe(0);
    expect(log.logItems).toEqual([]);
    expect(log.addNotification(new Notification("warning", "Late warning"))).toBeUndefined();
    expect(log.toggleType("info", false)).toBeUndefined();
    lumine.notifications.clear();
    expect(log.logItems).toEqual([]);
  });
});
