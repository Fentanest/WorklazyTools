import assert from "node:assert/strict";
import test from "node:test";

import { audioHistoryLimit, sniffAudioSampleRate } from "../../src/features/audio-studio/audioHelpers.ts";

test("sniffs the original WAV and MP3 sample rates before Web Audio decoding", () => {
  const wav = new ArrayBuffer(44);
  const view = new DataView(wav);
  writeAscii(view, 0, "RIFF");
  writeAscii(view, 8, "WAVE");
  writeAscii(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint32(24, 44_100, true);
  assert.equal(sniffAudioSampleRate(wav, "source.wav"), 44_100);

  // MPEG-1 Layer III, 48 kHz sample-rate index.
  const mp3 = Uint8Array.from([0xff, 0xfb, 0x94, 0x00]).buffer;
  assert.equal(sniffAudioSampleRate(mp3, "source.mp3"), 48_000);
});

test("finds WAV fmt chunks after other chunks and MP3 frames after ID3 tags", () => {
  const wav = new ArrayBuffer(52);
  const view = new DataView(wav);
  writeAscii(view, 0, "RIFF");
  writeAscii(view, 8, "WAVE");
  writeAscii(view, 12, "JUNK");
  view.setUint32(16, 3, true);
  writeAscii(view, 24, "fmt ");
  view.setUint32(28, 16, true);
  view.setUint32(36, 96_000, true);
  assert.equal(sniffAudioSampleRate(wav, "delayed-fmt.wav"), 96_000);

  const mp3 = new Uint8Array(19);
  writeAscii(new DataView(mp3.buffer), 0, "ID3");
  mp3[9] = 5;
  mp3.set([0xff, 0xfb, 0x90, 0x00], 15);
  assert.equal(sniffAudioSampleRate(mp3.buffer, "tagged.mp3"), 44_100);

  const truncated = wav.slice(0, 39);
  assert.equal(sniffAudioSampleRate(truncated, "truncated.wav"), undefined);
});

test("history limit reserves one combined 256 MB undo/redo budget", () => {
  const channel = new Float32Array(32 * 1024 * 1024);
  const limit = audioHistoryLimit({ channels: [channel], sampleRate: 48_000, length: channel.length, duration: channel.length / 48_000, sourceName: "large.wav" });
  assert.equal(limit, 1);
});

function writeAscii(view: DataView, offset: number, value: string) {
  for (let index = 0; index < value.length; index += 1) view.setUint8(offset + index, value.charCodeAt(index));
}
