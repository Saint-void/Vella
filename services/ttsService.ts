// src/services/ttsService.ts

// ⚠️ Ensure this matches your ngrok or localhost URL
const BACKEND_URL = "https://exhilaratingly-heaveless-lael.ngrok-free.dev/tts"; 

class TTSService {
  private textQueue: string[] = [];       // Sentences waiting to be converted
  private audioQueue: string[] = [];      // Audio URLs ready to be played
  private isFetching: boolean = false;    // Is the downloader running?
  private isPlaying: boolean = false;     // Is the player running?
  private currentAudio: HTMLAudioElement | null = null;
  private abortController: AbortController | null = null;

  /**
   * Adds text to the queue and starts the pipeline.
   */
  speak(text: string, clearQueue = true) {
    if (clearQueue) {
      this.stop();
    }

    // Split paragraph into sentences nicely
    const sentences = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [text];

    sentences.forEach(sentence => {
      if (sentence.trim()) {
        this.textQueue.push(sentence.trim());
      }
    });

    // Start both workers: The Fetcher and The Player
    this.processTextQueue();
    this.processAudioQueue();
  }

  /**
   * WORKER 1: The Fetcher
   * Converts text to audio in the background as fast as possible.
   */
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
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: sentence }),
          signal: this.abortController.signal
        });

        if (!res.ok) throw new Error(`TTS Error: ${res.status}`);

        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        
        // Push the ready audio to the Audio Queue
        this.audioQueue.push(url);
        
        // If the player stopped because it ran out of audio, wake it up!
        if (!this.isPlaying) {
          this.processAudioQueue();
        }

      } catch (error: any) {
        if (error.name !== 'AbortError') console.error("TTS Fetch Error:", error);
      }
    }

    this.isFetching = false;
  }

  /**
   * WORKER 2: The Player
   * Plays audio files one by one from the buffer.
   */
  private async processAudioQueue() {
    if (this.isPlaying || this.audioQueue.length === 0) return;

    this.isPlaying = true;
    const audioUrl = this.audioQueue.shift();

    if (!audioUrl) {
      this.isPlaying = false;
      return;
    }

    try {
      await new Promise<void>((resolve) => {
        this.currentAudio = new Audio(audioUrl);
        
        // When this sentence finishes, resolve to play the next one immediately
        this.currentAudio.onended = () => {
          resolve();
        };

        this.currentAudio.onerror = () => {
          console.error("Audio playback error, skipping segment.");
          resolve();
        };

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
      // Immediately check for the next file
      this.processAudioQueue();
    }
  }

  /**
   * Stops everything and clears buffers.
   */
  stop() {
    // 1. Clear Queues
    this.textQueue = [];
    this.audioQueue = [];
    
    // 2. Stop Fetching
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    this.isFetching = false;

    // 3. Stop Playing
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      this.currentAudio = null;
    }
    this.isPlaying = false;
  }
}

export const ttsService = new TTSService();