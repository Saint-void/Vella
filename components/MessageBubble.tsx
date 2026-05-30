import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Copy, Check, Volume2, StopCircle, Loader2 } from 'lucide-react'; 
import { Message } from '../types';
import CodeBlock from './CodeBlock';
import { ttsService } from '../services/ttsService';

interface MessageBubbleProps {
  message: Message;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ message }) => {
  const isUser = message.role === 'user';
  const [isCopied, setIsCopied] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isLoadingSpeech, setIsLoadingSpeech] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text:', err);
    }
  };

  const handleReadAloud = async () => {
    // ⚡ BROWSER UNLOCKER: Force warm-up the audio driver directly on the click thread
    const audioUnlocker = new Audio();
    audioUnlocker.play().catch(() => {});

    // If it is doing anything (loading or speaking), stop it immediately
    if (isSpeaking || isLoadingSpeech) {
      ttsService.stop();
      setIsSpeaking(false);
      setIsLoadingSpeech(false);
      return;
    }

    // Phase 1: Enter loading state
    setIsLoadingSpeech(true);
    setIsSpeaking(false); 
    
    try {
      // ⚡ FIX: Removed 'await' here so the execution context doesn't block.
      // We rely on callbacks and internal promises to update UI lifecycles.
      ttsService.speak(
        message.content, 
        true,
        // 👇 Phase 2: Callback triggers the moment the first sentence plays
        () => {
          setIsLoadingSpeech(false);
          setIsSpeaking(true);
        }
      )
      .then(() => {
        // 👇 Phase 3: Triggers only when the entire speech queue finishes naturally
        setIsLoadingSpeech(false);
        setIsSpeaking(false);
      })
      .catch((err) => {
        console.error('Speech queue playback crashed:', err);
        setIsLoadingSpeech(false);
        setIsSpeaking(false);
      });

    } catch (err) {
      console.error('Speech initialization error:', err);
      setIsLoadingSpeech(false);
      setIsSpeaking(false);
    }
    // ⚡ FIX: Removed the global 'finally' block that was breaking the asynchronous state.
  };

  return (
    <div className={`flex w-full mb-6 ${isUser ? 'justify-end animate-msg-right' : 'justify-start animate-msg-left'}`}>
      <div className={`flex max-w-[90%] md:max-w-[80%] ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
        
        {/* Content */}
        <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} w-full`}>
          <div className={`px-5 py-3 text-lg leading-relaxed group relative
            ${isUser 
              ? 'bg-[#2F2F2F] text-[#ECECEC] rounded-3xl' 
              : 'bg-transparent text-[#ECECEC] px-0 w-full'
            }`}>
            
            {isUser ? (
              <p className="whitespace-pre-wrap">{message.content}</p>
            ) : (
              <>
                <div className="prose prose-invert prose-lg max-w-none prose-p:my-2 prose-pre:bg-transparent prose-pre:p-0 prose-pre:m-0">
                  <ReactMarkdown
                    components={{
                      // 👑 FIX 1: Explicitly style ordered lists so numbers stay inside bounds with a proper left gutter
                      ol({ children }) {
                        return (
                          <ol className="list-decimal list-inside pl-2 my-2 space-y-1 text-[#ECECEC]">
                            {children}
                          </ol>
                        );
                      },
                      // 👑 FIX 2: Explicitly style unordered lists (bullets) just in case
                      ul({ children }) {
                        return (
                          <ul className="list-disc list-inside pl-2 my-2 space-y-1 text-[#ECECEC]">
                            {children}
                          </ul>
                        );
                      },
                      // 👑 FIX 3: Keep list items block-aligned so random breaks don't ruin text layouts
                      li({ children }) {
                        return <li className="inline-block w-full my-0.5">{children}</li>;
                      },
                      // Your existing custom code block handler remains completely untouched
                      code({ className, children, ...props }) {
                        const match = /language-(\w+)/.exec(className || '');
                        const isInline = !match && !String(children).includes('\n');
                        
                        if (isInline) {
                          return (
                            <code className="bg-[#1e1e1e] text-[#FF79C6] rounded px-1.5 py-0.5 font-mono text-[0.9em]" {...props}>
                              {children}
                            </code>
                          );
                        }

                        return (
                          <CodeBlock className={className}>
                            {children}
                          </CodeBlock>
                        );
                      }
                    }}
                  >
                    {message.content}
                  </ReactMarkdown>
                </div>
                
                {/* --- Action Bar --- */}
                {message.content && message.content.trim().length > 0 && (
                  <div className="mt-4 flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <button
                      onClick={handleCopy}
                      className="p-2 text-[#B4B4B4] hover:text-white hover:bg-[#2F2F2F] rounded-xl transition-all"
                      aria-label="Copy response"
                      title="Copy to clipboard"
                    >
                      {isCopied ? (
                        <Check size={18} className="text-green-400" />
                      ) : (
                        <Copy size={18} />
                      )}
                    </button>

                    <button
                      onClick={handleReadAloud}
                      className={`flex items-center gap-2 p-2 rounded-xl transition-all relative overflow-hidden
                        ${(isSpeaking || isLoadingSpeech)
                          ? 'text-white hover:bg-[#2F2F2F] border border-transparent' 
                          : 'text-[#B4B4B4] hover:text-white hover:bg-[#2F2F2F] border border-transparent'
                        }
                      `}
                      aria-label="Read aloud"
                      title={(isSpeaking || isLoadingSpeech) ? "Stop reading" : "Read aloud"}
                    >
                      {/* STATE 1: LOADING */}
                      {isLoadingSpeech ? (
                        <>
                          <StopCircle size={18} className="text-white hover:text-red-400 transition-colors" />
                          <Loader2 size={16} className="animate-spin text-white ml-1" />
                        </>
                      ) : 
                      /* STATE 2: SPEAKING */
                      isSpeaking ? (
                        <>
                          <StopCircle size={18} className="text-white hover:text-red-400 transition-colors" />
                          <div className="flex items-center gap-[2px] h-3 px-1">
                            <div className="w-1 bg-white rounded-full animate-pulse" style={{ height: '100%', animationDuration: '0.6s' }}></div>
                            <div className="w-1 bg-white rounded-full animate-pulse" style={{ height: '60%', animationDuration: '0.8s' }}></div>
                            <div className="w-1 bg-white rounded-full animate-pulse" style={{ height: '80%', animationDuration: '0.7s' }}></div>
                            <div className="w-1 bg-white rounded-full animate-pulse" style={{ height: '50%', animationDuration: '0.5s' }}></div>
                          </div>
                        </>
                      ) : 
                      /* STATE 3: IDLE */
                      (
                        <Volume2 size={18} />
                      )}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MessageBubble;
