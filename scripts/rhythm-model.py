"""Low-latency local BeatNet rhythm tracker.

The BDA network architecture and pretrained weights are adapted from BeatNet:
https://github.com/mjhydri/BeatNet (CC BY 4.0). This process never triggers
visuals without an audio transient; it publishes causal beat events and context.
"""

from __future__ import annotations

import argparse
from collections import deque
import json
import math
from pathlib import Path
import statistics
import sys
import time

import numpy as np
import soundcard as sc
import torch
from torch import nn
import torch.nn.functional as functional


SAMPLE_RATE = 22050
HOP_SIZE = 441  # 20 ms / 50 fps
FRAME_SIZE = 1411  # causal 64 ms analysis frame
MODEL_INPUTS = 272


class BeatDownbeatActivation(nn.Module):
    """BeatNet's small causal Conv1D + two-layer LSTM activation model."""

    def __init__(self) -> None:
        super().__init__()
        self.dim_in = MODEL_INPUTS
        self.hidden_size = 150
        self.conv1 = nn.Conv1d(1, 2, 10)
        self.linear0 = nn.Linear(2 * int((self.dim_in - 10 + 1) / 2), 150)
        self.lstm = nn.LSTM(150, self.hidden_size, num_layers=2, batch_first=True)
        self.linear = nn.Linear(self.hidden_size, 3)
        self.hidden = torch.zeros(2, 1, self.hidden_size)
        self.cell = torch.zeros(2, 1, self.hidden_size)

    def forward(self, data: torch.Tensor) -> torch.Tensor:
        value = data.reshape((-1, self.dim_in)).unsqueeze(0).transpose(0, 1)
        value = functional.max_pool1d(functional.relu(self.conv1(value)), 2)
        value = self.linear0(value.reshape(value.shape[0], -1))
        value = value.reshape((data.shape[0], data.shape[1], 150))
        value, (self.hidden, self.cell) = self.lstm(value, (self.hidden, self.cell))
        return self.linear(value).transpose(1, 2)


def logarithmic_frequencies(bands_per_octave: int, fmin: float, fmax: float) -> np.ndarray:
    left = math.floor(math.log2(fmin / 440.0) * bands_per_octave)
    right = math.ceil(math.log2(fmax / 440.0) * bands_per_octave)
    frequencies = 440.0 * 2.0 ** (np.arange(left, right) / float(bands_per_octave))
    return frequencies[(frequencies >= fmin) & (frequencies <= fmax)]


def frequencies_to_bins(frequencies: np.ndarray, bin_frequencies: np.ndarray) -> np.ndarray:
    indices = np.searchsorted(bin_frequencies, frequencies)
    indices = np.clip(indices, 1, len(bin_frequencies) - 1)
    left = bin_frequencies[indices - 1]
    right = bin_frequencies[indices]
    indices -= (frequencies - left < right - frequencies)
    return np.unique(indices)


