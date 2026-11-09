const os = require("os");
const { BufferedProcess } = require("lumine");

describe("notification system information", () => {
  let utilities;

  beforeEach(async () => {
    await lumine.packages.activatePackage("notifications");
    utilities = require("../lib/user-utilities");
    spyOn(os, "version").and.returnValue("Windows 11 Pro");
    spyOn(os, "release").and.returnValue("10.0.26100");
    // The legacy implementation must fail without launching a real host probe.
    spyOn(BufferedProcess.prototype, "start").and.callFake(function () {
      queueMicrotask(() => {
        this.stdout("OS Name: Legacy systeminfo label\r\n");
        this.exit(0);
      });
    });
  });

  it("returns the Windows edition and build through its Promise API without a child process", async () => {
    const result = utilities.winVersionText();

    expect(result instanceof Promise).toBe(true);
    expect(await result).toBe("Windows 11 Pro 10.0.26100");
    expect(os.version).toHaveBeenCalledTimes(1);
    expect(os.release).toHaveBeenCalledTimes(1);
    expect(BufferedProcess.prototype.start).not.toHaveBeenCalled();
  });

  it("routes Windows OS information through the same native edition and release values", async () => {
    spyOn(utilities, "getPlatform").and.returnValue("win32");
    spyOn(utilities, "winVersionText").and.callThrough();
    os.version.and.returnValue("Windows Server 2025 Datacenter");

    expect(await utilities.getOSVersion()).toBe("Windows Server 2025 Datacenter 10.0.26100");
    expect(utilities.winVersionText).toHaveBeenCalledTimes(1);
    expect(BufferedProcess.prototype.start).not.toHaveBeenCalled();
  });
});
