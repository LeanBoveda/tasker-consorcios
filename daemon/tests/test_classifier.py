import unittest

from tasker_daemon.classifier import classify_follow_up, classify_kind, classify_priority, is_noise


class ClassifierTests(unittest.TestCase):
    def test_classifies_claim_and_urgency(self):
        self.assertEqual(classify_kind("Reclamo urgente", "Hay una inundación"), "claim")
        self.assertEqual(classify_priority("Reclamo urgente", "Hay una inundación"), "high")

    def test_detects_recurrence_and_resolution(self):
        self.assertEqual(classify_follow_up("Re: pérdida", "El problema sigue sin resolverse"), "recurrence")
        self.assertEqual(classify_follow_up("Re: pérdida", "Ya quedó solucionado"), "resolved")

    def test_filters_promotions_but_not_platform_updates(self):
        self.assertTrue(is_noise({"CATEGORY_PROMOTIONS"}, "Oferta", {}))
        self.assertFalse(is_noise({"CATEGORY_UPDATES"}, "Nueva solicitud Núñez 5157", {"from": "no-reply@portal.com"}))


if __name__ == "__main__":
    unittest.main()
