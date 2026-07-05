import React, { useEffect, useRef, useState } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Copy, Check, Volume2, StopCircle, Loader2 } from 'lucide-react';
import { Message } from '../types';
import CodeBlock from './CodeBlock';
import { ttsService } from '../services/ttsService';

interface MessageBubbleProps {
  message: Message;
}

// ---------------------------------------------------------------------------
// Cross-bubble "read aloud" coordination
// ---------------------------------------------------------------------------
// ttsService is one shared audio pipeline, but isSpeaking/isLoadingSpeech live
// locally in each bubble. Without this, clicking "read aloud" on message B
// while message A is still playing leaves A's button stuck showing the
// speaking animation forever, since nothing ever tells A it got pre-empted.
// This is a tiny pub/sub so every bubble knows when another one takes over.
type SpeechToken = symbol;
let activeSpeechToken: SpeechToken | null = null;
const speechSubscribers = new Set<(token: SpeechToken | null) => void>();

function claimSpeech(token: SpeechToken) {
  activeSpeechToken = token;
  speechSubscribers.forEach((notify) => notify(token));
}

function releaseSpeech(token: SpeechToken) {
  if (activeSpeechToken === token) {
    activeSpeechToken = null;
    speechSubscribers.forEach((notify) => notify(null));
  }
}

function subscribeSpeech(callback: (token: SpeechToken | null) => void) {
  speechSubscribers.add(callback);
  return () => speechSubscribers.delete(callback);
}

// ---------------------------------------------------------------------------
// Markdown renderers
// ---------------------------------------------------------------------------
// Hoisted out of the component: none of these close over props or state, so
// defining them inline (as the original did) rebuilds the whole object, and
// every renderer closure inside it, on every re-render — including every
// token of a streamed response. Module scope means it's built once.
const markdownComponents: Components = {
  table({ children }) {
    return (
      <div className="my-5 w-full overflow-x-auto rounded-lg border border-white/10">
        <table className="w-full min-w-[680px] border-collapse text-left text-sm md:text-base">
          {children}
        </table>
      </div>
    );
  },
  thead({ children }) {
    return <thead className="bg-white/10 text-[#F5F5F5]">{children}</thead>;
  },
  tbody({ children }) {
    return <tbody className="divide-y divide-white/10">{children}</tbody>;
  },
  tr({ children }) {
    return <tr className="align-top">{children}</tr>;
  },
  th({ children }) {
    return (
      <th className="border-r border-white/10 px-4 py-3 font-semibold last:border-r-0">
        {children}
      </th>
    );
  },
  td({ children }) {
    return (
      <td className="border-r border-white/10 px-4 py-3 text-[#E2E2E2] last:border-r-0">
        {children}
      </td>
    );
  },
  // list-outside, not list-inside, is what actually fixes wrapped lines. With
  // `inside`, the marker eats into the content box, so a wrapped second line
  // falls back to the marker's own left edge instead of the first line's
  // text edge. `outside` puts the marker in the gutter so every line — first
  // or wrapped — lines up under the same left edge.
  ol({ children }) {
    return (
      <ol className="list-decimal list-outside pl-6 my-2 space-y-1.5 marker:text-[#B4B4B4]">
        {children}
      </ol>
    );
  },
  ul({ children }) {
    return (
      <ul className="list-disc list-outside pl-6 my-2 space-y-1.5 marker:text-[#B4B4B4]">
        {children}
      </ul>
    );
  },
  li({ children }) {
    return <li className="pl-1 text-[#ECECEC] leading-relaxed">{children}</li>;
  },
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

    return <CodeBlock className={className}>{children}</CodeBlock>;
  },
};

