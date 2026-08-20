const TASKER_BASE = "https://tasker-consorcios.cuentagpt050.chatgpt.site";
const TASKER_KEY = "REEMPLAZAR_CON_LA_CLAVE_PRIVADA";
const PROCESSED_LABEL = "Tasker-Procesado";
const LAST_SCAN_PROPERTY = "Tasker-UltimaRevision";

function configurarTasker() {
  GmailApp.getUserLabelByName(PROCESSED_LABEL) || GmailApp.createLabel(PROCESSED_LABEL);
  PropertiesService.getScriptProperties().deleteProperty(LAST_SCAN_PROPERTY);
  ScriptApp.getProjectTriggers()
    .filter((trigger) => ["procesarReclamosTasker", "sincronizarTasker"].includes(trigger.getHandlerFunction()))
    .forEach((trigger) => ScriptApp.deleteTrigger(trigger));
  ScriptApp.newTrigger("sincronizarTasker").timeBased().everyMinutes(1).create();
  sincronizarTasker();
}

function taskerRequest(path, payload) {
  const response = UrlFetchApp.fetch(TASKER_BASE + path, {
    method: "post",
    contentType: "application/json",
    headers: { "X-Tasker-Intake-Key": TASKER_KEY },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });
  if (response.getResponseCode() < 200 || response.getResponseCode() >= 300) {
    throw new Error("Tasker rechazó la solicitud: " + response.getContentText());
  }
  return JSON.parse(response.getContentText());
}

function sincronizarTasker() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return;
  try {
    const scanStartedAt = Date.now();
    const config = taskerRequest("/api/mail/automation", { action: "configuration" });
    const stats = config.intakeEnabled
      ? procesarReclamosTasker(config)
      : { processedCount: 0, accepted: 0, rejected: 0, duplicates: 0, failed: 0 };
    if (stats.failed) throw new Error(stats.failed + " correos no pudieron procesarse y se reintentarán");
    if (config.intakeEnabled) {
      PropertiesService.getScriptProperties().setProperty(LAST_SCAN_PROPERTY, String(scanStartedAt));
    }
    if (config.remindersEnabled) enviarRecordatoriosTasker();
    let detail = "Sin correos nuevos";
    if (stats.processedCount) detail = stats.accepted + " aceptados · " + stats.rejected + " rechazados";
    else if (stats.duplicates) detail = stats.duplicates + " ya procesados · sin nuevos";
    taskerRequest("/api/mail/automation", {
      action: "sync-status",
      status: "ok",
      processedCount: stats.processedCount,
      detail,
    });
  } catch (error) {
    try {
      taskerRequest("/api/mail/automation", { action: "sync-status", status: "error", detail: String(error), processedCount: 0 });
    } catch (_) {}
    throw error;
  } finally {
    lock.releaseLock();
  }
}

function procesarReclamosTasker(config) {
  const label = GmailApp.getUserLabelByName(PROCESSED_LABEL) || GmailApp.createLabel(PROCESSED_LABEL);
  const patterns = (config.acceptedPatterns || []).map((value) => String(value).trim()).filter(Boolean);
  if (!patterns.length) return { processedCount: 0, accepted: 0, rejected: 0, duplicates: 0, failed: 0 };
  const properties = PropertiesService.getScriptProperties();
  const lastScanAt = Number(properties.getProperty(LAST_SCAN_PROPERTY) || 0);
  const now = Date.now();
  const lookbackDays = Math.max(1, Math.min(30, Number(config.lookbackDays) || 7));
  const elapsedDays = lastScanAt ? Math.ceil((now - lastScanAt) / 86400000) + 1 : lookbackDays;
  const searchDays = Math.max(1, Math.min(lookbackDays, elapsedDays));
  const earliestMessageAt = lastScanAt
    ? Math.max(lastScanAt - 300000, now - lookbackDays * 86400000)
    : now - lookbackDays * 86400000;
  const subjectQuery = patterns.map((value) => 'subject:"' + value.replace(/"/g, "") + '"').join(" OR ");
  const query = `in:inbox newer_than:${searchDays}d {${subjectQuery}}`;
  const stats = { processedCount: 0, accepted: 0, rejected: 0, duplicates: 0, failed: 0 };
  for (let start = 0; start < 500; start += 100) {
    const threads = GmailApp.search(query, start, 100);
    threads.forEach((thread) => {
      let completed = true;
      thread.getMessages().forEach((message) => {
        if (message.getDate().getTime() < earliestMessageAt) return;
        const subject = message.getSubject().trim();
        const normalizedSubject = subject.toLowerCase();
        if (!patterns.some((pattern) => normalizedSubject.includes(pattern.toLowerCase()))) return;
        const from = message.getFrom();
        const emailMatch = from.match(/<([^>]+)>/);
        const senderEmail = emailMatch ? emailMatch[1] : from;
        const senderName = emailMatch ? from.replace(/<[^>]+>/, "").replace(/^"|"$/g, "").trim() : from;
        try {
          const headers = message.getRawContent().split(/\r?\n\r?\n/, 1)[0];
          const isAutomatic = /^Auto-Submitted:\s*(?!no\b)/im.test(headers) || /^Precedence:\s*(bulk|junk|list)/im.test(headers);
          const result = taskerRequest("/api/claims/email-intake", {
            externalId: message.getId(),
            senderName,
            senderEmail,
            mailboxAddress: config.inboxAddress,
            recipientEmails: message.getTo(),
            subject,
            body: message.getPlainBody(),
            isAutomatic,
            receivedAt: message.getDate().getTime(),
          });
          if (result.duplicate) stats.duplicates += 1;
          else {
            stats.processedCount += 1;
            if (result.accepted) stats.accepted += 1; else stats.rejected += 1;
          }
        } catch (error) {
          completed = false;
          stats.failed += 1;
          console.error(error);
        }
      });
      if (completed) thread.addLabel(label);
    });
    if (threads.length < 100) break;
  }
  return stats;
}

function reprocesarUltimosCorreosTasker() {
  PropertiesService.getScriptProperties().deleteProperty(LAST_SCAN_PROPERTY);
  sincronizarTasker();
}

function enviarRecordatoriosTasker() {
  const batch = taskerRequest("/api/mail/automation", { action: "reminders" });
  const sentIds = [];
  const failedIds = [];
  (batch.messages || []).forEach((message) => {
    try {
      GmailApp.sendEmail(message.to, message.subject, message.body, { name: "Tasker Consorcios" });
      sentIds.push(message.id);
    } catch (error) {
      failedIds.push(message.id);
      console.error(error);
    }
  });
  if (sentIds.length || failedIds.length) {
    taskerRequest("/api/mail/automation", { action: "acknowledge", sentIds, failedIds });
  }
}
