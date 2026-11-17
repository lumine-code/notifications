const { Notification } = require("lumine");

describe("notification log scrollbar navigation", () => {
  let log, bind;

  beforeEach(async () => {
    const main = (await lumine.packages.activatePackage("notifications")).mainModule;
    main.initializeIfNotInitialized();
    lumine.notifications.clear();
    bind = spyOn(lumine.scrollbars, "bindNavigation").and.callThrough();
    const NotificationsLog = require("../lib/notifications-log");
    log = new NotificationsLog(0);
    jasmine.attachToDOM(log.element);
  });

  afterEach(() => log.destroy());

  it("focuses and navigates the visible list without taking over filter buttons", () => {
    expect(bind).toHaveBeenCalledOnceWith(log.list);
    expect(log.list.tabIndex).toBe(-1);
    const focus = spyOn(log.list, "focus");
    log.element.dispatchEvent(new FocusEvent("focus"));
    expect(focus).not.toHaveBeenCalled();
    log.addNotification(new Notification("info", "An existing log entry"));
    log.element.dispatchEvent(new FocusEvent("focus"));
    expect(focus).toHaveBeenCalledOnceWith({ preventScroll: true });
    const reveal = spyOn(lumine.scrollbars, "reveal");
    lumine.commands.dispatch(log.list, "core:page-down");
    expect(reveal).toHaveBeenCalledOnceWith(log.list);
    reveal.calls.reset();
    lumine.commands.dispatch(log.element.querySelector("button"), "core:page-down");
    log.addNotification(new Notification("warning", "A newly arriving log entry"));
    expect(reveal).not.toHaveBeenCalled();
  });

  it("releases the list navigation owner when the log closes", () => {
    const binding = bind.calls.mostRecent().returnValue;
    log.destroy();
    expect(binding.disposed).toBeTrue();
    expect(log.list.hasAttribute("data-lumine-scroll-navigation")).toBeFalse();
  });
});
