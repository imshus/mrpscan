import {
  AudioContext,
  AudioManager,
  AudioRecorder,
  type AudioBufferSourceNode,
} from 'react-native-audio-api';

import {
  PRATHAM_AI_FAREWELL_MS,
  PRATHAM_AI_MIC_RATE,
  PRATHAM_AI_SILENCE_MS,
  saysEndCall,
} from '@/constants/prathamAi';

export type CallStatus = 'connecting' | 'listening' | 'speaking' | 'ended' | 'error';

export type EndReason = 'user' | 'phrase' | 'silence' | 'server' | 'error';

export interface TranscriptLine {
  id: number;
  role: 'user' | 'agent';
  text: string;
  /** Still being written by the agent. */
  partial: boolean;
  /** Cut short by the caller talking over it. */
  interrupted: boolean;
}

export interface CallEvents {
  onStatus: (status: CallStatus, detail?: string) => void;
  onTranscript: (lines: TranscriptLine[]) => void;
}

interface CallOptions {
  wsUrl: string;
  gender: 'female' | 'male';
}

/** Mic level below which a frame counts as silence (RMS of -1..1 samples). */
const SPEECH_RMS = 0.015;

/**
 * Talking over the agent.
 *
 * The microphone stays open for the whole call, so the caller can cut in at
 * any moment. A phone has no echo canceller on the loudspeaker path, so while
 * the agent speaks the mic hears it too: the floor below learns whatever the
 * speaker is putting into the mic, and a voice clearly above that floor is the
 * caller. The agent is then stopped here, immediately — which also silences
 * the echo — and the server is told, so it stops writing that reply.
 */
const DOUBLE_TALK_FRAMES = 3;
const DOUBLE_TALK_MARGIN = 2.5;
const DOUBLE_TALK_ABSOLUTE = 0.02;

/**
 * One call to the Dynamic Voice Agent server, spoken straight over its
 * WebSocket: the phone's microphone goes up as 16 kHz 16-bit PCM, the
 * agent's voice comes back as 24 kHz PCM and is played gapless through the
 * audio context. Mirrors the server's own browser page, including how a
 * reply being talked over is cut and how a retracted question is dropped.
 *
 * The call ends by itself when the caller asks for it ("cut the call",
 * "bye") — after the agent's goodbye — or after ten seconds of silence.
 */
export class PrathamAiCall {
  private ws: WebSocket | null = null;
  private ctx: AudioContext | null = null;
  private recorder: AudioRecorder | null = null;
  private running = false;
  private finished = false;

  private outRate = 24000;
  private nextPlayTime = 0;
  private readonly playing = new Set<AudioBufferSourceNode>();
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private silenceTimer: ReturnType<typeof setTimeout> | null = null;
  private farewellTimer: ReturnType<typeof setTimeout> | null = null;
  private endRequested = false;
  private agentSpokeSinceRequest = false;
  private speaking = false;

  private lines: TranscriptLine[] = [];
  private currentAgent: TranscriptLine | null = null;
  private nextLineId = 1;

  // Resampler carry-over, so a mic that does not deliver 16 kHz is
  // downsampled without a seam between frames.
  private micCarry = new Float32Array(0);
  private micPos = 0;

  // The echo the speaker is putting into the mic, and how many frames in a
  // row have been louder than it (the caller talking over the agent).
  private echoFloor = 0;
  private loudFrames = 0;

  constructor(
    private readonly events: CallEvents,
    private readonly options: CallOptions,
  ) {}

