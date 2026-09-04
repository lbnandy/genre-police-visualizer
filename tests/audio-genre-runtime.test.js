'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  classifyOnnxRuntimeLoadFailure,
  createOnnxRuntimeLoader
} = require('../src/onnx-runtime-loader');

test('ONNX native load failures become a recoverable Local AI error', () => {
  const cause = new Error('A dynamic link library initialization routine failed.');
  cause.code = 'ERR_DLOPEN_FAILED';
  const loadRuntime = createOnnxRuntimeLoader(() => {
    throw cause;
  });

  assert.throws(loadRuntime, (error) => {
    assert.equal(error.code, 'ONNX_VC_RUNTIME_UNAVAILABLE');
    assert.equal(error.category, 'runtime-dependency');
    assert.equal(error.causeCode, 'ERR_DLOPEN_FAILED');
    assert.equal(error.cause, cause);
    assert.match(error.message, /Could not load the Local AI runtime/);
    assert.match(error.message, /dynamic link library initialization routine failed/);
    return true;
  });
});

test('ONNX runtime failures distinguish missing, blocked, invalid, and unknown components', () => {
  const cases = [
    {
      cause: Object.assign(new Error('File not found'), { code: 'ENOENT' }),
      code: 'ONNX_COMPONENT_MISSING',
      category: 'component-missing'
    },
    {
      cause: Object.assign(new Error("Cannot find module 'onnxruntime_binding.node'"), { code: 'MODULE_NOT_FOUND' }),
      code: 'ONNX_COMPONENT_MISSING',
      category: 'component-missing'
    },
    {
      cause: Object.assign(new Error('Access is denied'), { code: 'EACCES' }),
      code: 'ONNX_COMPONENT_BLOCKED',
      category: 'access-blocked'
    },
    {
      cause: Object.assign(new Error('The module is not a valid Win32 application'), { code: 'ERR_DLOPEN_FAILED' }),
      code: 'ONNX_COMPONENT_INVALID',
      category: 'component-invalid'
    },
    {
      cause: new Error('Unexpected loader failure'),
      code: 'ONNX_RUNTIME_LOAD_FAILED',
      category: 'unknown-load-failure'
    }
  ];

  for (const expected of cases) {
    const actual = classifyOnnxRuntimeLoadFailure(expected.cause);
    assert.equal(actual.code, expected.code);
    assert.equal(actual.category, expected.category);
  }
});

test('missing bundled ONNX files are reported before native loading', () => {
  let requireCalls = 0;
  const loadRuntime = createOnnxRuntimeLoader(
    () => {
      requireCalls += 1;
      return {};
    },
    () => ['onnxruntime.dll']
  );

  assert.throws(loadRuntime, (error) => {
    assert.equal(error.code, 'ONNX_COMPONENT_MISSING');
    assert.equal(error.category, 'component-missing');
    assert.equal(error.causeCode, 'ENOENT');
    assert.match(error.message, /onnxruntime\.dll/);
    return true;
  });
  assert.equal(requireCalls, 0);
});

test('the ONNX runtime loader reuses a successfully loaded runtime', () => {
  const runtime = { InferenceSession: {}, Tensor: class {} };
  let calls = 0;
  const loadRuntime = createOnnxRuntimeLoader(() => {
    calls += 1;
    return runtime;
  });

  assert.equal(loadRuntime(), runtime);
  assert.equal(loadRuntime(), runtime);
  assert.equal(calls, 1);
});
