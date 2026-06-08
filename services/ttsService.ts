// src/services/ttsService.ts

// ⚠️ Ensure this matches your ngrok or localhost URL
// const BACKEND_URL = "https://exhilaratingly-heaveless-lael.ngrok-free.dev/tts"; 
const BACKEND_URL = "http://localhost:8001/tts"; // Uncomment for local testing


class TTSService {
  private textQueue: string[] = [];       
  private audioQueue: string[] = [];      
  private isFetching: boolean = false;    
  private isPlaying: boolean = false;     
  private currentAudio: HTMLAudioElement | null = null;
  private abortController: AbortController | null = null;
  
  private onFinishCallback: (() => void) | null = null;
  // 👇 NEW: Keeps track of when the first audio actually starts
  private onStartCallback: (() => void) | null = null;

  /**
   * Adds text to the queue and starts the pipeline.
   * NEW: Accepts an onStart callback!
   */
  speak(text: string, clearQueue = true, onStart?: () => void): Promise<void> {
    return new Promise((resolve) => {
      if (clearQueue) {
        this.stop();
      }

      this.onFinishCallback = resolve;
      this.onStartCallback = onStart || null;

      const sentences = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [text];

      sentences.forEach(sentence => {
        if (sentence.trim()) {
          this.textQueue.push(sentence.trim());
        }
      });

      this.processTextQueue();
      this.processAudioQueue();
    });
  }

  private checkIfDone() {
    if (!this.isFetching && !this.isPlaying && this.textQueue.length === 0 && this.audioQueue.length === 0) {
      if (this.onFinishCallback) {
        this.onFinishCallback(); 
        this.onFinishCallback = null;
      }
    }
  }

  private async processTextQueue() {
    if (this.isFetching || this.textQueue.length === 0) return;

    this.isFetching = true;

    while (this.textQueue.length > 0) {
      const sentence = this.textQueue.shift();
      if (!sentence) continue;

      try {
        this.abortController = new AbortController();

        const res = await fetch(BACKEND_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", "ngrok-skip-browser-warning": "true" },
          body: JSON.stringify({ text: sentence }),
          signal: this.abortController.signal
        });

        if (!res.ok) throw new Error(`TTS Error: ${res.status}`);

        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        
        this.audioQueue.push(url);
        
        if (!this.isPlaying) {
          this.processAudioQueue();
        }

      } catch (error: any) {
        if (error.name !== 'AbortError') console.error("TTS Fetch Error:", error);
      }
    }

    this.isFetching = false;
    this.checkIfDone(); 
  }

  private async processAudioQueue() {
    if (this.isPlaying) return;

    if (this.audioQueue.length === 0) {
      this.checkIfDone(); 
      return;
    }

    this.isPlaying = true;
    const audioUrl = this.audioQueue.shift();

    if (!audioUrl) {
      this.isPlaying = false;
      this.checkIfDone();
      return;
    }

    try {
      await new Promise<void>((resolve) => {
        this.currentAudio = new Audio(audioUrl);
        
        this.currentAudio.onended = () => resolve();

        this.currentAudio.onerror = () => {
          console.error("Audio playback error, skipping segment.");
          resolve();
        };

        // 👇 NEW: Trigger the UI change right before we hit play!
        if (this.onStartCallback) {
          this.onStartCallback();
          this.onStartCallback = null; // Clear it so it only fires on the first sentence
        }

        this.currentAudio.play().catch(err => {
            console.warn("Autoplay blocked or stopped:", err);
            resolve();
        });
      });
    } catch (error) {
      console.error("Playback Manager Error:", error);
    } finally {
      this.isPlaying = false;
      this.currentAudio = null;
      this.processAudioQueue();
    }
  }

  stop() {
    this.textQueue = [];
    this.audioQueue = [];
    
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    this.isFetching = false;

    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      this.currentAudio = null;
    }
    this.isPlaying = false;

    if (this.onFinishCallback) {
      this.onFinishCallback();
      this.onFinishCallback = null;
    }
    // 👇 NEW: Clear the start callback if stopped early
    this.onStartCallback = null; 
  }
}

export const ttsService = new TTSService();