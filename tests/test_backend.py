import asyncio
import json
from pathlib import Path
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))
from market_store import MarketStore, clean_bar, atomic_json, read_json
from bridge_server import (
    APP_ROOT,
    BUILD_ID,
    CDPConnection,
    _compute_build_id,
    clients,
    encode_initial_snapshot,
    frontend_ws_handler,
    pending_native,
    publish,
    snapshot_market_data,
    status,
    store,
)


def bar(time=60, **changes):
    return {"time": time, "open": 10, "high": 12, "low": 9, "close": 11, "volume": 5, **changes}


class StorageTests(unittest.TestCase):
    def test_merge_volume_only_and_late_correction_are_idempotent(self):
        with tempfile.TemporaryDirectory() as directory:
            store = MarketStore(directory)
            store.merge("NQ1!", "1m", [bar(120), bar(60)])
            self.assertEqual(len(store.merge("NQ1!", "1m", [bar(60, volume=7)])), 1)
            self.assertEqual(store.merge("NQ1!", "1m", [bar(60, volume=7)]), [])
            self.assertEqual([b["time"] for b in store.data["1m"]["NQ1!"]], [60, 120])
            self.assertEqual(store.data["1m"]["NQ1!"][0]["volume"], 7)

    def test_reject_invalid_data_and_unknown_symbol_without_polluting_store(self):
        self.assertIsNone(clean_bar(bar(close=float("nan"))))
        self.assertIsNone(clean_bar(bar(high=1)))
        self.assertIsNone(clean_bar(bar(volume=-1)))
        self.assertIsNone(clean_bar(bar(time=1.5)))
        with tempfile.TemporaryDirectory() as directory:
            store = MarketStore(directory)
            self.assertEqual(store.merge("sds_1", "1m", [bar()]), [])
            self.assertEqual(store.data["1m"], {})

    def test_atomic_write_recovers_backup_and_does_not_replace_good_backup_with_corruption(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "history.json"
            atomic_json(path, {"generation": 1})
            atomic_json(path, {"generation": 2})
            path.write_text("broken", encoding="utf-8")
            self.assertEqual(read_json(path), {"generation": 1})
            atomic_json(path, {"generation": 3})
            self.assertEqual(json.loads(Path(str(path) + ".bak").read_text()), {"generation": 1})
            self.assertFalse(list(Path(directory).glob("*.tmp")))

    def test_status_exposes_root_and_build_fingerprint_for_stale_server_replacement(self):
        self.assertEqual(status.get("root"), APP_ROOT)
        self.assertEqual(status.get("build"), BUILD_ID)
        self.assertEqual(len(_compute_build_id()), 12)


class CDPTests(unittest.IsolatedAsyncioTestCase):
    async def test_out_of_order_rpc_responses_and_exception_cleanup(self):
        class Socket:
            def __init__(self):
                self.incoming = asyncio.Queue()
                self.sent = []

            async def send(self, message):
                self.sent.append(json.loads(message))

            def __aiter__(self):
                return self

            async def __anext__(self):
                return await self.incoming.get()

        socket = Socket()
        cdp = CDPConnection(socket)
        reader = asyncio.create_task(cdp.read())
        first = asyncio.create_task(cdp.evaluate("first"))
        second = asyncio.create_task(cdp.evaluate("second"))
        await asyncio.sleep(0)
        await socket.incoming.put(json.dumps({"id": 2, "result": {"result": {"value": "second"}}}))
        await socket.incoming.put(json.dumps({"id": 1, "result": {"result": {"value": "first"}}}))
        self.assertEqual(await first, "first")
        self.assertEqual(await second, "second")
        self.assertEqual(cdp.pending, {})
        reader.cancel()
        await asyncio.gather(reader, return_exceptions=True)

    async def test_slow_client_is_signaled_instead_of_silently_dropping_candles(self):
        queue = asyncio.Queue(maxsize=1)
        clients.add(queue)
        try:
            publish({"type": "first"})
            publish({"type": "second"})
            self.assertIsNone(queue.get_nowait())
            self.assertNotIn(queue, clients)
        finally:
            clients.discard(queue)

    async def test_unsupported_request_native_does_not_close_websocket(self):
        class FakeSocket:
            def __init__(self, messages):
                self._messages = iter(messages)
                self.sent = []
                self.closed = []

            async def send(self, message):
                self.sent.append(json.loads(message))

            async def close(self, code=1000, reason=""):
                self.closed.append((code, reason))

            def __aiter__(self):
                return self

            async def __anext__(self):
                await asyncio.sleep(0)
                try:
                    return next(self._messages)
                except StopIteration:
                    await asyncio.sleep(0.01)
                    raise StopAsyncIteration

        prev_data = {tf: dict(syms) for tf, syms in store.data.items()}
        prev_pending = list(pending_native)
        store.data["1m"]["NQ1!"] = [bar(60)]
        pending_native.clear()
        try:
            snap = snapshot_market_data()
            self.assertEqual(snap["1m"]["NQ1!"], [bar(60)])
            frames = encode_initial_snapshot(status, snap, {})
            self.assertGreaterEqual(len(frames), 2)
            socket = FakeSocket([
                json.dumps({"action": "request_native", "charts": [
                    {"symbol": "NQ1!", "timeframe": "30m"},
                    {"symbol": "NQ1!", "timeframe": "12h"},
                    {"symbol": "UNKNOWN", "timeframe": "1m"},
                ]}),
                json.dumps({"action": "restart_tv"}),
                json.dumps({"action": "ping"}),
            ])
            await frontend_ws_handler(socket)
            self.assertEqual(socket.closed, [])
            self.assertIn("30m", pending_native)
            self.assertTrue(any(m.get("type") == "native_request_error" for m in socket.sent))
            self.assertTrue(any(m.get("type") == "pong" for m in socket.sent))
        finally:
            store.data.clear()
            store.data.update(prev_data)
            pending_native[:] = prev_pending


if __name__ == "__main__":
    unittest.main()
