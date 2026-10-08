describe("notification log instance ownership", () => {
  let main, logs;

  beforeEach(async () => {
    main = (await lumine.packages.activatePackage("notifications")).mainModule;
    lumine.notifications.clear();
    jasmine.attachToDOM(lumine.views.getView(lumine.workspace));
    lumine.notifications.addInfo("owned log row");
    logs = [];
  });

  afterEach(async () => {
    for (const log of logs) {
      const pane = lumine.workspace.paneForItem(log);
      if (pane) await pane.destroyItem(log, true);
      else log.destroy();
    }
  });

  function createLog(state) {
    const log = main.createLog(state);
    logs.push(log);
    return log;
  }

  it("keeps only its own live rows through real close and reopen cycles", async () => {
    const retired = [];
    for (let turn = 0; turn < 3; turn++) {
      const log = createLog();
      await lumine.workspace.open(log, { activatePane: false });
      expect(log.list.childElementCount).toBe(1);
      expect(log.logItems.length).toBe(1);
      expect(log.logItems.some((item) => retired.includes(item))).toBe(false);
      const own = log.logItems.slice();
      await lumine.workspace.paneForItem(log).destroyItem(log, true);
      expect(log.logItems).toEqual([]);
      for (const item of own) expect(item.getElement().parentElement).toBeNull();
      retired.push(...own);
    }
  });

  it("does not clear a newer log or destroy its rows when an older model closes", () => {
    const older = createLog();
    const current = createLog();
    const currentRows = current.logItems.slice();
    older.destroy();

    expect(main.notificationsLog).toBe(current);
    expect(current.logItems).toEqual(currentRows);
    expect(current.list.childElementCount).toBe(1);
    expect(currentRows.every((item) => item.getElement().parentElement === current.list)).toBe(
      true,
    );
  });

  it("emits one close and destroys its rows once even if cleanup repeats", () => {
    const log = createLog();
    const closed = jasmine.createSpy("log closed");
    log.onDidDestroy(closed);
    const row = log.logItems[0];
    spyOn(row, "destroy").and.callThrough();
    log.destroy();
    log.destroy();

    expect(closed).toHaveBeenCalledTimes(1);
    expect(row.destroy).toHaveBeenCalledTimes(1);
  });

  it("releases the exact parent subscriptions when a real pane closes", async () => {
    const owner = main.subscriptions;
    const before = owner.disposables.size;
    const log = createLog();
    await lumine.workspace.open(log, { activatePane: false });
    await lumine.workspace.paneForItem(log).destroyItem(log, true);

    expect(owner.disposables.size).toBe(before);
    expect(main.notificationsLog).toBeNull();
  });

  it("does not add rows to a destroyed log", () => {
    const log = createLog();
    log.destroy();
    log.addNotification(lumine.notifications.addInfo("late notification"));

    expect(log.logItems).toEqual([]);
    expect(log.list.childElementCount).toBe(0);
  });

  it("preserves explicitly restored type filters and their serialization", () => {
    const state = { typesHidden: { info: true, warning: false } };
    const log = createLog(state);

    expect(log.list.classList.contains("hide-info")).toBe(true);
    expect(log.serialize().typesHidden).toEqual(state.typesHidden);
    log.toggleType("info", true);
    expect(log.list.classList.contains("hide-info")).toBe(false);
    expect(log.serialize().typesHidden.info).toBe(false);
  });
});