const MessageBubble: React.FC<MessageBubbleProps> = ({ message }) => {
  const isUser = message.role === 'user';
  const [isCopied, setIsCopied] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isLoadingSpeech, setIsLoadingSpeech] = useState(false);
  const speechTokenRef = useRef<SpeechToken>(Symbol('speech'));

  // Reset this bubble's UI the moment another bubble claims the speech slot,
  // and stop actual audio if this bubble unmounts while it owns that slot
  // (e.g. the message gets deleted/regenerated mid-playback).
  useEffect(() => {
    const token = speechTokenRef.current;
    const unsubscribe = subscribeSpeech((activeToken) => {
      if (activeToken !== token) {
        setIsSpeaking(false);
        setIsLoadingSpeech(false);
      }
    });
    return () => {
      unsubscribe();
      if (activeSpeechToken === token) {
        ttsService.stop();
        releaseSpeech(token);
      }
    };
  }, []);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text:', err);
    }
  };

  const handleReadAloud = () => {
    const token = speechTokenRef.current;

    // Already active on this bubble -> stop, don't restart.
    if (isSpeaking || isLoadingSpeech) {
      ttsService.stop();
      releaseSpeech(token);
      setIsSpeaking(false);
      setIsLoadingSpeech(false);
      return;
    }

    // Unlock the audio driver synchronously inside the click handler — needed
    // for autoplay policy on iOS/Safari. Only relevant when we're actually
    // about to start playback, so this no longer fires on every click.
    const audioUnlocker = new Audio();
    audioUnlocker.play().catch(() => {});

    claimSpeech(token);
    setIsLoadingSpeech(true);
    setIsSpeaking(false);

    try {
      ttsService
        .speak(message.content, true, () => {
          setIsLoadingSpeech(false);
          setIsSpeaking(true);
        })
        .then(() => {
          releaseSpeech(token);
          setIsLoadingSpeech(false);
          setIsSpeaking(false);
        })
        .catch((err) => {
          console.error('Speech queue playback crashed:', err);
          releaseSpeech(token);
          setIsLoadingSpeech(false);
          setIsSpeaking(false);
        });
    } catch (err) {
      console.error('Speech initialization error:', err);
      releaseSpeech(token);
      setIsLoadingSpeech(false);
      setIsSpeaking(false);
    }
  };

  const isSpeechActive = isSpeaking || isLoadingSpeech;

  return (
    <div className={`flex w-full mb-6 ${isUser ? 'justify-end animate-msg-right' : 'justify-start animate-msg-left'}`}>
      <div className={`flex max-w-[90%] md:max-w-[80%] ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
        <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} w-full`}>
          <div
            className={`px-5 py-3 text-lg leading-relaxed group relative
            ${isUser ? 'bg-[#2F2F2F] text-[#ECECEC] rounded-3xl' : 'bg-transparent text-[#ECECEC] px-0 w-full'}`}
          >
            {isUser ? (
              <p className="whitespace-pre-wrap">{message.content}</p>
            ) : (
              <>
                <div className="prose prose-invert prose-lg max-w-none prose-p:my-2 prose-pre:bg-transparent prose-pre:p-0 prose-pre:m-0">
                  <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                    {message.content}
                  </ReactMarkdown>
                </div>

                {message.content && message.content.trim().length > 0 && (
                  <div className="mt-4 flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <button
                      type="button"
                      onClick={handleCopy}
                      className="p-2 text-[#B4B4B4] hover:text-white hover:bg-[#2F2F2F] rounded-xl transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
                      aria-label="Copy response"
                      title="Copy to clipboard"
                    >
                      {isCopied ? <Check size={18} className="text-green-400" /> : <Copy size={18} />}
                    </button>

                    <button
                      type="button"
                      onClick={handleReadAloud}
                      className={`flex items-center gap-2 p-2 rounded-xl transition-all hover:bg-[#2F2F2F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30
                        ${isSpeechActive ? 'text-white' : 'text-[#B4B4B4] hover:text-white'}`}
                      aria-label={isSpeechActive ? 'Stop reading' : 'Read aloud'}
                      title={isSpeechActive ? 'Stop reading' : 'Read aloud'}
                    >
                      {isLoadingSpeech ? (
                        <>
                          <StopCircle size={18} className="text-white hover:text-red-400 transition-colors" />
                          <Loader2 size={16} className="animate-spin motion-reduce:animate-none text-white ml-1" />
                        </>
                      ) : isSpeaking ? (
                        <>
                          <StopCircle size={18} className="text-white hover:text-red-400 transition-colors" />
                          <div className="flex items-center gap-[2px] h-3 px-1">
                            <div className="w-1 bg-white rounded-full animate-pulse motion-reduce:animate-none" style={{ height: '100%', animationDuration: '0.6s' }} />
                            <div className="w-1 bg-white rounded-full animate-pulse motion-reduce:animate-none" style={{ height: '60%', animationDuration: '0.8s' }} />
                            <div className="w-1 bg-white rounded-full animate-pulse motion-reduce:animate-none" style={{ height: '80%', animationDuration: '0.7s' }} />
                            <div className="w-1 bg-white rounded-full animate-pulse motion-reduce:animate-none" style={{ height: '50%', animationDuration: '0.5s' }} />
                          </div>
                        </>
                      ) : (
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

export default React.memo(MessageBubble);