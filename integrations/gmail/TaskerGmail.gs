const TASKER_BASE = "https://tasker-consorcios.cuentagpt050.chatgpt.site";
const TASKER_KEY = "REEMPLAZAR_CON_LA_CLAVE_PRIVADA";
const PROCESSED_LABEL = "Tasker-Procesado";

function configurarTasker() {
  GmailApp.getUserLabelByName(PROCESSED_LABEL) || GmailApp.createLabel(PROCESSED_LABEL);
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
    const config = taskerRequest("/api/mail/automation", { action: "configuration" });
    if (config.intakeEnabled) procesarReclamosTasker(config);
    if (config.remindersEnabled) enviarRecordatoriosTasker();
  } finally {
    lock.releaseLock();
  }
}

function procesarReclamosTasker(config) {
  const label = GmailApp.getUserLabelByName(PROCESSED_LABEL) || GmailApp.createLabel(PROCESSED_LABEL);
  const safeAddress = String(config.inboxAddress).replace(/"/g, "");
  const safePrefix = String(config.subjectPrefix).replace(/"/g, "");
  const query = `to:"${safeAddress}" subject:"${safePrefix}" newer_than:${config.lookbackDays}d -label:${PROCESSED_LABEL}`;
  const threads = GmailApp.search(query, 0, 20);
  threads.forEach((thread) => {
    let completed = true;
    thread.getMessages().forEach((message) => {
      if (!message.getSubject().trim().toLowerCase().startsWith(String(config.subjectPrefix).toLowerCase())) return;
      const from = message.getFrom();
      const emailMatch = from.match(/<([^>]+)>/);
      const senderEmail = emailMatch ? emailMatch[1] : from;
      const senderName = emailMatch ? from.replace(/<[^>]+>/, "").replace(/^"|"$/g, "").trim() : from;
      try {
        taskerRequest("/api/claims/email-intake", {
          externalId: message.getId(),
          senderName,
          senderEmail,
          recipientEmails: message.getTo(),
          subject: message.getSubject(),
          body: message.getPlainBody(),
          receivedAt: message.getDate().getTime(),
        });
      } catch (error) {
        completed = false;
        console.error(error);
      }
    });
    if (completed) thread.addLabel(label);
  });
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
