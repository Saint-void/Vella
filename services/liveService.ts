// src/services/liveService.ts
const BACKEND = import.meta.env.VITE_VELLA_BACKEND_URL || "https://exhilaratingly-heaveless-lael.ngrok-free.dev";

// Stream Chat (existing function)
export function streamChat(
  prompt: string,
  onChunk: (chunk: string) => void,
  onDone: () => void,
  onError: (err: any) => void,
  model?: string,
  max_new_tokens = 128
) {
  const params = new URLSearchParams();
  params.set("prompt", prompt);
  params.set("max_new_tokens", String(max_new_tokens));
  if (model) params.set("model", model);

  const url = `${BACKEND}/stream?${params.toString()}`;
  const es = new EventSource(url);

  es.onmessage = (e) => {
    const data = e.data;
    if (!data) return;
    if (data === "__END__") { onDone(); es.close(); return; }
    if (data.startsWith("__ERROR__:")) { onError(data.replace("__ERROR__:", "")); es.close(); return; }
    onChunk(data);
  };

  es.onerror = (ev) => { onError(ev); es.close(); };
  return () => { try { es.close(); } catch {} };
};

// ---------------- Local LiveClient for voice mode ----------------
export class LiveClient {
  private inputContext: AudioContext | null = null;
  private outputContext: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private processor: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private nextStartTime = 0;
  private isConnected = false;
  private onTranscription: ((role: 'user'|'model', text: string)=>void) | null = null;

  async connect(
    onClose: () => void,
    onTranscription: (role: 'user'|'model', text: string)=>void
  ) {
    this.isConnected = true;
    this.onTranscription = onTranscription;

    this.inputContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
    this.outputContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });

    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.source = this.inputContext.createMediaStreamSource(this.stream);
    this.processor = this.inputContext.createScriptProcessor(4096, 1, 1);

    this.processor.onaudioprocess = (e) => {
      if (!this.isConnected) return;
      const inputData = e.inputBuffer.getChannelData(0);
      const pcm16 = this.downsampleTo16k(inputData, this.inputContext!.sampleRate);

      // ✅ Cast to ArrayBuffer to fix TypeScript error
      const base64Data = this.arrayBufferToBase64(pcm16.buffer as ArrayBuffer);

      // Send audio chunk to your local Vella backend
      fetch(`${BACKEND}/live-audio`, {
        method: 'POST',
        body: JSON.stringify({ data: base64Data }),
        headers: { 'Content-Type': 'application/json' }
      }).catch(err => console.error("Audio send error", err));
    };

    this.source.connect(this.processor);
    this.processor.connect(this.inputContext.destination);

    // Optional: poll for transcription/audio from backend
    this.pollBackend();

    const stopHandler = () => { this.disconnect(); onClose(); };
    window.addEventListener('beforeunload', stopHandler);
  }

  private async pollBackend() {
    if (!this.isConnected) return;
    try {
      const res = await fetch(`${BACKEND}/live-receive`);
      if (res.ok) {
        const data = await res.json();
        if (data.transcription && this.onTranscription) {
          this.onTranscription('model', data.transcription);
        }
        if (data.audio) {
          const buffer = await this.decodeAudio(this.base64ToUint8Array(data.audio), 24000);
          this.playAudio(buffer);
        }
      }
    } catch (err) {
      console.error("Polling error", err);
    }
    setTimeout(() => this.pollBackend(), 200);
  }

  private downsampleTo16k(input: Float32Array, sampleRate: number): Int16Array {
    if (sampleRate === 16000) {
      const output = new Int16Array(input.length);
      for (let i = 0; i < input.length; i++) {
        let s = Math.max(-1, Math.min(1, input[i]));
        output[i] = s < 0 ? s*0x8000 : s*0x7FFF;
      }
      return output;
    }
    const ratio = sampleRate / 16000;
    const newLength = Math.round(input.length / ratio);
    const output = new Int16Array(newLength);
    for (let i=0;i<newLength;i++){
      const idx = Math.floor(i*ratio);
      let s = Math.max(-1, Math.min(1, input[idx]));
      output[i] = s<0?s*0x8000:s*0x7FFF;
    }
    return output;
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for(let i=0;i<len;i++){ binary+=String.fromCharCode(bytes[i]); }
    return btoa(binary);
  }

  private base64ToUint8Array(base64: string): Uint8Array {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i=0;i<len;i++){ bytes[i]=binaryString.charCodeAt(i); }
    return bytes;
  }

  private async decodeAudio(data: Uint8Array, sampleRate: number): Promise<AudioBuffer> {
    if (!this.outputContext) throw new Error("No output context");

    // ✅ Cast buffer here as well
    const dataInt16 = new Int16Array(data.buffer as ArrayBuffer);
    const frameCount = dataInt16.length;
    const buffer = this.outputContext.createBuffer(1, frameCount, sampleRate);
    const channelData = buffer.getChannelData(0);
    for(let i=0;i<frameCount;i++){ channelData[i]=dataInt16[i]/32768.0; }
    return buffer;
  }

  private playAudio(buffer: AudioBuffer) {
    if (!this.outputContext) return;
    const source = this.outputContext.createBufferSource();
    source.buffer = buffer;
    source.connect(this.outputContext.destination);

    const currentTime = this.outputContext.currentTime;
    if (this.nextStartTime < currentTime) this.nextStartTime = currentTime;
    source.start(this.nextStartTime);
    this.nextStartTime += buffer.duration;
  }

  disconnect() {
    this.isConnected = false;
    if (this.source) { this.source.disconnect(); this.source=null; }
    if (this.processor) { this.processor.disconnect(); this.processor=null; }
    if (this.stream) { this.stream.getTracks().forEach(t=>t.stop()); this.stream=null; }
    if (this.inputContext) { this.inputContext.close(); this.inputContext=null; }
    if (this.outputContext) { this.outputContext.close(); this.outputContext=null; }
  }
}
