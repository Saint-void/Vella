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
  X,
  HelpCircle,
  LogIn,
  UserPlus,
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
  const [authPortalMode, setAuthPortalMode] = useState<'login' | 'signup'>('login');
  const [isDictating, setIsDictating] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false); // NEW: loading animation
  const [sttAbortController, setSttAbortController] = useState<AbortController | null>(null);
  const [abortController, setAbortController] = useState<AbortController | null>(null);
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
          
        // try {
        //   // ⚠️ Ensure this matches your ngrok URL or uses a config variable
        //   const res = await fetch(" http://localhost:8001/stt", {
        //     method: "POST",
        //     body: formData,
        //   });

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

  // 👇 ADD THIS FUNCTION
  const handleStopGeneration = () => {
    if (abortController) {
      abortController.abort(); // Sends the kill signal
      setAbortController(null);
      setIsLoading(false);
    }
  };

  const handleActionClick = () => {
    if (input.trim()) {
      handleSendMessage();
    }
  };

  // --- UPDATED SEND LOGIC (DB INTEGRATION) ---
 const handleSendMessage = async () => {
    if (!input.trim() || isLoading) return;

    let activeSessionId = currentChatId;
    let isNewChat = false;

    if (!activeSessionId) {
      activeSessionId = Date.now().toString();
      setCurrentChatId(activeSessionId);
      isNewChat = true;
    }

    const textToSend = input;
    setInput('');
    setIsLoading(true);

    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: textToSend, timestamp: Date.now() };
    setMessages(prev => [...prev, userMsg]);

    const botMsgId = (Date.now() + 1).toString();
    const botMsg: Message = { id: botMsgId, role: 'model', content: '', timestamp: Date.now() };
    setMessages(prev => [...prev, botMsg]);

    let hasStarted = false;

    // 👇 CREATE THE CONTROLLER
    const newController = new AbortController();
    setAbortController(newController);

    try {
      await sendMessageToVellaStream(
        textToSend,
        (token) => {
          if (!hasStarted) { setIsLoading(false); hasStarted = true; }
          setMessages(prev => prev.map(m => m.id === botMsgId ? { ...m, content: m.content + token } : m));
        },
        async () => {
          setIsLoading(false);
          setAbortController(null); // 👇 CLEAR THE CONTROLLER WHEN DONE
          
          if (isNewChat && currentUser) {
            console.log("🔄 New chat created. Refreshing sidebar...");
            const updated = await fetchSessions(currentUser.id);
            const formatted: SidebarChat[] = updated.map((s: any) => ({
                id: s.id, title: s.title || "New Chat", messages: [], timestamp: new Date(s.created_at).getTime(), userId: s.user_id
            }));
            setHistoryList(formatted);
          }
        },
        activeSessionId, 
        currentUser?.id,
        newController.signal // 👇 PASS THE SIGNAL TO THE API CALL
      );
    } catch (e) {
      console.error(e);
      setIsLoading(false);
      setAbortController(null);
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

  const openAuthPortal = (mode: 'login' | 'signup') => {
    setAuthPortalMode(mode);
    setIsAuthOverlayOpen(true);
  };

  return (
    <div className="flex h-screen bg-[#0A0A0A] text-[#ECECEC] font-sans overflow-hidden pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">      
      {currentUser && isSidebarOpen && (
        <div className="fixed inset-0 z-40 md:hidden backdrop-blur-overlay opacity-100" onClick={() => setIsSidebarOpen(false)} />
      )}
      {isAuthOverlayOpen && <AuthPortal initialMode={authPortalMode} onAuthenticated={u => { setCurrentUser(u); setIsAuthOverlayOpen(false); }} onClose={() => setIsAuthOverlayOpen(false)} />}
      
      {/* History Dashboard Full View Overlay */}
      {isHistoryDashboardOpen && (
        <HistoryDashboard 
          history={historyList} 
          onClose={() => setIsHistoryDashboardOpen(false)} 
          onSelectChat={selectChat}
          onDeleteChat={deleteChat}
        />
      )}

      {currentUser && (
      <aside  className={`
            fixed md:relative z-50 h-full bg-black border-r border-white/10
            flex flex-col
            transition-transform duration-300 ease-out will-change-transform
            md:transition-[width] md:duration-300
            ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
            ${isExpanded ? '' : 'md:w-[52px]'}
            w-[75%] md:w-auto
            `}
          >
        {/* Top Branding */}
          <div className={`flex h-14 items-center px-2 ${(isExpanded || isSidebarOpen) ? 'justify-start' : 'justify-center'}`}>
            <VoidLogo className="h-12 w-12 shrink-0 object-contain text-white" />
          </div>

        <div className="flex-1 overflow-y-auto flex flex-col gap-1 px-2">
          {[
            { id: 'chat', icon: SquarePen, label: 'Chat', action: startNewChat}
          ].map((item) => (
            <button 
              key={item.id}
              onClick={item.action}
              className={`flex h-12 w-full items-center rounded-xl transition-all group relative hover:text-zinc-200 hover:bg-white/[0.03] ${(isExpanded || isSidebarOpen) ? 'justify-start gap-3 px-3' : 'justify-center'}`}
            >
              <item.icon size={16} className="shrink-0" />
              {(isExpanded || isSidebarOpen) && <span className="text-sm font-medium animate-appear">{item.label}</span>}
            </button>
          ))}

          {/* MERGED HISTORY BUTTON WITH DROPDOWN + DASHBOARD Logic */}
          <div className="flex flex-col">
            <div
              className={`
                flex h-12 w-full items-center group relative cursor-pointer rounded-xl transition-all duration-300
                ${(isExpanded || isSidebarOpen) ? 'justify-start' : 'justify-center'} 
                ${isHistoryDashboardOpen ? 'bg-zinc-900 text-white shadow-lg' : 'hover:bg-white/[0.05] hover:text-white'}
              `}
            >
              {/* Region 1: The Action Button (Icon + Text) */}
              <button 
                onClick={() => setIsHistoryDashboardOpen(true)}
                className={`
                  flex h-full items-center gap-3 rounded-lg transition-all
                  ${(isExpanded || isSidebarOpen) ? 'flex-1 justify-start px-3 text-left' : 'justify-center'}
                `}
              >
                <History size={16} className="shrink-0 transition-transform group-hover:scale-110" />
                {(isExpanded || isSidebarOpen) && <span className="text-sm font-semibold tracking-tight animate-appear">History</span>}
              </button>

              {/* Region 2: The Dropdown Toggle */}
              <button 
                onClick={(e) => { e.stopPropagation(); setIsHistoryExpanded(!isHistoryExpanded); }}
                className={`
                  mr-1 p-2 rounded-lg transition-colors 
                  hover:bg-white/10 hover:text-white 
                  ${isHistoryExpanded ? 'text-white' : 'text-zinc-500'}
                  ${!(isExpanded || isSidebarOpen) && 'hidden'}
                `}
              >
                <ChevronDown 
                  size={16} 
                  className={`transition-transform duration-200 ${isHistoryExpanded ? 'rotate-0' : '-rotate-90'}`} 
                />
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
              onClick={() => currentUser ? setIsProfileMenuOpen(!isProfileMenuOpen) : openAuthPortal('login')}
              className="w-10 h-10 rounded-full bg-slate-500/30 border border-white/10 flex items-center justify-center text-xs font-bold text-slate-200 cursor-pointer hover:scale-105 active:scale-95 transition-all shrink-0"
            >
              {currentUser ? currentUser.name.charAt(0).toUpperCase() : 'G'}
            </div>
          </div>
        </div>
      </aside>
      )}

      <main className={`flex-1 flex flex-col h-full relative min-w-0 overflow-hidden bg-[#050505] transition-all duration-500 ${currentUser && isSidebarOpen ? 'blur-sm scale-[0.98]' : ''}`}>
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:64px_64px] opacity-25" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(34,211,238,0.12),transparent_45%),linear-gradient(180deg,rgba(255,255,255,0.035),transparent_22%)]" />
        {!currentUser && (
          <div className="absolute left-4 top-4 z-30 hidden items-center gap-2 md:flex">
            <VoidLogo className="h-13 w-13 shrink-0 object-contain text-white" />
          </div>
        )}
        {!currentUser && (
          <div className="absolute right-4 top-4 z-30 hidden items-center gap-2 md:flex">
            <button
              onClick={() => openAuthPortal('login')}
              className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-4 py-2 text-sm font-semibold text-zinc-200 backdrop-blur-md transition-all hover:border-white/20 hover:bg-white/10 hover:text-white"
            >
              <LogIn size={16} />
              Login
            </button>
            <button
              onClick={() => openAuthPortal('signup')}
              className="flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-bold text-black transition-all hover:bg-zinc-200"
            >
              <UserPlus size={16} />
              Sign up
            </button>
          </div>
        )}

        <header className="flex items-center justify-between p-4 md:hidden">
          {currentUser ? (
            <button onClick={() => setIsSidebarOpen(true)} className="p-3 text-white  rounded-2xl shadow-xl">
              <Menu size={20} />
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <VoidLogo className="h-9 w-9 shrink-0 object-contain text-white" />
              <span className="text-base font-bold tracking-tight text-white">Vella</span>
            </div>
          )}
          {!currentUser ? (
            <div className="flex items-center gap-2">
              <button
                onClick={() => openAuthPortal('login')}
                className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-2 text-xs font-semibold text-zinc-200"
              >
                Login
              </button>
              <button
                onClick={() => openAuthPortal('signup')}
                className="rounded-full bg-white px-3 py-2 text-xs font-bold text-black"
              >
                Sign up
              </button>
            </div>
          ) : (
            <div className="w-10" />
          )}
        </header>

        <div className="relative z-10 flex-1 overflow-y-auto flex flex-col items-center">
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

                {/* 👇 IF GENERATING, SHOW STOP BUTTON, OTHERWISE SHOW SEND BUTTON */}
              {abortController ? (
                <button onClick={handleStopGeneration} className="p-2 bg-zinc-800 text-white rounded-full hover:bg-zinc-700 transition-all shadow-md border border-white/10">
                  <StopCircle size={20} />
                </button>
              ) : (
                <button onClick={handleSendMessage} className="p-2 bg-white text-black rounded-full hover:scale-105 transition-all shadow-md">
                  <SendHorizontal size={20} />
                </button>
              )}
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
          <div className="absolute bottom-2 left-0 right-0 z-20 from-[#111111] via-[#111111] to-transparent flex flex-col items-center">
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

                {/* 👇 IF GENERATING, SHOW STOP BUTTON, OTHERWISE SHOW SEND BUTTON */}
              {abortController ? (
                <button onClick={handleStopGeneration} className="p-2 bg-zinc-800 text-white rounded-full hover:bg-zinc-700 transition-all shadow-md border border-white/10">
                  <StopCircle size={20} />
                </button>
              ) : (
                <button onClick={handleSendMessage} className="p-2 bg-white text-black rounded-full hover:scale-105 transition-all shadow-md">
                  <SendHorizontal size={20} />
                </button>
              )}
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
