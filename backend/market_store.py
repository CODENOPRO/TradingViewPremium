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
        t = float(value["time"])
        o = float(value["open"])
        h = float(value["high"])
        l = float(value["low"])
        c = float(value["close"])
        vol_raw = value.get("volume", 0)
        v = 0.0 if vol_raw is None else float(vol_raw)
        if not (math.isfinite(t) and math.isfinite(o) and math.isfinite(h) and math.isfinite(l) and math.isfinite(c) and math.isfinite(v)):
            return None
        ti = int(t)
        if ti <= 0 or t != ti or v < 0:
            return None
        if l > (o if o < c else c) or h < (o if o > c else c):
            return None
        return {"time": ti, "open": o, "high": h, "low": l, "close": c, "volume": v}
    except (TypeError, ValueError, KeyError, AttributeError, OverflowError):
        return None


def normalize_bars(values, limit=None, timeframe=None):
    if not isinstance(values, list):
        return []
    bars = {}
    last_t = -1
    already_sorted = True
    for value in values:
        bar = clean_bar(value)
        if bar:
            t = bar["time"]
            if t <= last_t:
                already_sorted = False
            last_t = t
            bars[t] = bar
    ordered = list(bars.values()) if already_sorted else sorted(bars.values(), key=lambda bar: bar["time"])
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
        self._dirty_1m = False
        self._dirty_htf = False
        self._last_saved_meta = None
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
            self._dirty_1m = False
            self._dirty_htf = False
            self._last_saved_meta = dict(self.metadata)

    def save(self, snapshot=None, metadata=None, only_dirty=False):
        with self.lock:
            need_1m = not only_dirty or self._dirty_1m
            need_htf = not only_dirty or self._dirty_htf
            meta = metadata if metadata is not None else dict(self.metadata)
            need_meta = not only_dirty or meta != self._last_saved_meta
            if only_dirty and not (need_1m or need_htf or need_meta):
                return
            if snapshot is not None:
                data_1m = snapshot.get("1m", {}) if need_1m else None
                data_htf = {tf: v for tf, v in snapshot.items() if tf != "1m"} if need_htf else None
            else:
                data_1m = {s: list(b) for s, b in self.data.get("1m", {}).items()} if need_1m else None
                data_htf = {tf: {s: list(b) for s, b in syms.items()} for tf, syms in self.data.items() if tf != "1m"} if need_htf else None
            if need_1m:
                self._dirty_1m = False
            if need_htf:
                self._dirty_htf = False
            if need_meta:
                self._last_saved_meta = dict(meta)
        with self._save_lock:
            if need_1m and data_1m is not None:
                atomic_json(self.directory / "market_history.json", data_1m)
            if need_htf and data_htf is not None:
                atomic_json(self.directory / "market_history_htf.json", data_htf)
            if need_meta:
                atomic_json(self.directory / "market_metadata.json", meta)

    def merge(self, symbol, timeframe, bars, authoritative=False):
        if symbol not in SYMBOLS or timeframe not in TIMEFRAMES:
            return []
        incoming = normalize_bars(bars, timeframe=timeframe)
        if not incoming:
            return []
        with self.lock:
            history = self.data[timeframe].setdefault(symbol, [])
            changed = []
            if authoritative and timeframe != "1m":
                valid_times = {b["time"] for b in incoming}
                first_time = incoming[0]["time"]
                pruned = [b for b in history if b["time"] < first_time or b["time"] in valid_times]
                if len(pruned) != len(history):
                    history[:] = pruned
                    self._dirty_htf = True
            for bar in incoming:
                if history and bar["time"] >= history[-1]["time"]:
                    if bar["time"] == history[-1]["time"]:
                        if history[-1] == bar:
                            continue
                        history[-1] = bar
                    else:
                        history.append(bar)
                    changed.append(bar)
                    continue
                idx = bisect.bisect_left(history, bar["time"], key=lambda item: item["time"])
                if idx < len(history) and history[idx]["time"] == bar["time"]:
                    if history[idx] == bar:
                        continue
                    history[idx] = bar
                else:
                    history.insert(idx, bar)
                changed.append(bar)
            if changed:
                if timeframe == "1m":
                    self._dirty_1m = True
                else:
                    self._dirty_htf = True
            return changed
