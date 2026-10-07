const fs = require("fs");
const path = require("path");

describe("Notification status foreground pairs", () => {
  let stylesheet, container;
  beforeEach(() => {
    stylesheet = lumine.styles.addStyleSheet(
      fs.readFileSync(path.join(__dirname, "../styles/notifications.css"), "utf8"),
      { priority: 1000 },
    );
    container = document.createElement("lumine-notifications");
    jasmine.attachToDOM(container);
  });
  afterEach(() => stylesheet.dispose());

  it("lets each diagnostic background and its readable foreground control the icon stripe", () => {
    for (const status of ["error", "warning", "info", "success"]) {
      container.style.setProperty(`--background-color-${status}`, "rgb(240, 240, 240)");
      container.style.setProperty(`--text-color-on-${status}`, "rgb(10, 20, 30)");
      const notification = document.createElement("lumine-notification");
      notification.className = `icon ${status}`;
      container.appendChild(notification);
      const stripe = getComputedStyle(notification, "::before");
      expect(stripe.backgroundColor).toBe("rgb(240, 240, 240)");
      expect(stripe.color).toBe("rgb(10, 20, 30)");
    }
  });
});
