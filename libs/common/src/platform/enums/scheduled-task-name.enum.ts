export const ScheduledTaskNames = {
  clearClipboardTimeout: "clearClipboardTimeout",
  systemClearClipboardTimeout: "systemClearClipboardTimeout",
  loginStrategySessionTimeout: "loginStrategySessionTimeout",
  notificationsReconnectTimeout: "notificationsReconnectTimeout",
  fido2ClientAbortTimeout: "fido2ClientAbortTimeout",
  scheduleNextSyncInterval: "scheduleNextSyncInterval",
  eventUploadsInterval: "eventUploadsInterval",
} as const;

export type ScheduledTaskName = (typeof ScheduledTaskNames)[keyof typeof ScheduledTaskNames];
