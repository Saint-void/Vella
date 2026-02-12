/**
 * streamProcessor.ts
 * Buffers text and detects complete sentences for TTS.
 */
export class StreamProcessor {
  private buffer: string = "";
  private onSentenceFound: (sentence: string) => void;

  constructor(onSentenceFound: (sentence: string) => void) {
    this.onSentenceFound = onSentenceFound;
  }

  /**
   * Add a chunk of text (token) to the buffer.
   * If a sentence end is detected, it triggers the callback.
   */
  addToken(token: string) {
    this.buffer += token;
    this.checkBuffer();
  }

  /**
   * Checks if the buffer contains a full sentence.
   */
  private checkBuffer() {
    // Regex looks for terminal punctuation (. ! ?) followed by whitespace or end of string
    // This splits "Hello world. How are you?" into "Hello world."
    const sentenceMatch = this.buffer.match(/.*?[.!?](?:\s|$)/);

    if (sentenceMatch) {
      const sentence = sentenceMatch[0];
      
      // Remove the found sentence from the buffer
      this.buffer = this.buffer.slice(sentence.length);
      
      // Send it to be spoken
      if (sentence.trim().length > 0) {
        this.onSentenceFound(sentence.trim());
      }
      
      // Check again in case there are multiple sentences in one chunk
      this.checkBuffer();
    }
  }

  /**
   * Call this when generation is done to speak any remaining text (fragments).
   */
  flush() {
    if (this.buffer.trim().length > 0) {
      this.onSentenceFound(this.buffer.trim());
      this.buffer = "";
    }
  }
}