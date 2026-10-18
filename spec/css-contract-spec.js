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

  it("restores the original error colors and lighter details in light and dark UI palettes", () => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    const context = canvas.getContext("2d");
    const pixels = (color) => {
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = color;
      context.fillRect(0, 0, 1, 1);
      return Array.from(context.getImageData(0, 0, 1, 1).data);
    };
    // Reference values from the palette before the overlay-tint change.
    for (const palette of [
      {
        text: "hsl(0, 90%, 56%)",
        stripe: "hsl(5, 72%, 56%)",
        body: "hsl(5, 72%, 81%)",
        foreground: "hsl(0, 90%, 16%)",
        code: "hsl(5, 67%, 74%)",
        overlay: "white",
      },
      {
        text: "hsl(9, 100%, 64%)",
        stripe: "hsl(5, 64%, 50%)",
        body: "hsl(5, 64%, 75%)",
        foreground: "hsl(9, 100%, 24%)",
        code: "hsl(5, 59%, 68%)",
        overlay: "black",
      },
    ]) {
      container.style.setProperty("--text-color-error", palette.text);
      container.style.setProperty("--background-color-error", palette.stripe);
      container.style.setProperty("--overlay-background-color", palette.overlay);
      for (const status of ["fatal", "error"]) {
        const notification = document.createElement("lumine-notification");
        notification.className = `${status} has-detail`;
        notification.innerHTML =
          '<div class="content"><div class="message item">Error</div><div class="detail item"><code>Details</code></div></div>';
        container.appendChild(notification);
        const content = getComputedStyle(notification.querySelector(".content"));
        expect(pixels(content.backgroundColor)).toEqual(pixels(palette.body));
        expect(pixels(content.color)).toEqual(pixels(palette.foreground));
        expect(
          pixels(getComputedStyle(notification.querySelector("code")).backgroundColor),
        ).toEqual(pixels(palette.code));
        expect(getComputedStyle(notification.querySelector(".detail")).backgroundColor).toBe(
          "rgba(255, 255, 255, 0.3)",
        );
      }
    }
  });

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
