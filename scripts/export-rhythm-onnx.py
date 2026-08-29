"""Export the bundled causal BeatNet adaptation with explicit LSTM state.

This is a development-only conversion step. The shipped application consumes
the resulting ONNX file through onnxruntime-node and does not require Python.
"""

from __future__ import annotations

import argparse
import importlib.util
from pathlib import Path

import onnx
import torch
from torch import nn
import torch.nn.functional as functional


ROOT = Path(__file__).resolve().parent.parent
MODEL_INPUTS = 272
HIDDEN_SIZE = 150


def load_reference_module():
    source = Path(__file__).with_name("rhythm-model.py")
    spec = importlib.util.spec_from_file_location("genre_police_rhythm_reference", source)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Unable to load {source}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class ExportableBeatNet(nn.Module):
    """BeatNet BDA graph with recurrent state in its public ONNX contract."""

    def __init__(self, reference: nn.Module) -> None:
        super().__init__()
        self.conv1 = reference.conv1
        self.linear0 = reference.linear0
        self.lstm = reference.lstm
        self.linear = reference.linear

    def forward(
        self,
        data: torch.Tensor,
        hidden: torch.Tensor,
        cell: torch.Tensor,
    ) -> tuple[torch.Tensor, torch.Tensor, torch.Tensor]:
        value = data.reshape((-1, MODEL_INPUTS)).unsqueeze(0).transpose(0, 1)
        value = functional.max_pool1d(functional.relu(self.conv1(value)), 2)
        value = self.linear0(value.reshape(value.shape[0], -1))
        value = value.reshape((data.shape[0], data.shape[1], HIDDEN_SIZE))
        value, (next_hidden, next_cell) = self.lstm(value, (hidden, cell))
        logits = self.linear(value).transpose(1, 2)
        return logits, next_hidden, next_cell


def export(weights: Path, output: Path) -> None:
    reference_module = load_reference_module()
    reference = reference_module.BeatDownbeatActivation()
    reference.load_state_dict(
        torch.load(weights, map_location="cpu", weights_only=True),
        strict=False,
    )
    model = ExportableBeatNet(reference).eval()
    sample = torch.zeros(1, 1, MODEL_INPUTS, dtype=torch.float32)
    hidden = torch.zeros(2, 1, HIDDEN_SIZE, dtype=torch.float32)
    cell = torch.zeros(2, 1, HIDDEN_SIZE, dtype=torch.float32)
    output.parent.mkdir(parents=True, exist_ok=True)
    with torch.inference_mode():
        torch.onnx.export(
            model,
            (sample, hidden, cell),
            output,
            input_names=["features", "hidden", "cell"],
            output_names=["logits", "next_hidden", "next_cell"],
            opset_version=17,
            do_constant_folding=True,
            dynamo=False,
        )
    graph = onnx.load(output)
    onnx.checker.check_model(graph)
    print(f"Exported {output} ({output.stat().st_size} bytes)")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--weights",
        type=Path,
        default=ROOT / "assets" / "models" / "beatnet-model-1.pt",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=ROOT / "assets" / "models" / "beatnet-model-1.onnx",
    )
    args = parser.parse_args()
    export(args.weights.resolve(), args.output.resolve())
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
