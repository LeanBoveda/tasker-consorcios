import unittest

from tasker_daemon.cleaner import clean_email_body, clean_subject


class CleanerTests(unittest.TestCase):
    def test_removes_forward_headers_signature_and_disclaimer(self):
        raw = """Correo recibido de Expensas Administracion Bs As <expensas@administracionbsas.com.ar>
---------- Forwarded message ---------
De: Camila Mamone <camila@larguia.com.ar>
Date: mié, 19 ago 2026
Subject: SOLICITUD LIBRE DEUDA EXPENSAS
To: <EXPENSAS@administracionbsas.com.ar>
Cc: Veronica <veronica@larguia.com.ar>

Estimados buenas tardes,
Adjunto solicitud de libre deuda de expensas.
Gracias,
--
Escribania Larguia
Este mensaje es confidencial. No divulgar.
"""
        self.assertEqual(
            clean_email_body(raw),
            "Estimados buenas tardes,\nAdjunto solicitud de libre deuda de expensas.\nGracias,",
        )

    def test_removes_quoted_reply_chain(self):
        raw = """El problema sigue sin resolverse.

El lun, 24 ago 2026 a las 10:00, Administración escribió:
> Estamos coordinando la visita.
"""
        self.assertEqual(clean_email_body(raw), "El problema sigue sin resolverse.")

    def test_html_is_converted_to_text(self):
        self.assertEqual(clean_email_body("<p>Hay una pérdida.</p><p>UF 3B</p>"), "Hay una pérdida.\n\nUF 3B")

    def test_subject_prefixes_are_removed(self):
        self.assertEqual(clean_subject("Fwd: RE: Reclamo ascensor"), "Reclamo ascensor")


if __name__ == "__main__":
    unittest.main()
