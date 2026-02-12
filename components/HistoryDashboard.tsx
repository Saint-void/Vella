import React, { useState, useMemo } from 'react';
import { SidebarChat, Message } from '../types';
import { 
  X, 
  Search, 
  Plus, 
  Trash2, 
  Maximize2,
  CornerDownRight,
  Clock,
  ChevronRight
} from 'lucide-react';
import { VoidLogo } from './Logo';

interface HistoryDashboardProps {
  history: SidebarChat[];
  onClose: () => void;
  onSelectChat: (id: string) => void;
  onDeleteChat: (id: string) => void;
}

const HistoryDashboard: React.FC<HistoryDashboardProps> = ({ 
  history, 
  onClose, 
  onSelectChat, 
  onDeleteChat 
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(history[0]?.id || null);

  // --- FIX 1: Safe Filtering ---
  // We added (chat.messages || []) to prevent crashing if messages haven't loaded yet
  const filteredHistory = useMemo(() => {
    return history.filter(chat => {
      const titleMatch = (chat.title || '').toLowerCase().includes(searchQuery.toLowerCase());
      const msgMatch = (chat.messages || []).some(m => 
        (m.content || '').toLowerCase().includes(searchQuery.toLowerCase())
      );
      return titleMatch || msgMatch;
    });
  }, [history, searchQuery]);

  const grouped = useMemo(() => {
    return filteredHistory.reduce((acc, chat) => {
      // --- FIX 2: Handle Date Parsing Safely ---
      const date = new Date(chat.timestamp || Date.now());
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
  }, [filteredHistory]);

  const selectedChat = history.find(c => c.id === selectedId);

  const getTimeAgo = (timestamp: number) => {
    if (!timestamp) return '';
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  const handleChatClick = (id: string) => {
    if (window.innerWidth < 768) {
      onSelectChat(id);
      onClose();
    } else {
      setSelectedId(id);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-xl flex items-center justify-center p-0 md:p-8 animate-appear">
      <div className="w-full md:max-w-6xl h-full  bg-black/90 md:rounded-[2.5rem] border-t md:border border-white/10 shadow-2xl flex flex-col overflow-hidden">
        
        {/* Header Bar */}
        <div className="flex items-center justify-between px-4 md:px-4 py-2 md:py-6 border-b border-white/5 bg-black/20">
          <div className="flex items-center gap-4 flex-1 max-w-2xl">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
              <input 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search history..." 
                className="w-full bg-black/40 border border-black/90 rounded-2xl py-3 pl-12 pr-4 text-white outline-none focus:border-black/90 transition-all text-sm"
              />
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-3 text-zinc-500 hover:text-white hover:bg-white/5 rounded-full transition-all ml-2"
          >
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 flex overflow-hidden">
          
          {/* Sidebar Chat List */}
          <div className="w-full md:w-60 border-r border-white/5 flex flex-col bg-black/20">
            <div className="p-4 md:p-6">
              <button 
                onClick={() => { onSelectChat(''); onClose(); }}
                className="w-full flex items-center gap-3 px-4 py-3 bg-zinc-900 rounded-2xl border border-white/5 hover:border-white/20 transition-all group"
              >
                <Plus size={18} className="text-zinc-400 group-hover:text-white" />
                <span className="text-sm font-medium">New Private Chat</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 md:px-6 pb-6 space-y-8 no-scrollbar">
              {(Object.entries(grouped) as [string, SidebarChat[]][]).map(([label, chats]) => (
                <div key={label} className="space-y-4">
                  <h3 className="text-[10px] font-black tracking-[0.2em] text-zinc-600 uppercase px-2">{label}</h3>
                  <div className="space-y-1">
                    {chats.map(chat => (
                      <button 
                        key={chat.id}
                        onClick={() => handleChatClick(chat.id)}
                        className={`w-full flex items-center justify-between p-2 rounded-2xl transition-all group ${selectedId === chat.id && window.innerWidth >= 768 ? 'bg-zinc-800 text-white shadow-lg' : 'text-zinc-400 hover:bg-white/5'}`}
                      >
                        <div className="flex flex-col text-left truncate flex-1 pr-2">
                          <span className="text-sm font-semibold truncate group-hover:text-white transition-colors">{chat.title || "Untitled Chat"}</span>
                          <span className="text-[10px] opacity-40 mt-1">{getTimeAgo(chat.timestamp)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                           <ChevronRight size={14} className="md:hidden opacity-30" />
                           {selectedId === chat.id && window.innerWidth >= 768 && <CornerDownRight size={14} className="opacity-40" />}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              {filteredHistory.length === 0 && (
                <div className="text-center py-20 opacity-20">
                  <Clock size={40} className="mx-auto mb-4" />
                  <p className="text-sm">No records found</p>
                </div>
              )}
            </div>
          </div>

          {/* Main Preview Area */}
          <div className="hidden md:flex flex-1 flex-col bg-black/40 overflow-hidden">
            {selectedChat ? (
              <>
                <div className="flex-1 overflow-y-auto p-12 no-scrollbar">
                  <div className="max-w-2xl mx-auto space-y-10">
                    <div className="mb-8 border-b border-white/5 pb-8">
                       <h2 className="text-3xl font-bold text-white mb-2">{selectedChat.title}</h2>
                       <p className="text-zinc-500 text-sm">
                         {selectedChat.timestamp ? new Date(selectedChat.timestamp).toLocaleString() : ''}
                       </p>
                    </div>
                    {/* --- FIX 3: Check if messages exist before mapping --- */}
                    {selectedChat.messages && selectedChat.messages.length > 0 ? (
                      selectedChat.messages.map((m, idx) => (
                        <div key={m.id || idx} className="animate-appear" style={{ animationDelay: `${idx * 0.05}s` }}>
                          <div className="flex items-center gap-3 mb-4 opacity-30">
                             <div className="w-6 h-[1px] bg-white" />
                             <span className="text-[9px] uppercase tracking-widest font-bold">{m.role}</span>
                          </div>
                          <p className={`text-lg leading-relaxed whitespace-pre-wrap ${m.role === 'user' ? 'text-white' : 'text-zinc-400'}`}>
                            {m.content}
                          </p>
                        </div>
                      ))
                    ) : (
                      <div className="text-center opacity-30 mt-20">
                        <p>Preview not available (Load chat to view)</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer Controls */}
                <div className="px-8 py-4 bg-black/60 border-t border-white/5 flex items-center justify-between">
                  <button className="text-zinc-600 hover:text-white transition-all p-2">
                    <Maximize2 size={18} />
                  </button>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => onSelectChat(selectedChat.id)}
                      className="flex items-center gap-2 px-3 py-3 bg-white text-black text-sm font-bold rounded-xl hover:scale-105 transition-all shadow-xl"
                    >
                      <span>Open Thread</span>
                      <CornerDownRight size={16} />
                    </button>
                    
                    <button 
                      onClick={() => {
                        if(confirm('Permanently delete this thread?')) {
                          onDeleteChat(selectedChat.id);
                          setSelectedId(null);
                        }
                      }}
                      className="flex items-center gap-2 px-4 py-3 bg-zinc-900 text-red-400 text-sm font-bold rounded-xl hover:bg-red-500/10 transition-all"
                    >
                      <Trash2 size={16} />
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center opacity-10">
                <VoidLogo className="w-24 h-24 mb-6" />
                <h2 className="text-xl font-black tracking-[0.4em] uppercase">Void Records</h2>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default HistoryDashboard;