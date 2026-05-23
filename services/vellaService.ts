// src/services/vellaService.ts

// ⚠️ UPDATE THIS URL EVERY TIME YOU RESTART NGROK
// const BACKEND = "https://exhilaratingly-heaveless-lael.ngrok-free.dev"; 
const BACKEND = "http://localhost:8001"; // Uncomment for local testing

export interface ChatReq {
  prompt: string;
  max_new_tokens: number;
}

/**
 * 1. GET HISTORY: Fetch list of previous conversations
 */
export const fetchSessions = async (userId: string) => {
  try {
    const res = await fetch(`${BACKEND}/history/sessions?user_id=${userId}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "ngrok-skip-browser-warning": "true", // <--- ⚠️ THIS FIXES THE NGROK ISSUE
      },
    });
    
    if (!res.ok) throw new Error("Failed to fetch sessions");
    return await res.json();
  } catch (error) {
    console.error("Error fetching sessions:", error);
    return [];
  }
};

/**
 * 2. GET MESSAGES: Fetch all messages for a specific chat ID
 */
export const fetchMessages = async (sessionId: string) => {
  try {
    const res = await fetch(`${BACKEND}/history/${sessionId}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "ngrok-skip-browser-warning": "true", // <--- ⚠️ ADD HERE TOO
      },
    });

    if (!res.ok) throw new Error("Failed to fetch messages");
    return await res.json();
  } catch (error) {
    console.error("Error fetching messages:", error);
    return [];
  }
};

/**
 * 3. SEND MESSAGE (STREAMING)
 */
export const sendMessageToVellaStream = async (
  text: string, 
  onTokenReceived: (token: string) => void,
  onComplete?: () => void,
  sessionId?: string,
  userId?: string,
  abortSignal?: AbortSignal // <--- NEW: Accept the kill signal
): Promise<void> => {
  
  try {
    const response = await fetch(`${BACKEND}/chat`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true',
        'x-session-id': sessionId || '',
        'x-user-id': userId || 'anonymous'
      },
      body: JSON.stringify({ 
        prompt: text, 
        max_new_tokens: 200 
      }),
      signal: abortSignal // <--- NEW: Attach signal to the request
    });

    if (!response.body) {
      throw new Error("ReadableStream not supported in this browser.");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      onTokenReceived(chunk);
    }

    if (onComplete) onComplete();

  } catch (error: any) {
    // NEW: Handle the intentional abort gracefully without throwing a big red error
    if (error.name === 'AbortError') {
      console.log("Stream stopped by user");
    } else {
      console.error("Stream Error:", error);
      onTokenReceived("\n[Error: Could not connect to Vella Backend]");
    }
    if (onComplete) onComplete();
  }
};

export async function sendMessageToVella(message: string) {
  return "Please use sendMessageToVellaStream.";
}

export async function generateChatTitle(firstMessage: string, firstReply: string) {
  try {
    return firstMessage.length > 30 ? firstMessage.substring(0, 30) + "..." : firstMessage;
  } catch (e) {
    return "New Chat";
  }
}