const { withAndroidManifest } = require("@expo/config-plugins");

const BOOT_ACTIONS = new Set([
  "android.intent.action.BOOT_COMPLETED",
  "android.intent.action.REBOOT",
  "android.intent.action.QUICKBOOT_POWERON",
  "com.htc.intent.action.QUICKBOOT_POWERON",
]);

function actionName(action) {
  return action?.$?.["android:name"];
}

function removeBootActionsFromReceiver(receiver) {
  if (!Array.isArray(receiver["intent-filter"])) return;

  receiver["intent-filter"] = receiver["intent-filter"]
    .map((filter) => ({
      ...filter,
      action: Array.isArray(filter.action)
        ? filter.action.filter((action) => !BOOT_ACTIONS.has(actionName(action)))
        : filter.action,
    }))
    .filter((filter) => !Array.isArray(filter.action) || filter.action.length);
}

function removeReceiveBootPermission(manifest) {
  if (!Array.isArray(manifest["uses-permission"])) return;
  manifest["uses-permission"] = manifest["uses-permission"].filter(
    (permission) => permission?.$?.["android:name"] !== "android.permission.RECEIVE_BOOT_COMPLETED"
  );
}

module.exports = function withRemoveNotificationBootReceivers(config) {
  return withAndroidManifest(config, (nextConfig) => {
    const manifest = nextConfig.modResults.manifest;
    const application = manifest.application?.[0];

    removeReceiveBootPermission(manifest);

    if (Array.isArray(application?.receiver)) {
      application.receiver
        .filter((receiver) => receiver?.$?.["android:name"] === ".service.NotificationsService")
        .forEach(removeBootActionsFromReceiver);
    }

    return nextConfig;
  });
};
