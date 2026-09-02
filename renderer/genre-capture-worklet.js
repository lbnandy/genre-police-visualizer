const GENRE_SAMPLE_RATE = 16000;
const GENRE_CHUNK_SIZE = 1600;

class GenreCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.chunk = new Float32Array(GENRE_CHUNK_SIZE);
    this.chunkOffset = 0;
    this.resamplePhase = 0;
    this.resampleRatio = GENRE_SAMPLE_RATE / sampleRate;
  }

  pushSample(value) {
    this.chunk[this.chunkOffset] = value;
    this.chunkOffset += 1;
    if (this.chunkOffset !== GENRE_CHUNK_SIZE) return;
    const completed = this.chunk;
    this.chunk = new Float32Array(GENRE_CHUNK_SIZE);
    this.chunkOffset = 0;
    this.port.postMessage(completed, [completed.buffer]);
  }

  process(inputs) {
    const channels = inputs[0];
    if (!channels?.length || !channels[0]?.length) return true;
    const frames = channels[0].length;
    for (let index = 0; index < frames; index += 1) {
      let value = 0;
      for (let channel = 0; channel < channels.length; channel += 1) {
        value += channels[channel][index] || 0;
      }
      value /= channels.length;
      this.resamplePhase += this.resampleRatio;
      if (this.resamplePhase >= 1) {
        this.resamplePhase -= 1;
        this.pushSample(value);
      }
    }
    return true;
  }
}

registerProcessor('genre-police-genre-capture', GenreCaptureProcessor);
