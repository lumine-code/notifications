/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS206: Consider reworking classes to avoid initClass
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
let NotificationsLog;
const { Emitter, CompositeDisposable, Disposable } = require("lumine");
const NotificationsLogItem = require("./notifications-log-item");
const isDuplicateNotification = require("./is-duplicate-notification");

const typeIcons = {
  fatal: "bug",
  error: "flame",
  warning: "alert",
  info: "info",
  success: "check",
  hint: "light-bulb",
};

module.exports = NotificationsLog = (function () {
  NotificationsLog = class NotificationsLog {
    static initClass() {
      this.prototype.subscriptions = null;
      this.prototype.typesHidden = {
        fatal: false,
        error: false,
        warning: false,
        info: false,
        success: false,
        hint: false,
      };
    }

    constructor(duplicateTimeDelay, typesHidden = null) {
      this.duplicateTimeDelay = duplicateTimeDelay;
      this.logItems = [];
      this.destroyed = false;
      if (typesHidden != null) {
        this.typesHidden = typesHidden;
      }
      this.emitter = new Emitter();
      this.subscriptions = new CompositeDisposable();
      this.subscriptions.add(
        lumine.notifications.onDidClearNotifications(() => this.clearLogItems()),
      );
      this.render();
      this.subscriptions.add(new Disposable(() => this.clearLogItems()));
    }

    render() {
      let button;
      this.element = document.createElement("div");
      this.element.classList.add("notifications-log", "tab-content-separated");

      const header = document.createElement("header");
      this.element.appendChild(header);

      this.list = document.createElement("ul");
      this.list.classList.add("notifications-log-items");
      this.element.appendChild(this.list);
      this.empty = document.createElement("div");
      this.empty.className = "panel-empty-state";
      const tips = document.createElement("background-tips");
      const message = document.createElement("ul");
      message.className = "centered background-message";
      this.emptyMessage = document.createElement("li");
      message.append(this.emptyMessage);
      tips.append(message);
      this.empty.append(tips);
      this.element.append(this.empty);

      for (var type in typeIcons) {
        var icon = typeIcons[type];
        button = document.createElement("button");
        button.classList.add("notification-type", "btn", "icon", `icon-${icon}`, type);
        button.classList.toggle("show-type", !this.typesHidden[type]);
        this.list.classList.toggle(`hide-${type}`, this.typesHidden[type]);
        button.dataset.type = type;
        button.addEventListener("click", (e) => this.toggleType(e.target.dataset.type));
        this.subscriptions.add(
          lumine.tooltips.add(button, { title: `Toggle ${type} notifications` }),
        );
        header.appendChild(button);
      }

      button = document.createElement("button");
      button.classList.add("notifications-clear-log", "btn", "icon", "icon-trashcan");
      button.addEventListener("click", (_e) =>
        lumine.commands.dispatch(lumine.views.getView(lumine.workspace), "notifications:clear-log"),
      );
      this.subscriptions.add(lumine.tooltips.add(button, { title: "Clear notifications" }));
      header.appendChild(button);

      let lastNotification = null;
      for (var notification of Array.from(lumine.notifications.getNotifications())) {
        if (!isDuplicateNotification(notification, lastNotification, this.duplicateTimeDelay)) {
          this.addNotification(notification);
        }

        lastNotification = notification;
      }
      this.updateEmptyState();

      return this.subscriptions.add(new Disposable(() => this.element.remove()));
    }

    destroy() {
      if (this.destroyed) return;
      this.destroyed = true;
      this.subscriptions.dispose();
      try {
        return this.emitter.emit("did-destroy");
      } finally {
        this.emitter.dispose();
      }
    }

    isDestroyed() {
      return this.destroyed;
    }

    getElement() {
      return this.element;
    }

    getURI() {
      return "lumine://notifications/log";
    }

    getTitle() {
      return "Log";
    }

    getLongTitle() {
      return "Notifications Log";
    }

    getIconName() {
      return "bell";
    }

    getDefaultLocation() {
      return "bottom";
    }

    getAllowedLocations() {
      return ["bottom"];
    }

    serialize() {
      return {
        typesHidden: this.typesHidden,
        deserializer: "notifications/NotificationsLog",
      };
    }

    toggleType(type, force) {
      if (this.destroyed) return;
      const button = this.element.querySelector(`.notification-type.${type}`);
      const hide = !button.classList.toggle("show-type", force);
      this.list.classList.toggle(`hide-${type}`, hide);
      this.typesHidden[type] = hide;
      this.updateEmptyState();
      return hide;
    }

    updateEmptyState() {
      if (this.destroyed) return;
      const visible = this.logItems.some((item) => !this.typesHidden[item.notification.getType()]);
      this.list.hidden = !visible;
      this.empty.hidden = visible;
      this.emptyMessage.textContent = this.logItems.length
        ? "No matching notifications"
        : "No notifications";
    }

    addNotification(notification) {
      if (this.destroyed) return;
      const logItem = new NotificationsLogItem(notification);
      logItem.onClick(() => this.emitter.emit("item-clicked", notification));
      this.logItems.push(logItem);
      const element = this.list.insertBefore(logItem.getElement(), this.list.firstChild);
      this.updateEmptyState();
      return element;
    }

    onItemClick(callback) {
      return this.emitter.on("item-clicked", callback);
    }

    onDidDestroy(callback) {
      return this.emitter.on("did-destroy", callback);
    }

    clearLogItems() {
      const items = this.logItems;
      this.logItems = [];
      for (var logItem of items) {
        logItem.destroy();
      }
      this.updateEmptyState();
      return this.logItems;
    }
  };
  NotificationsLog.initClass();
  return NotificationsLog;
})();
