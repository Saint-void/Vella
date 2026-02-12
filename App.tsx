import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Message, SidebarChat, User } from './types';
// UPDATED IMPORT: Added fetchSessions and fetchMessages
import { 
  sendMessageToVellaStream, 
  generateChatTitle, 
  fetchSessions, 
  fetchMessages 
} from './services/vellaService';
import { authService } from './services/authService';
import MessageBubble from './components/MessageBubble';
import TypingIndicator from './components/TypingIndicator';
import AuthPortal from './components/AuthPortal';
import HistoryDashboard from './components/HistoryDashboard';
import { VoidLogo } from './components/Logo';
import { 
  SendHorizontal, 
  Menu, 
  SquarePen, 
  Mic, 
  StopCircle, 
  History,
  LogOut,
  Settings,
  CheckCircle2,
  FileText,
  ChevronDown,
  Globe,
  HelpCircle,
  Zap
} from 'lucide-react';
import FullWaveform from "./components/FullWaveform";

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(authService.getCurrentUser());
  const [historyList, setHistoryList] = useState<SidebarChat[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false); // Mobile Drawer
  const [isExpanded, setIsExpanded] = useState(false); // Sidebar Wide/Slim
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isHistoryExpanded, setIsHistoryExpanded] = useState(true); // Inline Sidebar Dropdown
  const [isHistoryDashboardOpen, setIsHistoryDashboardOpen] = useState(false); // Full Tab View
  const [isAuthOverlayOpen, setIsAuthOverlayOpen] = useState(false);
  const [isDictating, setIsDictating] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false); // NEW: loading animation
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  // 1. LOAD HISTORY FROM DB ON STARTUP (FIXED MAPPING)
  useEffect(() => {
    const loadHistory = async () => {
      if (currentUser) {
        try {
          console.log("Fetching sessions for:", currentUser.id);
          const sessions = await fetchSessions(currentUser.id);
          console.log("Raw Backend Data:", sessions);

          // MAP DB ROWS (snake_case) TO UI (camelCase)
          const formattedSessions: SidebarChat[] = sessions.map((s: any) => ({
            id: s.id,
            title: s.title || "New Chat",
            // backend sends 'created_at', frontend needs 'timestamp' (number)
            timestamp: new Date(s.created_at).getTime(), 
            userId: s.user_id,
            // Initialize with empty messages so dashboard doesn't crash
            messages: [] 
          }));

          setHistoryList(formattedSessions);
        } catch (e) {
          console.error("Failed to load history:", e);
        }
      }
    };
    loadHistory();
  }, [currentUser]);

  // Auto-scroll to bottom whenever messages or loading state changes
  useEffect(() => {
    if (messages.length > 0 || isLoading) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [messages, isLoading]);
  
  // Toggle dictation
  const toggleDictation = async () => {
    // STOP RECORDING
    if (isDictating) {
      setIsDictating(false);
      setIsTranscribing(true); // show loading immediately
      mediaRecorderRef.current?.stop();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: "audio/webm;codecs=opus",
      });

      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (!e.data || e.data.size === 0) return;
        audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        if (!audioChunksRef.current.length) {
          setIsTranscribing(false);
          return;
        }

        const audioBlob = new Blob(audioChunksRef.current, {
          type: "audio/webm",
        });
        audioChunksRef.current = [];

        const formData = new FormData();
        formData.append("audio", audioBlob, "recording.webm");

        try {
          // ⚠️ Ensure this matches your ngrok URL or uses a config variable
          const res = await fetch("https://exhilaratingly-heaveless-lael.ngrok-free.dev/stt", {
            method: "POST",
            body: formData,
          });

          const data = await res.json();

          if (data.text) {
            setInput((prev) =>
              prev && !prev.endsWith(" ") ? prev + " " + data.text : prev + data.text
            );
          }
        } catch (err) {
          console.error("Whisper STT failed", err);
        } finally {
          setIsTranscribing(false); // hide loading ONLY when Whisper is done
        }
      };

      mediaRecorder.start();
      setIsDictating(true);
    } catch (err) {
      alert("Microphone permission denied");
      console.error(err);
    }
  };

  const handleActionClick = () => {
    if (input.trim()) {
      handleSendMessage();
    }
  };

  // --- UPDATED SEND LOGIC (DB INTEGRATION) ---
  const handleSendMessage = async (textOverride?: string) => {
    const textToSend = textOverride || input;
    if (!textToSend.trim() || isLoading) return;

    // Determine Session ID (Use existing or create new one)
    let activeSessionId = currentChatId;
    let isNewChat = false;

    if (!activeSessionId) {
      activeSessionId = Date.now().toString(); // Generate client-side ID for new chat
      setCurrentChatId(activeSessionId);
      isNewChat = true;
    }

    // 1. Add User Message UI
    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: textToSend,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true); 

    // 2. Add Empty Bot Placeholder UI
    const botMsgId = (Date.now() + 1).toString();
    const botMsgPlaceholder: Message = {
      id: botMsgId,
      role: 'model',
      content: '', 
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, botMsgPlaceholder]);

    let fullResponseText = ""; 
    let hasStartedStreaming = false;

    try {
      await sendMessageToVellaStream(
        textToSend,
        (token) => {
          // --- ON TOKEN RECEIVED ---
          if (!hasStartedStreaming) {
             setIsLoading(false);
             hasStartedStreaming = true;
          }

          fullResponseText += token;
          setMessages(prev => prev.map(msg => {
            if (msg.id === botMsgId) {
              return { ...msg, content: msg.content + token };
            }
            return msg;
          }));
        },
        async () => {
          // --- ON COMPLETE ---
          setIsLoading(false);
          
          // If this was a new chat, refresh the sidebar so the new session appears
          if (isNewChat && currentUser) {
             const updatedSessions = await fetchSessions(currentUser.id);
             setHistoryList(updatedSessions);
          }
        },
        activeSessionId, // Pass Session ID to backend
        currentUser?.id // Pass User ID to backend
      );
    } catch (error) {
        console.error("Chat Error", error);
        setIsLoading(false);
    }
  };

  // Close profile menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setIsProfileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    authService.logout();
    setCurrentUser(null);
    setMessages([]);
    setCurrentChatId(null);
    setHistoryList([]); // Clear history on logout
    setIsProfileMenuOpen(false);
  };

  const startNewChat = () => {
    setCurrentChatId(null);
    setMessages([]);
    setIsSidebarOpen(false);
  };

  // --- UPDATED SELECT CHAT (DB LOAD) ---
  const selectChat = async (id: string) => {
    if (!id) {
      startNewChat();
      return;
    }
    
    // Set UI to loading state if needed
    setIsSidebarOpen(false);
    setIsHistoryDashboardOpen(false);
    
    // 1. Set ID
    setCurrentChatId(id);
    
    // 2. Fetch Messages from DB
    const dbMessages = await fetchMessages(id);
    
    // 3. Map DB messages to UI format
    const formattedMessages: Message[] = dbMessages.map((msg: any, index: number) => ({
        id: index.toString(), // DB doesn't always send unique ID for frontend keys, using index is safe fallback for display
        role: msg.role,
        content: msg.content,
        timestamp: new Date(msg.created_at).getTime()
    }));
    
    setMessages(formattedMessages);
  };

  const deleteChat = (id: string) => {
    // Ideally, call a delete endpoint here
    setHistoryList(prev => prev.filter(c => c.id !== id));
    if (currentChatId === id) {
      setMessages([]);
      setCurrentChatId(null);
    }
  };

  const groupedHistory = useMemo(() => {
    return historyList.reduce((acc, chat) => {
      const date = new Date(chat.timestamp || Date.now()); // Fallback if timestamp missing
      const today = new Date();
      const yesterday = new Date();
      yesterday.setDate(today.getDate() - 1);
      let key = "Earlier";
      if (date.toDateString() === today.toDateString()) key = "Today";
      else if (date.toDateString() === yesterday.toDateString()) key = "Yesterday";
      if (!acc[key]) acc[key] = [];
      acc[key].push(chat);
      return acc;
    }, {} as Record<string, SidebarChat[]>);
  }, [historyList]);

  const ProfileMenuItem = ({ icon: Icon, label, onClick, hasArrow = false }: any) => (
    <button 
      onClick={onClick}
      className="w-full flex items-center justify-between px-4 py-3 text-zinc-300 hover:text-white hover:bg-white/5 transition-all text-sm group"
    >
      <div className="flex items-center gap-3">
        <Icon size={18} className="text-zinc-500 group-hover:text-zinc-200" />
        <span className="font-medium">{label}</span>
      </div>
    </button>
  );

  return (
    <div className="flex h-screen bg-[#0A0A0A] text-[#ECECEC] font-sans overflow-hidden pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">      
      {isSidebarOpen && (
        <div className="fixed inset-0 z-40 md:hidden backdrop-blur-overlay opacity-100" onClick={() => setIsSidebarOpen(false)} />
      )}
      {isAuthOverlayOpen && <AuthPortal onAuthenticated={u => { setCurrentUser(u); setIsAuthOverlayOpen(false); }} onClose={() => setIsAuthOverlayOpen(false)} />}
      
      {/* History Dashboard Full View Overlay */}
      {isHistoryDashboardOpen && (
        <HistoryDashboard 
          history={historyList} 
          onClose={() => setIsHistoryDashboardOpen(false)} 
          onSelectChat={selectChat}
          onDeleteChat={deleteChat}
        />
      )}

      <aside  className={`
            fixed md:relative z-50 h-full bg-black border-r border-white/10
            flex flex-col
            transition-transform duration-300 ease-out will-change-transform
            md:transition-[width] md:duration-300
            ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
            ${isExpanded ? '' : 'md:w-[40px]'}
            w-[75%] md:w-auto
            `}
          >
        {/* Top Branding */}
          <div className={`flex items-center py-2 px-1${isExpanded || isSidebarOpen ? 'py-2 px-1 ' : 'py-2 px-1'}`}>
            <VoidLogo className="w-13  text-white shrink-0" />
            {(isExpanded || isSidebarOpen)}
          </div>

        <div className="flex-1 overflow-y-auto flex flex-col gap-1 px-1 ">
          {[
            { id: 'chat', icon: SquarePen, label: 'Chat', action: startNewChat}
          ].map((item) => (
            <button 
              key={item.id}
              onClick={item.action}
              className={`flex items-center gap-6 rounded-xl transition-all group relative ${(isExpanded || isSidebarOpen) ? 'px-2' : 'justify-center w-12 h-12 mx-auto'} 'bg-zinc-900 text-white' : 'hover:text-zinc-200 hover:bg-white/[0.03]'}`}
            >
              <item.icon size={16} className="shrink-0" />
              {(isExpanded || isSidebarOpen) && <span className="text-sm font-medium animate-appear">{item.label}</span>}
            </button>
          ))}

          {/* MERGED HISTORY BUTTON WITH DROPDOWN + DASHBOARD Logic */}
          <div className="flex flex-col">
            <div 
              className={`
                flex items-center group relative cursor-pointer rounded-xl transition-all duration-300
                ${(isExpanded || isSidebarOpen) ? 'px-2 gap-1' : 'justify-center mx-auto'} 
                ${isHistoryDashboardOpen ? 'bg-zinc-900 text-white shadow-lg' : 'hover:bg-white/[0.05] hover:text-white'}
              `}
            >
              {/* Region 1: The Dropdown Toggle (Left Side) */}
             {/* Region 1: The Dropdown Toggle (Left Side) */}
              <button 
                onClick={(e) => { e.stopPropagation(); setIsHistoryExpanded(!isHistoryExpanded); }}
                className={`
                  p-2 rounded-lg transition-colors 
                  hover:bg-white/10 hover:text-white 
                  ${isHistoryExpanded ? 'text-white' : 'text-zinc-500'}
                  ${!(isExpanded || isSidebarOpen) && 'hidden'}
                `}
              >
                {/* ⬇️ ADDED ICON HERE ⬇️ */}
                <ChevronDown 
                  size={16} 
                  className={`transition-transform duration-200 ${isHistoryExpanded ? 'rotate-0' : '-rotate-90'}`} 
                />
              </button>
              
              {/* Region 2: The Action Button (Middle/Icon + Text) */}
              <button 
                onClick={() => setIsHistoryDashboardOpen(true)}
                className={`
                  flex items-center gap-3 flex-1 text-left  py-4 transition-all rounded-lg
                  ${!(isExpanded || isSidebarOpen) ? 'justify-center' : ''}
                `}
              >
                <History size={16} className="shrink-0 transition-transform group-hover:scale-110" />
                {(isExpanded || isSidebarOpen) && <span className="text-sm font-semibold tracking-tight animate-appear">History</span>}
              </button>
            </div>

            {/* Inline History List (Dropdown Content) */}
            {(isHistoryExpanded && (isExpanded || isSidebarOpen)) && (
              <div className="mt-2 px-6 space-y-6 animate-appear overflow-hidden">
                {Object.entries(groupedHistory).map(([key, chats]) => (
                  <div key={key}>
                    <h4 className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest mb-3 opacity-60">{key}</h4>
                    <div className="space-y-1 border-l border-zinc-800 ml-1">
                      {chats.map(chat => (
                        <button 
                          key={chat.id} 
                          onClick={() => selectChat(chat.id)} 
                          className={`
                            block w-full text-left pl-4 py-2 text-sm truncate transition-all border-l-2 -ml-[2px]
                            ${currentChatId === chat.id 
                              ? 'text-white border-white bg-white/5 font-medium' 
                              : 'text-zinc-500 border-transparent hover:text-zinc-300 hover:border-zinc-700'}
                          `}
                        >
                          {chat.title}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Bottom Dock */}
        <div className="p-4 mt-auto flex flex-col gap-4 border-t border-white/10 relative">
          {isProfileMenuOpen && (
            <div 
              ref={profileMenuRef}
              className={`absolute bottom-20 left-4 right-4 bg-[#1A1A1A] border border-white/10 rounded-[20px] shadow-2xl overflow-hidden animate-appear z-50 py-2 ${!isExpanded && 'left-14 w-64'}`}
            >
              <ProfileMenuItem icon={Settings} label="Settings" />
              <ProfileMenuItem icon={CheckCircle2} label="Tasks" />
              <ProfileMenuItem icon={FileText} label="Files" />
              <ProfileMenuItem icon={Globe} label="Grokipedia" />
              <ProfileMenuItem icon={HelpCircle} label="Help" hasArrow={true} />
              <div className="h-[1px] bg-white/5 my-1" />
              <ProfileMenuItem icon={Zap} label="Upgrade plan" />
              <ProfileMenuItem icon={LogOut} label="Sign Out" onClick={handleLogout} />
            </div>
          )}

          <div className={`flex items-center justify-between ${isExpanded || isSidebarOpen ? 'px-2' : 'justify-center flex-col gap-4'}`}>
            <div 
              onClick={() => currentUser ? setIsProfileMenuOpen(!isProfileMenuOpen) : setIsAuthOverlayOpen(true)}
              className="w-10 h-10 rounded-full bg-slate-500/30 border border-white/10 flex items-center justify-center text-xs font-bold text-slate-200 cursor-pointer hover:scale-105 active:scale-95 transition-all shrink-0"
            >
              {currentUser ? currentUser.name.charAt(0).toUpperCase() : 'G'}
            </div>
          </div>
        </div>
      </aside>

      <main className={`flex-1 flex flex-col h-full relative min-w-0 bg-black transition-all duration-500 ${isSidebarOpen ? 'blur-sm scale-[0.98]' : ''}`}>
        <header className="flex items-center justify-between p-4 md:hidden">
          <button onClick={() => setIsSidebarOpen(true)} className="p-3 text-white  rounded-2xl shadow-xl">
            <Menu size={20} />
          </button>
          <div className="w-10" />
        </header>

        <div className="flex-1 overflow-y-auto flex flex-col items-center">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full w-full max-w-2xl animate-appear text-center ">
              <div className="flex flex-row items-center justify-center mb-6">
               <VoidLogo className=" h-20"  />
              <span className="text-4xl font-bold mt-2"
              style={{ fontFamily: 'Inter, sans-serif' }}>
                Vella
              </span>
             </div>
              
               <div className="w-full max-w-3xl relative h-14 group">
              <div className={`flex items-center bg-[#111111] rounded-[120px] px-3 h-full border transition-all duration-300 ${
                isDictating || isTranscribing
                  ? 'ring-2 ring-white/50'
                  : 'border-white/10 group-hover:border-white/20'
              }`}>
              {isDictating || isTranscribing ? (
                <FullWaveform
                  colorClass="bg-white"
                  loading={isDictating} // only waveform animates when listening
                  processing={isTranscribing} // show blinking dots when processing
                  statusText={isDictating ? "Vella is listening" : "Vella is processing..."}
                />
              ) : (
                <input 
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
                  placeholder="Ask am anything..."
                  className="flex-1 bg-transparent outline-none text-base md:text-lg"
                />
              )}
              <div className="flex items-center gap-2">
                <button 
                  onClick={toggleDictation}
                  className={`p-2.5 rounded-full transition-all ${
                    isDictating ? 'bg-white text-black' : 'text-[#888] hover:text-white'
                  }`}
                >
                  {isDictating ? <StopCircle size={20} /> : <Mic size={20} />}
                </button>

                <button 
                  onClick={handleActionClick}
                  disabled={isTranscribing}
                  className={`p-2 rounded-full transition-all shadow-md ${
                    input.trim()
                      ? 'bg-white text-black hover:p-2'
                      : 'bg-white text-black hover:p-2'
                  } ${isTranscribing ? 'opacity-60 pointer-events-none' : ''}`}
                >
                  <SendHorizontal size={22} />
                </button>
              </div>
            </div>
              </div>
            </div>
          ) : (
            <div className="w-full max-w-3xl pt-24 pb-44 px-4 md:px-0">
              {messages.map(m => <MessageBubble key={m.id} message={m} />)}
              {isLoading && <TypingIndicator />}
              <div ref={messagesEndRef} className="h-4" />
            </div>
          )}
        </div>

         {messages.length > 0 && (
          <div className="absolute bottom-2 left-0 right-0  from-[#111111] via-[#111111] to-transparent flex flex-col items-center">
            <div className="w-full max-w-3xl relative h-14 group">
              <div className={`flex items-center bg-[#111111] rounded-[120px] px-3 h-full border transition-all duration-300 ${
                isDictating || isTranscribing
                  ? 'ring-2 ring-white/50'
                  : 'border-white/10 group-hover:border-white/20'
              }`}>
              {isDictating || isTranscribing ? (
                <FullWaveform
                  colorClass="bg-white"
                  loading={isDictating} // only waveform animates when listening
                  processing={isTranscribing} // show blinking dots when processing
                  statusText={isDictating ? "Vella is listening" : "Vella is processing..."}
                />
              ) : (
                <input 
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
                  placeholder="Ask am anything..."
                  className="flex-1 bg-transparent outline-none text-base md:text-lg"
                />
              )}
              <div className="flex items-center gap-2">
                <button 
                  onClick={toggleDictation}
                  className={`p-2.5 rounded-full transition-all ${
                    isDictating ? 'bg-white text-black' : 'text-[#888] hover:text-white'
                  }`}
                >
                  {isDictating ? <StopCircle size={20} /> : <Mic size={20} />}
                </button>

                <button 
                  onClick={handleActionClick}
                  disabled={isTranscribing}
                  className={`p-2 rounded-full transition-all shadow-md ${
                    input.trim()
                      ? 'bg-white text-black hover:p-2'
                      : 'bg-white text-black hover:p-2'
                  } ${isTranscribing ? 'opacity-60 pointer-events-none' : ''}`}
                >
                  <SendHorizontal size={22} />
                </button>
              </div>
            </div>

            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;