  async start(): Promise<void> {
    if (this.running || this.finished) return;
    this.events.onStatus('connecting');

    let permission: string;
    try {
      permission = await AudioManager.requestRecordingPermissions();
    } catch {
      permission = 'Denied';
    }
    if (permission !== 'Granted') {
      this.fail('Allow the microphone for MRPscan to talk to Pratham AI.');
      return;
    }

    try {
      AudioManager.setAudioSessionOptions({
        iosCategory: 'playAndRecord',
        iosMode: 'voiceChat',
        iosOptions: ['defaultToSpeaker', 'allowBluetoothHFP'],
      });
      await AudioManager.setAudioSessionActivity(true);
    } catch {
      // Android needs no session; a failed iOS activation still lets audio run.
    }

    try {
      this.ctx = new AudioContext();
    } catch {
      this.fail('Audio could not be started on this phone.');
      return;
    }

    const ws = new WebSocket(this.options.wsUrl);
    ws.binaryType = 'arraybuffer';
    this.ws = ws;
    let opened = false;

    ws.onopen = () => {
      opened = true;
      this.running = true;
      ws.send(JSON.stringify({ type: 'start', gender: this.options.gender }));
      this.startMic();
      this.setListening();
    };
    ws.onmessage = (event) => this.handleMessage(event.data);
    ws.onerror = () => {
      if (!opened) this.fail("Can't reach Pratham AI right now. Please try again.");
    };
    ws.onclose = () => {
      if (!opened) {
        this.fail("Can't reach Pratham AI right now. Please try again.");
        return;
      }
      if (this.running) this.end('server');
    };
  }

  /** Ends the call now, from the button or from leaving the screen. */
  hangUp(): void {
    this.end('user');
  }

  get isRunning(): boolean {
    return this.running;
  }

  // ── microphone ────────────────────────────────────────────────────────

  private startMic(): void {
    const recorder = new AudioRecorder();
    this.recorder = recorder;
    recorder.onError(() => this.fail('The microphone stopped working.'));
    recorder.onAudioReady(
      { sampleRate: PRATHAM_AI_MIC_RATE, bufferLength: 1600, channelCount: 1 },
      (event) => {
        if (!this.running || !this.ws || this.ws.readyState !== WebSocket.OPEN) return;
        const channel = event.buffer.getChannelData(0);
        const frames = event.numFrames > 0 ? Math.min(event.numFrames, channel.length) : channel.length;
        const samples = frames === channel.length ? channel : channel.subarray(0, frames);
        if (!samples.length) return;
        this.noteMicLevel(samples);
        const pcm = this.toPcm16(samples, event.buffer.sampleRate || PRATHAM_AI_MIC_RATE);
        if (pcm.length) this.ws.send(pcm.buffer);
      },
    );
    try {
      recorder.start();
    } catch {
      this.fail('The microphone could not be started.');
    }
  }

  private toPcm16(samples: Float32Array, rate: number): Int16Array {
    let mono: Float32Array;
    if (rate === PRATHAM_AI_MIC_RATE) {
      mono = samples;
    } else {
      const merged = new Float32Array(this.micCarry.length + samples.length);
      merged.set(this.micCarry, 0);
      merged.set(samples, this.micCarry.length);
      const ratio = rate / PRATHAM_AI_MIC_RATE;
      const out: number[] = [];
      let pos = this.micPos;
      while (pos + 1 < merged.length) {
        const i = Math.floor(pos);
        const fraction = pos - i;
        out.push(merged[i] * (1 - fraction) + merged[i + 1] * fraction);
        pos += ratio;
      }
      const keep = Math.floor(pos);
      this.micCarry = merged.slice(keep);
      this.micPos = pos - keep;
      mono = Float32Array.from(out);
    }
    const pcm = new Int16Array(mono.length);
    for (let i = 0; i < mono.length; i += 1) {
      const clamped = Math.max(-1, Math.min(1, mono[i]));
      pcm[i] = Math.round(clamped * 32767);
    }
    return pcm;
  }

  /** True while the agent's voice is still coming out of the speaker. */
  private agentSpeaking(): boolean {
    const ctx = this.ctx;
    if (!ctx) return false;
    return this.nextPlayTime > ctx.currentTime + 0.02;
  }

  /**
   * Every microphone frame passes through here: while the agent is quiet a
   * sound from the caller keeps the silence clock from running out, and while
   * it speaks the same level is watched for the caller talking over it.
   */
  private noteMicLevel(samples: Float32Array): void {
    let sum = 0;
    let count = 0;
    for (let i = 0; i < samples.length; i += 4) {
      sum += samples[i] * samples[i];
      count += 1;
    }
    const rms = Math.sqrt(sum / Math.max(1, count));

    if (!this.agentSpeaking()) {
      this.echoFloor = 0;
      this.loudFrames = 0;
      if (rms >= SPEECH_RMS) this.armSilenceTimer();
      return;
    }

    this.echoFloor = this.echoFloor ? this.echoFloor * 0.85 + rms * 0.15 : rms;
    if (rms > DOUBLE_TALK_ABSOLUTE && rms > this.echoFloor * DOUBLE_TALK_MARGIN) {
      this.loudFrames += 1;
      if (this.loudFrames >= DOUBLE_TALK_FRAMES) {
        this.loudFrames = 0;
        this.interruptAgent();
      }
      return;
    }
    this.loudFrames = 0;
  }

