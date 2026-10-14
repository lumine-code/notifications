module.exports = function isDuplicateNotification(notification, previous, delay) {
  if (!previous || notification.getOptions().buttons?.length > 0) return false;
  const window = notification.getOptions().window ?? lumine.workspace.getMainWindow();
  const previousWindow = previous.getOptions().window ?? lumine.workspace.getMainWindow();
  return (
    window === previousWindow &&
    notification.getTimestamp() - previous.getTimestamp() < delay &&
    notification.isEqual(previous)
  );
};
