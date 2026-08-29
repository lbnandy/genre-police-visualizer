const RHYTHM_SAMPLE_RATE = 22050;
const RHYTHM_HOP_SIZE = 441;

class RhythmCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.hop = new Float32Array(RHYTHM_HOP_SIZE);
    this.hopOffset = 0;
    this.resamplePhase = 0;
    this.resampleRatio = RHYTHM_SAMPLE_RATE / sampleRate;
  }

  pushSample(value) {
    this.hop[this.hopOffset] = value;
    this.hopOffset += 1;
    if (this.hopOffset !== RHYTHM_HOP_SIZE) return;
    const completed = this.hop;
    this.hop = new Float32Array(RHYTHM_HOP_SIZE);
    this.hopOffset = 0;
    this.port.postMessage(completed, [completed.buffer]);
  }

  process(inputs) {
    const channels = inputs[0];
    if (!channels?.length || !channels[0]?.length) return true;
    const frames = channels[0].length;
    for (let index = 0; index < frames; index += 1) {
      let sample = 0;
      for (let channel = 0; channel < channels.length; channel += 1) {
        sample += channels[channel][index] || 0;
      }
      sample /= channels.length;
      this.resamplePhase += this.resampleRatio;
      if (this.resamplePhase >= 1) {
        this.resamplePhase -= 1;
        this.pushSample(sample);
      }
    }
    return true;
  }
}

registerProcessor('genre-police-rhythm-capture', RhythmCaptureProcessor);
