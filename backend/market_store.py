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

SYMBOLS = {"NQ1!", "ES1!", "YM1!", "CL1!"}
TIMEFRAMES = {"1m", "5m", "15m", "1h", "4h", "6h", "D", "W"}
RESOLUTIONS = {"1": "1m", "5": "5m", "15": "15m", "60": "1h", "240": "4h",
               "360": "6h", "1D": "D", "D": "D", "1W": "W", "W": "W"}


def clean_bar(value):
    try:
        bar = {key: float(value.get(key, 0) if key == "volume" else value[key])
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


def normalize_bars(values, limit=1500):
    if not isinstance(values, list):
        return []
    bars = {}
    for value in values:
        bar = clean_bar(value)
        if bar:
            bars[bar["time"]] = bar
    return sorted(bars.values(), key=lambda bar: bar["time"])[-limit:]


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
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


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

    def load(self):
        self.metadata = {sym: data for sym, data in read_json(self.directory / "market_metadata.json").items()
                         if sym in SYMBOLS and isinstance(data, dict)}
        self.data["1m"] = {sym: normalize_bars(bars) for sym, bars in
                           read_json(self.directory / "market_history.json").items() if sym in SYMBOLS}
        for tf, symbols in read_json(self.directory / "market_history_htf.json").items():
            if tf in TIMEFRAMES and tf != "1m" and isinstance(symbols, dict):
                self.data[tf] = {sym: normalize_bars(bars) for sym, bars in symbols.items() if sym in SYMBOLS}

    def save(self, snapshot=None, metadata=None):
        data = snapshot if snapshot is not None else self.data
        with self._save_lock:
            atomic_json(self.directory / "market_history.json", data["1m"])
            atomic_json(self.directory / "market_history_htf.json", {tf: v for tf, v in data.items() if tf != "1m"})
            atomic_json(self.directory / "market_metadata.json", self.metadata if metadata is None else metadata)

    def merge(self, symbol, timeframe, bars):
        if symbol not in SYMBOLS or timeframe not in TIMEFRAMES:
            return []
        history = self.data[timeframe].setdefault(symbol, [])
        changed = []
        for bar in normalize_bars(bars):
            idx = bisect.bisect_left(history, bar["time"], key=lambda item: item["time"])
            if idx < len(history) and history[idx]["time"] == bar["time"]:
                if history[idx] == bar:
                    continue
                history[idx] = bar
            else:
                history.insert(idx, bar)
            changed.append(bar)
        del history[:-1500]
        return changed
