"""Validated candle storage shared by the bridge and its tests."""
import bisect
import json
import logging
import math
import os
from pathlib import Path
import shutil
import tempfile
import threading
import time

SYMBOLS = {"NQ1!", "ES1!", "YM1!", "CL1!"}
RESOLUTIONS = {'1':'1m','5':'5m','15':'15m','30':'30m','60':'1h','120':'2h','240':'4h','360':'6h','720':'12h','D':'D','1D':'D','W':'W','1W':'W','M':'1M','1M':'1M','3M':'3M'}
TIMEFRAMES = set(RESOLUTIONS.values())
MIN_TF_GAP = {'5m':240,'15m':600,'30m':1200,'1h':2400,'2h':5400,'4h':10800,'6h':14400,'12h':28800,'D':43200,'W':259200,'1M':1728000,'3M':5184000}


def clean_bar(value):
    try:
        bar = {key: float(0 if value.get("volume") is None else value.get("volume", 0)) if key == "volume" else float(value[key])
               for key in ("time", "open", "high", "low", "close", "volume")}
        if not all(math.isfinite(v) for v in bar.values()):
            return None
        if bar["time"] <= 0 or bar["time"] != int(bar["time"]) or bar["volume"] < 0:
            return None
        if bar["low"] > min(bar["open"], bar["close"]) or bar["high"] < max(bar["open"], bar["close"]):
            return None
        bar["time"] = int(bar["time"])
        return bar
    except (TypeError, ValueError, KeyError, AttributeError, OverflowError):
        return None


def normalize_bars(values, limit=None, timeframe=None):
    if not isinstance(values, list):
        return []
    bars = {}
    for value in values:
        bar = clean_bar(value)
        if bar:
            bars[bar["time"]] = bar
    ordered = sorted(bars.values(), key=lambda bar: bar["time"])
    return ordered[-limit:] if limit else ordered


def atomic_json(path, value):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temporary = tempfile.mkstemp(prefix=path.name + ".", suffix=".tmp", dir=path.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as stream:
            json.dump(value, stream, allow_nan=False, separators=(",", ":"))
            stream.flush()
            os.fsync(stream.fileno())
        if path.exists():
            try:
                json.loads(path.read_text(encoding="utf-8"))
                shutil.copy2(path, str(path) + ".bak")
            except (ValueError, OSError):
                logging.warning("Keeping previous backup for %s", path.name)
        for attempt in range(5):
            try:
                os.replace(temporary, path)
                break
            except PermissionError:
                if attempt == 4:
                    raise
                time.sleep(0.05)
    finally:
        if os.path.exists(temporary):
            try:
                os.unlink(temporary)
            except OSError:
                pass


def read_json(path):
    for candidate in (Path(path), Path(str(path) + ".bak")):
        try:
            result = json.loads(candidate.read_text(encoding="utf-8"))
            if not isinstance(result, dict):
                raise ValueError("Expected an object")
            return result
        except FileNotFoundError:
            continue
        except (ValueError, OSError) as exc:
            logging.warning("Cannot load %s: %s", candidate.name, exc)
    return {}


class MarketStore:
    def __init__(self, directory):
        self.directory = Path(directory)
        self.data = {tf: {} for tf in TIMEFRAMES}
        self.metadata = {}
        self._save_lock = threading.Lock()
        self.lock = threading.RLock()

    def load(self):
        with self.lock:
            self.metadata = {sym: data for sym, data in read_json(self.directory / "market_metadata.json").items()
                             if sym in SYMBOLS and isinstance(data, dict)}
            self.data["1m"] = {sym: normalize_bars(bars, timeframe="1m") for sym, bars in
                               read_json(self.directory / "market_history.json").items() if sym in SYMBOLS}
            for tf, symbols in read_json(self.directory / "market_history_htf.json").items():
                if tf in TIMEFRAMES and tf != "1m" and isinstance(symbols, dict):
                    self.data[tf] = {sym: normalize_bars(bars, timeframe=tf) for sym, bars in symbols.items() if sym in SYMBOLS}

    def save(self, snapshot=None, metadata=None):
        if snapshot is None or metadata is None:
            with self.lock:
                data = snapshot if snapshot is not None else {tf: {s: list(b) for s, b in syms.items()} for tf, syms in self.data.items()}
                meta = metadata if metadata is not None else dict(self.metadata)
        else:
            data, meta = snapshot, metadata
        with self._save_lock:
            atomic_json(self.directory / "market_history.json", data["1m"])
            atomic_json(self.directory / "market_history_htf.json", {tf: v for tf, v in data.items() if tf != "1m"})
            atomic_json(self.directory / "market_metadata.json", meta)

    def merge(self, symbol, timeframe, bars, authoritative=False):
        if symbol not in SYMBOLS or timeframe not in TIMEFRAMES:
            return []
        incoming = normalize_bars(bars, timeframe=timeframe)
        with self.lock:
            history = self.data[timeframe].setdefault(symbol, [])
            changed = []
            if authoritative and timeframe != "1m" and incoming:
                valid_times = {b["time"] for b in incoming}
                first_time = incoming[0]["time"]
                pruned = [b for b in history if b["time"] < first_time or b["time"] in valid_times]
                if len(pruned) != len(history):
                    history[:] = pruned
            for bar in incoming:
                idx = bisect.bisect_left(history, bar["time"], key=lambda item: item["time"])
                if idx < len(history) and history[idx]["time"] == bar["time"]:
                    if history[idx] == bar:
                        continue
                    history[idx] = bar
                else:
                    history.insert(idx, bar)
                changed.append(bar)
            return changed
