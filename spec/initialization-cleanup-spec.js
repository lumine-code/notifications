describe("Notifications recovery bootstrap", () => {
  let pack, log;

  beforeEach(async () => {
    if (lumine.packages.isPackageLoaded("notifications"))
      await lumine.packages.unloadPackage("notifications", { serialize: false });
    pack = lumine.packages.loadPackage("notifications");
    pack.requireMainModule();
    pack.initializeForExternalUse("workspace restoration");
  });

  afterEach(async () => {
    if (lumine.packages.isPackageLoaded("notifications"))
      await lumine.packages.unloadPackage("notifications", { serialize: false });
    log?.destroy();
    log = null;
  });

  it("unloads before its notification observers have activated", async () => {
    expect(pack.mainActivated).toBe(false);
    await expectAsync(
      lumine.packages.unloadPackage("notifications", { serialize: false }),
    ).toBeResolved();
  });

  it("destroys a log restored before activation when the package unloads", async () => {
    log = pack.mainModule.createLog({ typesHidden: ["info"] });
    const destroy = spyOn(log, "destroy").and.callThrough();
    await expectAsync(
      lumine.packages.unloadPackage("notifications", { serialize: false }),
    ).toBeResolved();
    expect(destroy).toHaveBeenCalled();
  });
});
