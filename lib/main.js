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
let StackTraceParser = null;
const NotificationElement = require("./notification-element");
const NotificationsLog = require("./notifications-log");

const Notifications = {
  isInitialized: false,
  subscriptions: null,
  duplicateTimeDelay: 500,
  lastNotification: null,

  activate(_state) {
    let notification;
    const CommandLogger = require("./command-logger");
    CommandLogger.start();
    this.subscriptions = new CompositeDisposable();

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
        lumine.commands.add("lumine-workspace", "notifications:trigger-error", function () {
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
        }),
      );
    }

    if (this.notificationsLog != null) {
      this.addNotificationsLogSubscriptions();
    }
    this.subscriptions.add(
      lumine.workspace.addOpener((uri) => {
        if (uri === NotificationsLog.prototype.getURI()) {
          return this.createLog();
        }
      }),
    );
    this.subscriptions.add(
      lumine.commands.add("lumine-workspace", "notifications:toggle-log", () =>
        lumine.workspace.toggle(NotificationsLog.prototype.getURI()),
      ),
    );
    return this.subscriptions.add(
      lumine.commands.add("lumine-workspace", "notifications:clear-log", function () {
        for (notification of Array.from(lumine.notifications.getNotifications())) {
          notification.options.dismissable = true;
          notification.dismissed = false;
          notification.dismiss();
        }
        return lumine.notifications.clear();
      }),
    );
  },

  deactivate() {
    this.subscriptions.dispose();
    if (this.notificationsElement != null) {
      this.notificationsElement.remove();
    }
    if (this.notificationsPanel != null) {
      this.notificationsPanel.destroy();
    }
    if (this.notificationsLog != null) {
      this.notificationsLog.destroy();
    }

    this.subscriptions = null;
    this.notificationsElement = null;
    this.notificationsPanel = null;

    return (this.isInitialized = false);
  },

  initializeIfNotInitialized() {
    if (this.isInitialized) {
      return;
    }

    this.subscriptions.add(
      lumine.views.addViewProvider(Notification, (model) => {
        return new NotificationElement(model, this.visibilityDuration);
      }),
    );

    this.notificationsElement = document.createElement("lumine-notifications");
    lumine.views.getView(lumine.workspace).appendChild(this.notificationsElement);

    return (this.isInitialized = true);
  },

  createLog(state) {
    this.notificationsLog = new NotificationsLog(
      this.duplicateTimeDelay,
      state != null ? state.typesHidden : undefined,
    );
    if (this.subscriptions != null) {
      this.addNotificationsLogSubscriptions();
    }
    return this.notificationsLog;
  },

  addNotificationsLogSubscriptions() {
    this.subscriptions.add(
      this.notificationsLog.onDidDestroy(() => {
        return (this.notificationsLog = null);
      }),
    );
    return this.subscriptions.add(
      this.notificationsLog.onItemClick((notification) => {
        const view = lumine.views.getView(notification);
        view.makeDismissable();

        if (!view.element.classList.contains("remove")) {
          return;
        }
        view.element.classList.remove("remove");
        this.notificationsElement.appendChild(view.element);
        notification.dismissed = false;
        return notification.setDisplayed(true);
      }),
    );
  },

  addNotificationView(notification) {
    if (notification == null) {
      return;
    }
    this.initializeIfNotInitialized();
    if (notification.wasDisplayed()) {
      return;
    }

    if (this.lastNotification != null) {
      // do not show duplicates unless some amount of time has passed
      const timeSpan = notification.getTimestamp() - this.lastNotification.getTimestamp();
      if (!(timeSpan < this.duplicateTimeDelay) || !notification.isEqual(this.lastNotification)) {
        this.notificationsElement.appendChild(lumine.views.getView(notification).element);
        if (this.notificationsLog != null) {
          this.notificationsLog.addNotification(notification);
        }
      }
    } else {
      this.notificationsElement.appendChild(lumine.views.getView(notification).element);
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