  /** The caller cut in: stop the agent here and now, and tell the server. */
  private interruptAgent(): void {
    if (!this.running) return;
    this.clearPlayback();
    this.echoFloor = 0;
    const ws = this.ws;
    if (ws && ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify({ type: 'interrupt', reason: 'talked over' }));
      } catch {
        // The socket is going away; the reply stops with it.
      }
    }
    this.setListening();
  }

  // ── server messages ───────────────────────────────────────────────────

  private handleMessage(data: unknown): void {
    if (typeof data === 'string') {
      let message: Record<string, unknown>;
      try {
        message = JSON.parse(data) as Record<string, unknown>;
      } catch {
        return;
      }
      switch (message.type) {
        case 'ready':
          if (typeof message.sample_rate === 'number' && message.sample_rate > 0) {
            this.outRate = message.sample_rate;
          }
          break;
        case 'user':
          this.onUser(String(message.text ?? ''));
          break;
        case 'agent':
          this.onAgent(
            String(message.text ?? ''),
            message.final === true,
            message.interrupted === true,
          );
          break;
        case 'retract':
          this.onRetract();
          break;
        case 'clear':
          this.clearPlayback();
          this.setListening();
          break;
        case 'error':
          this.events.onStatus(this.speaking ? 'speaking' : 'listening', String(message.text ?? ''));
          break;
        default:
          break;
      }
      return;
    }
    if (data instanceof ArrayBuffer) this.playPcm(data);
  }

  private onUser(text: string): void {
    this.currentAgent = null;
    this.lines = [...this.lines, this.makeLine('user', text)];
    this.emitTranscript();
    this.armSilenceTimer();
    if (!this.endRequested && saysEndCall(text)) this.requestEnd();
  }

  private onAgent(text: string, final: boolean, interrupted: boolean): void {
    if (!this.currentAgent && interrupted) {
      // A finished reply being cut back to what was actually heard.
      const last = this.lines[this.lines.length - 1];
      if (last?.role === 'agent') this.currentAgent = last;
    }
    if (!this.currentAgent) {
      this.currentAgent = this.makeLine('agent', '');
      this.lines = [...this.lines, this.currentAgent];
    }
    const updated: TranscriptLine = {
      ...this.currentAgent,
      text,
      partial: !final,
      interrupted: this.currentAgent.interrupted || interrupted,
    };
    this.lines = this.lines.map((line) => (line.id === updated.id ? updated : line));
    this.currentAgent = updated;
    if (final) {
      if (!text) this.lines = this.lines.filter((line) => line.id !== updated.id);
      this.currentAgent = null;
    }
    this.emitTranscript();
  }

  /** The caller kept talking before hearing anything: that question and any reply to it go. */
  private onRetract(): void {
    let lastUser = -1;
    for (let i = this.lines.length - 1; i >= 0; i -= 1) {
      if (this.lines[i].role === 'user') {
        lastUser = i;
        break;
      }
    }
    if (lastUser >= 0) this.lines = this.lines.slice(0, lastUser);
    this.currentAgent = null;
    this.emitTranscript();
  }

  private makeLine(role: 'user' | 'agent', text: string): TranscriptLine {
    const line = { id: this.nextLineId, role, text, partial: false, interrupted: false };
    this.nextLineId += 1;
    return line;
  }

  private emitTranscript(): void {
    this.events.onTranscript(this.lines);
  }

  // ── playback ──────────────────────────────────────────────────────────

  private playPcm(data: ArrayBuffer): void {
    const ctx = this.ctx;
    if (!ctx || !this.running) return;
    const usable = data.byteLength - (data.byteLength % 2);
    if (usable <= 0) return;
    const int16 = new Int16Array(data, 0, usable / 2);

    const ratio = ctx.sampleRate / this.outRate;
    const outLen = Math.max(1, Math.round(int16.length * ratio));
    const samples = new Float32Array(outLen);
    const last = int16.length - 1;
    for (let i = 0; i < outLen; i += 1) {
      const position = i / ratio;
      const i0 = Math.min(Math.floor(position), last);
      const fraction = position - i0;
      const s0 = int16[i0] / 32768;
      const s1 = int16[Math.min(i0 + 1, last)] / 32768;
      samples[i] = s0 * (1 - fraction) + s1 * fraction;
    }

    const buffer = ctx.createBuffer(1, outLen, ctx.sampleRate);
    buffer.copyToChannel(samples, 0);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    const now = ctx.currentTime;
    if (this.nextPlayTime < now) this.nextPlayTime = now + 0.05;
    source.start(this.nextPlayTime);
    this.nextPlayTime += buffer.duration;
    this.playing.add(source);
    source.onEnded = () => {
      this.playing.delete(source);
    };

    if (this.endRequested) this.agentSpokeSinceRequest = true;
    this.setSpeaking();
    if (this.idleTimer) clearTimeout(this.idleTimer);
    const remainingMs = Math.max(0, (this.nextPlayTime - ctx.currentTime) * 1000) + 80;
    this.idleTimer = setTimeout(() => this.onPlaybackIdle(), remainingMs);
  }

  private clearPlayback(): void {
    for (const source of this.playing) {
      try {
        source.stop();
      } catch {
        // Already finished.
      }
    }
    this.playing.clear();
    this.nextPlayTime = 0;
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
  }

  private onPlaybackIdle(): void {
    this.idleTimer = null;
    if (!this.running) return;
    if (this.endRequested && this.agentSpokeSinceRequest) {
      this.end('phrase');
      return;
    }
    this.setListening();
  }

  // ── state ─────────────────────────────────────────────────────────────

  private setSpeaking(): void {
    if (!this.speaking) {
      this.speaking = true;
      this.events.onStatus('speaking');
    }
    // The agent talking is not the caller's silence.
    this.clearSilenceTimer();
  }

  private setListening(): void {
    this.speaking = false;
    this.events.onStatus('listening');
    this.armSilenceTimer();
  }

  private armSilenceTimer(): void {
    this.clearSilenceTimer();
    if (!this.running || this.endRequested) return;
    this.silenceTimer = setTimeout(() => this.end('silence'), PRATHAM_AI_SILENCE_MS);
  }

  private clearSilenceTimer(): void {
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
  }

  /** The caller asked to end the call: let the agent say goodbye, then hang up. */
  private requestEnd(): void {
    this.endRequested = true;
    this.agentSpokeSinceRequest = false;
    this.clearSilenceTimer();
    this.farewellTimer = setTimeout(() => this.end('phrase'), PRATHAM_AI_FAREWELL_MS);
  }

  private fail(message: string): void {
    this.teardown();
    if (this.finished) return;
    this.finished = true;
    this.events.onStatus('error', message);
  }

  private end(reason: EndReason): void {
    if (this.finished) return;
    this.finished = true;
    const ws = this.ws;
    if (ws && ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify({ type: 'stop' }));
      } catch {
        // The socket is going away regardless.
      }
    }
    this.teardown();
    const detail =
      reason === 'phrase'
        ? 'Call ended, as you asked.'
        : reason === 'silence'
          ? 'Call ended after 10 seconds of silence.'
          : 'Call ended.';
    this.events.onStatus('ended', detail);
  }

  private teardown(): void {
    this.running = false;
    this.clearSilenceTimer();
    if (this.farewellTimer) {
      clearTimeout(this.farewellTimer);
      this.farewellTimer = null;
    }
    this.clearPlayback();

    const recorder = this.recorder;
    this.recorder = null;
    if (recorder) {
      try {
        recorder.clearOnAudioReady();
        if (recorder.isRecording()) recorder.stop();
      } catch {
        // Nothing to release.
      }
    }

    const ws = this.ws;
    this.ws = null;
    if (ws) {
      ws.onopen = null;
      ws.onmessage = null;
      ws.onerror = null;
      ws.onclose = null;
      try {
        ws.close();
      } catch {
        // Already closed.
      }
    }

    const ctx = this.ctx;
    this.ctx = null;
    if (ctx) {
      void ctx.close().catch(() => undefined);
    }
    void AudioManager.setAudioSessionActivity(false).catch(() => false);
  }
}
