/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS205: Consider reworking code to avoid use of IIFEs
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/main/docs/suggestions.md
 */
const { Notification, CompositeDisposable } = require("lumine");
const fs = require("@lumine-code/fs-plus");
const isDuplicateNotification = require("./is-duplicate-notification");
let StackTraceParser = null;
let NotificationElement = null;
let NotificationsLog = null;

const NOTIFICATIONS_LOG_URI = "lumine://notifications/log";

function getNotificationElement() {
  if (NotificationElement == null) NotificationElement = require("./notification-element");
  return NotificationElement;
}

function getNotificationsLog() {
  if (NotificationsLog == null) NotificationsLog = require("./notifications-log");
  return NotificationsLog;
}

const Notifications = {
  provideBackgroundTips() {
    return {
      packageName: "notifications",
      tips: [
        "{% if keys['notifications:toggle-log'] %}You can reread every notification you have dismissed with {{ 'notifications:toggle-log' | keystroke }}{% else %}Every notification you dismiss is kept in the notifications log, so nothing is lost.{% endif %}",
      ],
    };
  },

  isInitialized: false,
  subscriptions: null,
  duplicateTimeDelay: 500,
  lastNotification: null,
  windowRoots: null,

  activate() {
    let notification;
    const CommandLogger = require("./command-logger");
    this.subscriptions = new CompositeDisposable();
    this.windowRoots = new Map();
    this.subscriptions.add(CommandLogger.start());

    for (notification of Array.from(lumine.notifications.getNotifications())) {
      this.addNotificationView(notification);
    }
    this.subscriptions.add(
      lumine.notifications.onDidAddNotification((notification) =>
        this.addNotificationView(notification),
      ),
    );

    this.subscriptions.add(
      lumine.runtime.onWillThrowError(function ({
        message,
        url,
        line,
        originalError,
        preventDefault,
      }) {
        let match;
        if (originalError.name === "BufferedProcessError") {
          message = message.replace("Uncaught BufferedProcessError: ", "");
          return lumine.notifications.addError(message, { dismissable: true });
        } else if (originalError.code === "ENOENT" && (match = /spawn (.+) ENOENT/.exec(message))) {
          message = `\
'${match[1]}' could not be spawned.
Is it installed and on your path?
If so please open an issue on the package spawning the process.\
`;
          return lumine.notifications.addError(message, { dismissable: true });
        } else if (
          !lumine.window.isDevMode() ||
          lumine.config.get("notifications.showErrorsInDevMode")
        ) {
          preventDefault();

          // Ignore errors with no paths in them since they are impossible to trace
          if (originalError.stack && !isCoreOrPackageStackTrace(originalError.stack)) {
            return;
          }

          const options = {
            detail: `${url}:${line}`,
            stack: originalError.stack,
            dismissable: true,
          };
          return lumine.notifications.addFatalError(message, options);
        }
      }),
    );

    this.subscriptions.add(
      lumine.commands.add("lumine-workspace", "core:cancel", () =>
        (() => {
          const result = [];
          for (notification of Array.from(lumine.notifications.getNotifications())) {
            result.push(notification.dismiss());
          }
          return result;
        })(),
      ),
    );

    this.subscriptions.add(
      lumine.config.observe("notifications.defaultTimeout", (value) => {
        return (this.visibilityDuration = value);
      }),
    );

    if (lumine.window.isDevMode()) {
      this.subscriptions.add(
        lumine.commands.add("lumine-workspace", "notifications:trigger-error", {
          description: "Raise a test error, to see how one is reported.",
          didDispatch: function () {
            try {
              // eslint-disable-next-line no-undef -- intentional ReferenceError to exercise the error notification
              return abc + 2;
            } catch (error) {
              const options = {
                detail: error.stack.split("\n")[1],
                stack: error.stack,
                dismissable: true,
              };
              return lumine.notifications.addFatalError(
                `Uncaught ${error.stack.split("\n")[0]}`,
                options,
              );
            }
          },
        }),
      );
    }

    if (this.notificationsLog != null) {
      this.addNotificationsLogSubscriptions();
    }
    this.subscriptions.add(
      lumine.workspace.addOpener((uri) => {
        if (uri === NOTIFICATIONS_LOG_URI) {
          return this.createLog();
        }
      }),
    );
    this.subscriptions.add(
      lumine.commands.add("lumine-workspace", "notifications:toggle-log", {
        description: "Show or hide the log of notifications already shown.",
        didDispatch: () => lumine.workspace.toggle(NOTIFICATIONS_LOG_URI),
      }),
    );
    return this.subscriptions.add(
      lumine.commands.add("lumine-workspace", "notifications:clear-log", {
        description: "Forget the notifications the log is holding.",
        didDispatch: function () {
          for (notification of Array.from(lumine.notifications.getNotifications())) {
            notification.options.dismissable = true;
            notification.dismissed = false;
            notification.dismiss();
          }
          return lumine.notifications.clear();
        },
      }),
    );
  },

  deactivate() {
    this.subscriptions.dispose();
    for (const record of this.windowRoots.values()) {
      record.subscription.dispose();
      for (const notification of record.notifications) notification.dismiss();
      record.element.remove();
    }
    this.windowRoots.clear();
    if (this.notificationsPanel != null) {
      this.notificationsPanel.destroy();
    }
    if (this.notificationsLog != null) {
      this.notificationsLog.destroy();
    }

    this.subscriptions = null;
    this.notificationsElement = null;
    this.notificationsPanel = null;
    this.notificationsLog = null;
    this.lastNotification = null;
    this.windowRoots = null;

    return (this.isInitialized = false);
  },

  initializeIfNotInitialized() {
    if (this.isInitialized) {
      return;
    }

    this.subscriptions.add(
      lumine.views.addViewProvider(Notification, (model) => {
        const Element = getNotificationElement();
        return new Element(model, this.visibilityDuration);
      }),
    );

    this.notificationsElement = this.ensureWindowRoot(lumine.workspace.getMainWindow()).element;

    return (this.isInitialized = true);
  },

  notificationWindow(notification) {
    const window = notification.getOptions().window;
    if (
      window &&
      !window.isDestroyed() &&
      window.getWorkspace() === lumine.workspace &&
      window.getDocument() &&
      window.getElement()
    ) {
      return window;
    }
    return lumine.workspace.getMainWindow();
  },

  ensureWindowRoot(window) {
    const roots = this.windowRoots;
    let record = roots.get(window);
    if (record) return record;
    const element = window.getDocument().createElement("lumine-notifications");
    window.getElement().appendChild(element);
    record = { element, notifications: new Set() };
    record.subscription = window.onWillDestroy(() => {
      if (this.windowRoots !== roots) return;
      roots.delete(window);
      record.subscription.dispose();
      for (const notification of record.notifications) {
        lumine.views.getView(notification).removeNotification();
        notification.dismiss();
      }
      record.element.remove();
    });
    roots.set(window, record);
    return record;
  },

  appendNotificationView(notification, view = lumine.views.getView(notification)) {
    const record = this.ensureWindowRoot(this.notificationWindow(notification));
    record.notifications.add(notification);
    record.element.appendChild(view.element);
  },

  createLog(state) {
    const Log = getNotificationsLog();
    this.notificationsLog = new Log(
      this.duplicateTimeDelay,
      state != null ? state.typesHidden : undefined,
    );
    if (this.subscriptions != null) {
      this.addNotificationsLogSubscriptions();
    }
    return this.notificationsLog;
  },

  addNotificationsLogSubscriptions() {
    const log = this.notificationsLog;
    const owner = this.subscriptions;
    const subscriptions = new CompositeDisposable(
      log.onDidDestroy(() => {
        if (this.notificationsLog === log) this.notificationsLog = null;
        owner.remove(subscriptions);
        subscriptions.dispose();
      }),
      log.onItemClick((notification) => {
        if (this.subscriptions !== owner || owner.disposed || log.isDestroyed()) return;
        const view = lumine.views.getView(notification);
        view.makeDismissable();

        if (!view.element.classList.contains("remove")) {
          return;
        }
        view.restoreNotification();
        this.appendNotificationView(notification, view);
        notification.dismissed = false;
        return notification.setDisplayed(true);
      }),
    );
    owner.add(subscriptions);
    return subscriptions;
  },

  addNotificationView(notification) {
    if (notification == null || !this.subscriptions || this.subscriptions.disposed) {
      return;
    }
    this.initializeIfNotInitialized();
    if (notification.wasDisplayed()) {
      return;
    }

    if (!isDuplicateNotification(notification, this.lastNotification, this.duplicateTimeDelay)) {
      this.appendNotificationView(notification);
      if (this.notificationsLog != null) {
        this.notificationsLog.addNotification(notification);
      }
    }

    notification.setDisplayed(true);
    return (this.lastNotification = notification);
  },
};

var isCoreOrPackageStackTrace = function (stack) {
  if (StackTraceParser == null) {
    StackTraceParser = require("stacktrace-parser");
  }
  for (var { file } of Array.from(StackTraceParser.parse(stack))) {
    if (file === "<embedded>" || fs.isAbsolute(file)) {
      return true;
    }
  }
  return false;
};

module.exports = Notifications;
