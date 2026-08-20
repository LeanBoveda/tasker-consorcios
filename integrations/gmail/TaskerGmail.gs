const TASKER_URL = "https://tasker-consorcios.cuentagpt050.chatgpt.site/api/claims/email-intake";
const TASKER_KEY = "REEMPLAZAR_CON_LA_CLAVE_PRIVADA";
const TASKER_ADDRESS = "leandroboveda@gmail.com";
const PROCESSED_LABEL = "Tasker-Procesado";

function configurarTasker() {
  GmailApp.getUserLabelByName(PROCESSED_LABEL) || GmailApp.createLabel(PROCESSED_LABEL);
  ScriptApp.getProjectTriggers()
    .filter((trigger) => trigger.getHandlerFunction() === "procesarReclamosTasker")
    .forEach((trigger) => ScriptApp.deleteTrigger(trigger));
  ScriptApp.newTrigger("procesarReclamosTasker").timeBased().everyMinutes(1).create();
  procesarReclamosTasker();
}

function procesarReclamosTasker() {
  const label = GmailApp.getUserLabelByName(PROCESSED_LABEL) || GmailApp.createLabel(PROCESSED_LABEL);
  const query = `to:${TASKER_ADDRESS} subject:"[RECLAMO]" newer_than:7d -label:${PROCESSED_LABEL}`;
  const threads = GmailApp.search(query, 0, 20);

  threads.forEach((thread) => {
    let completed = true;
    thread.getMessages().forEach((message) => {
      if (!/^\[RECLAMO\]/i.test(message.getSubject().trim())) return;
      const from = message.getFrom();
      const emailMatch = from.match(/<([^>]+)>/);
      const senderEmail = emailMatch ? emailMatch[1] : from;
      const senderName = emailMatch ? from.replace(/<[^>]+>/, "").replace(/^"|"$/g, "").trim() : from;
      const response = UrlFetchApp.fetch(TASKER_URL, {
        method: "post",
        contentType: "application/json",
        headers: { "X-Tasker-Intake-Key": TASKER_KEY },
        payload: JSON.stringify({
          externalId: message.getId(),
          senderName,
          senderEmail,
          subject: message.getSubject(),
          body: message.getPlainBody(),
          receivedAt: message.getDate().getTime(),
        }),
        muteHttpExceptions: true,
      });
      if (response.getResponseCode() < 200 || response.getResponseCode() >= 300) {
        completed = false;
        throw new Error(`Tasker rechazó el correo: ${response.getContentText()}`);
      }
    });
    if (completed) thread.addLabel(label);
  });
}
