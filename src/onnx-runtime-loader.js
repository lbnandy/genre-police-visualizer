'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ONNX_RUNTIME_LOAD_FAILURE_CODES = Object.freeze([
  'ONNX_VC_RUNTIME_UNAVAILABLE',
  'ONNX_COMPONENT_MISSING',
  'ONNX_COMPONENT_BLOCKED',
  'ONNX_COMPONENT_INVALID',
  'ONNX_RUNTIME_LOAD_FAILED'
]);

function classifyOnnxRuntimeLoadFailure(cause) {
  const causeCode = String(cause?.code || '').toUpperCase();
  const message = String(cause?.message || cause || '');
  if (['ENOENT', 'MODULE_NOT_FOUND'].includes(causeCode)
    || /cannot find module|module not found/i.test(message)) {
    return { code: 'ONNX_COMPONENT_MISSING', category: 'component-missing', causeCode };
  }
  if (['EACCES', 'EPERM'].includes(causeCode)
    || /access (?:is )?denied|permission denied|operation not permitted/i.test(message)) {
    return { code: 'ONNX_COMPONENT_BLOCKED', category: 'access-blocked', causeCode };
  }
  if (/not a valid win32 application|bad (?:exe|image) format|wrong architecture/i.test(message)) {
    return { code: 'ONNX_COMPONENT_INVALID', category: 'component-invalid', causeCode };
  }
  if (causeCode === 'ERR_DLOPEN_FAILED') {
    return { code: 'ONNX_VC_RUNTIME_UNAVAILABLE', category: 'runtime-dependency', causeCode };
  }
  return { code: 'ONNX_RUNTIME_LOAD_FAILED', category: 'unknown-load-failure', causeCode };
}

function missingOnnxRuntimeComponents({
  platform = process.platform,
  arch = process.arch,
  resolvePackage = () => require.resolve('onnxruntime-node/package.json')
} = {}) {
  let packagePath;
  try {
    packagePath = resolvePackage();
  } catch {
    return ['onnxruntime-node'];
  }

  try {
    const packageMetadata = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    const napiVersions = packageMetadata?.binary?.napi_versions || [];
    const napiVersion = Math.max(...napiVersions.filter(Number.isFinite));
    if (!Number.isFinite(napiVersion)) return [];
    const binaryDirectory = path.join(
      path.dirname(packagePath),
      'bin',
      `napi-v${napiVersion}`,
      platform,
      arch
    );
    const componentNames = ['onnxruntime_binding.node'];
    if (platform === 'win32') componentNames.push('onnxruntime.dll', 'DirectML.dll');
    return componentNames.filter((name) => !fs.existsSync(path.join(binaryDirectory, name)));
  } catch {
    return [];
  }
}

function recoverableOnnxRuntimeError(cause) {
  const detail = cause?.message || String(cause);
  const classification = classifyOnnxRuntimeLoadFailure(cause);
  const error = new Error(`Could not load the Local AI runtime: ${detail}`);
  error.code = classification.code;
  error.category = classification.category;
  error.causeCode = classification.causeCode;
  error.cause = cause;
  return error;
}

function createOnnxRuntimeLoader(
  requireRuntime = () => require('onnxruntime-node'),
  findMissingComponents = missingOnnxRuntimeComponents
) {
  let runtime = null;
  return () => {
    if (runtime) return runtime;
    const missingComponents = findMissingComponents();
    if (missingComponents.length) {
      const cause = new Error(`Missing bundled components: ${missingComponents.join(', ')}`);
      cause.code = 'ENOENT';
      throw recoverableOnnxRuntimeError(cause);
    }
    try {
      runtime = requireRuntime();
      return runtime;
    } catch (cause) {
      throw recoverableOnnxRuntimeError(cause);
    }
  };
}

const loadOnnxRuntime = createOnnxRuntimeLoader();

module.exports = {
  ONNX_RUNTIME_LOAD_FAILURE_CODES,
  classifyOnnxRuntimeLoadFailure,
  createOnnxRuntimeLoader,
  loadOnnxRuntime,
  missingOnnxRuntimeComponents
};
