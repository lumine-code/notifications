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

  it("keeps dismiss actions as readable as their notification message", () => {
    for (const status of ["fatal", "error", "warning", "info", "success", "hint"]) {
      const notification = document.createElement("lumine-notification");
      notification.className = `${status} has-close`;
      notification.innerHTML =
        '<div class="content">Message</div><div class="close">Close</div><div class="close-all btn btn-error">Close All</div>';
      container.appendChild(notification);
      const foreground = getComputedStyle(notification.querySelector(".content")).color;
      for (const action of notification.querySelectorAll(".close, .close-all")) {
        expect(getComputedStyle(action).color).withContext(status).toBe(foreground);
        expect(getComputedStyle(action).opacity).withContext(status).toBe("1");
      }
    }
  });

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
