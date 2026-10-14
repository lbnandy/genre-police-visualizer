'use strict';

const MODEL_FILE = 'models/beatnet-plus/generic_weights.onnx';
const MODEL_SHA256 = '3660e083dbea50b4ca8ac43e7cf75bd97ffb6522474e1f1d3a337cfa63265a06';

// Source and packaged runs share one model; missing assets never select another engine.
function rhythmConfig(assetPath) {
  return { modelPath: assetPath(MODEL_FILE), modelKind: 'beatnet-plus' };
}

module.exports = { rhythmConfig, MODEL_FILE, MODEL_SHA256 };