def build_filterbank() -> np.ndarray:
    # Matches BeatNet's normalized 24-bands-per-octave logarithmic bank.
    fft_bins = FRAME_SIZE // 2
    bin_frequencies = np.fft.fftfreq(FRAME_SIZE, 1.0 / SAMPLE_RATE)[:fft_bins]
    centers = logarithmic_frequencies(24, 30.0, 17000.0)
    bins = frequencies_to_bins(centers, bin_frequencies)
    filters = []
    for start, center, stop in zip(bins[:-2], bins[1:-1], bins[2:]):
        width = int(stop - start)
        center_offset = int(center - start)
        triangle = np.zeros(width, dtype=np.float32)
        triangle[:center_offset] = np.linspace(0, 1, center_offset, endpoint=False, dtype=np.float32)
        triangle[center_offset:] = np.linspace(1, 0, width - center_offset, endpoint=False, dtype=np.float32)
        total = float(triangle.sum())
        if total > 0:
            triangle /= total
        filters.append((int(start), triangle))
    bank = np.zeros((fft_bins, len(filters)), dtype=np.float32)
    for band, (start, triangle) in enumerate(filters):
        stop = min(fft_bins, start + len(triangle))
        bank[start:stop, band] = np.maximum(bank[start:stop, band], triangle[:stop - start])
    if bank.shape != (fft_bins, MODEL_INPUTS // 2):
        raise RuntimeError(f"Unexpected BeatNet filterbank shape: {bank.shape}")
    return bank


class CausalFeatures:
    def __init__(self) -> None:
        self.window = np.hanning(FRAME_SIZE).astype(np.float32)
        self.filterbank = build_filterbank()
        self.buffer = np.zeros(FRAME_SIZE, dtype=np.float32)
        self.previous_log = np.zeros(MODEL_INPUTS // 2, dtype=np.float32)
        self.frames = 0

    def update(self, hop: np.ndarray) -> np.ndarray:
        self.buffer[:-HOP_SIZE] = self.buffer[HOP_SIZE:]
        self.buffer[-HOP_SIZE:] = hop[-HOP_SIZE:]
        magnitude = np.abs(np.fft.fft(self.buffer * self.window)[:FRAME_SIZE // 2]).astype(np.float32)
        log_spectrum = np.log10(1.0 + magnitude @ self.filterbank).astype(np.float32)
        difference = np.maximum(0, log_spectrum - self.previous_log).astype(np.float32)
        self.previous_log = log_spectrum
        self.frames += 1
        return np.concatenate((log_spectrum, difference))


class RhythmSummary:
    def __init__(self) -> None:
        self.activations = deque(maxlen=150)
        self.intervals = deque(maxlen=24)
        self.last_peak_at = 0.0
        self.peak_window = deque(maxlen=3)
        self.serial = 0

    @staticmethod
    def folded_bpm(interval_ms: float) -> float:
        if interval_ms <= 0:
            return 0.0
        bpm = 60000.0 / interval_ms
        candidates = [bpm * factor for factor in (0.5, 1.0, 2.0, 4.0) if 70 <= bpm * factor <= 210]
        return min(candidates, key=lambda value: abs(value - 150)) if candidates else 0.0

    def update(self, activation: float, now: float) -> dict:
        self.activations.append(activation)
        self.peak_window.append((activation, now))
        recent = list(self.activations)[-50:]
        baseline = statistics.median(recent) if recent else 0.0
        threshold = max(0.18, baseline + 0.07)
        peak = False
        peak_activation = 0.0
        peak_at = now
        if len(self.peak_window) == 3:
            previous, center, following = self.peak_window
            peak_activation, peak_at = center
            prominence = peak_activation - max(previous[0], following[0])
            peak = (
                peak_activation >= threshold
                and peak_activation > previous[0]
                and peak_activation >= following[0]
                and prominence >= 0.0025
                and peak_at - self.last_peak_at >= 0.14
            )
        interval_ms = 0.0
        if peak:
            if self.last_peak_at:
                interval_ms = (peak_at - self.last_peak_at) * 1000.0
                if 140 <= interval_ms <= 1800:
                    self.intervals.append(interval_ms)
            self.last_peak_at = peak_at
            self.serial += 1

        bpms = [self.folded_bpm(value) for value in self.intervals]
        bpms = [value for value in bpms if value]
        bpm = statistics.median(bpms[-12:]) if len(bpms) >= 3 else 0.0
        spread = statistics.median([abs(value - bpm) for value in bpms[-12:]]) if bpm else 99.0
        regularity = max(0.0, min(1.0, 1.0 - spread / 18.0)) if len(bpms) >= 4 else 0.0
        upper = sorted(recent)[max(0, int(len(recent) * 0.82) - 1)] if recent else 0.0
        groove = max(0.0, min(1.0, upper * 0.72 + regularity * 0.28))
        return {
            "peak": peak,
            "peakActivation": round(peak_activation if peak else 0.0, 5),
            "peakDelayMs": round((now - peak_at) * 1000.0, 3) if peak else 0.0,
            "serial": self.serial,
            "intervalMs": round(interval_ms, 3),
            "bpm": round(bpm, 2),
            "regularity": round(regularity, 4),
            "groove": round(groove, 4),
            "threshold": round(threshold, 4),
        }


def emit(payload: dict) -> None:
    print(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), flush=True)


def run(weights: Path) -> None:
    torch.set_num_threads(1)
    model = BeatDownbeatActivation()
    model.load_state_dict(torch.load(weights, map_location="cpu", weights_only=True), strict=False)
    model.eval()
    features = CausalFeatures()
    summary = RhythmSummary()

    speaker = sc.default_speaker()
    loopback = sc.get_microphone(speaker.name, include_loopback=True)
    emit({"type": "ready", "model": "BeatNet-1 causal", "speaker": speaker.name, "hopMs": 20})
    frame_index = 0
    with loopback.recorder(samplerate=SAMPLE_RATE, channels=2, blocksize=HOP_SIZE) as recorder:
        while True:
            capture_start = time.perf_counter()
            block = recorder.record(numframes=HOP_SIZE)
            capture_ms = (time.perf_counter() - capture_start) * 1000.0
            mono = np.asarray(block, dtype=np.float32).mean(axis=1)
            feature_start = time.perf_counter()
            frame = features.update(mono)
            feature_ms = (time.perf_counter() - feature_start) * 1000.0
            if features.frames < 5:
                continue
            inference_start = time.perf_counter()
            with torch.inference_mode():
                logits = model(torch.from_numpy(frame).reshape(1, 1, MODEL_INPUTS))
                probabilities = torch.softmax(logits[0, :, 0], dim=0).numpy()
            inference_ms = (time.perf_counter() - inference_start) * 1000.0
            beat = float(probabilities[0])
            downbeat = float(probabilities[1])
            state = summary.update(max(beat, downbeat), time.perf_counter())
            frame_index += 1
            if state["peak"] or frame_index % 5 == 0:
                emit({
                    "type": "rhythm",
                    "beat": round(beat, 5),
                    "downbeat": round(downbeat, 5),
                    **state,
                    "captureMs": round(capture_ms, 3),
                    "featureMs": round(feature_ms, 3),
                    "inferenceMs": round(inference_ms, 3),
                })


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--weights", type=Path, required=True)
    args = parser.parse_args()
    try:
        run(args.weights.resolve())
        return 0
    except KeyboardInterrupt:
        return 0
    except Exception as error:
        emit({"type": "error", "message": str(error)})
        return 1


if __name__ == "__main__":
    sys.exit(main())
