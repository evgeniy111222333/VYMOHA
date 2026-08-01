import { sendTenderChangeEmail } from "@/src/infrastructure/notifications/email";
import { fetchTender } from "@/src/infrastructure/prozorro/client";
import { listActiveWatches, updateWatchVersion, writeAuditEvent, type ActiveWatch } from "@/src/infrastructure/storage/repository";

type MonitorDependencies = {
  list: () => Promise<ActiveWatch[]>;
  fetch: typeof fetchTender;
  update: typeof updateWatchVersion;
  notify: typeof sendTenderChangeEmail;
  audit: typeof writeAuditEvent;
};

const defaults: MonitorDependencies = {
  list: () => listActiveWatches(), fetch: fetchTender, update: updateWatchVersion,
  notify: sendTenderChangeEmail, audit: writeAuditEvent,
};

export async function runMonitoringCycle(
  options: { notificationApiKey?: string; notificationFrom?: string } = {},
  dependencies: MonitorDependencies = defaults,
): Promise<{ checked: number; changed: number; failed: number }> {
  const watches = await dependencies.list();
  const result = { checked: 0, changed: 0, failed: 0 };
  for (const watch of watches) {
    try {
      const tender = await dependencies.fetch(watch.tenderExternalId);
      result.checked += 1;
      if (!tender.dateModified || tender.dateModified === watch.lastModified) continue;
      const notification = await dependencies.notify({
        to: watch.notifyEmail, tenderExternalId: watch.tenderExternalId, sourceUrl: tender.sourceUrl,
        previousVersion: watch.lastModified, currentVersion: tender.dateModified,
      }, options.notificationApiKey, options.notificationFrom);
      await dependencies.update(watch.id, tender.dateModified);
      await dependencies.audit({
        userId: watch.userId, action: "watch.changed", resourceType: "tender", resourceId: watch.tenderExternalId,
        metadata: { previousVersion: watch.lastModified, currentVersion: tender.dateModified, notification },
      });
      result.changed += 1;
    } catch {
      result.failed += 1;
    }
  }
  return result;
}
