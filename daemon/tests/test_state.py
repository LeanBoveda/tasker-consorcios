import tempfile
import unittest
from pathlib import Path

from tasker_daemon.state import StateStore


class StateStoreTests(unittest.TestCase):
    def test_queue_survives_and_deduplicates_external_message(self):
        with tempfile.TemporaryDirectory() as directory:
            store = StateStore(Path(directory) / "state.db")
            payload = {
                "source": "email", "sourceAccount": "expensas@adminbsas.com.ar",
                "externalId": "message-1", "title": "Solicitud",
            }
            store.enqueue(payload)
            self.assertTrue(store.has_external_id("email", "message-1"))
            row = next(store.due_items())
            store.complete(int(row["id"]), payload, {"taskId": "task-1"})
            self.assertEqual(store.pending_count(), 0)
            self.assertTrue(store.is_processed("email", "expensas@adminbsas.com.ar", "message-1"))
            store.close()


if __name__ == "__main__":
    unittest.main()
