
import React, { useState } from 'react';
import { VoidLogo } from './Logo';
import { Mail, Lock, User, ArrowRight, Loader2, X, ChevronDown, Chrome, Apple, Ghost } from 'lucide-react';
import { authService } from '../services/authService';
import { User as UserType } from '../types';

interface AuthPortalProps {
  onAuthenticated: (user: UserType) => void;
  onClose: () => void;
}

const AuthPortal: React.FC<AuthPortalProps> = ({ onAuthenticated, onClose }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isLogin) {
        const user = await authService.login(email, password);
        onAuthenticated(user);
      } else {
        const user = await authService.register(email, password, name);
        onAuthenticated(user);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const socialLogin = async (provider: string) => {
    setLoading(true);
    // Mock social login
    setTimeout(() => {
      onAuthenticated({ id: 'social', name: `${provider} User`, email: `user@${provider.toLowerCase()}.com` });
      setLoading(false);
    }, 1000);
  };

  return (
    <div className="fixed inset-0 z-[500] bg-black flex animate-appear overflow-hidden">
      {/* Left Section: Form */}
      <div className="w-full md:w-1/2 h-full flex flex-col relative p-8 md:p-12 overflow-y-auto">
        
        {/* Top Navigation Row */}
        <div className="flex items-center justify-between mb-16">
          <VoidLogo className="w-10 text-white" />
          
          <div className="flex items-center gap-4">
            <button className="flex items-center gap-2 px-4 py-2 rounded-full bg-zinc-900/50 border border-white/5 text-xs font-medium text-zinc-400 hover:text-white transition-all">
              <span>You are signing into</span>
              <div className="flex items-center gap-1.5 text-white font-bold">
                <VoidLogo className="w-3.5 h-3.5" />
                Vella
                <ChevronDown size={14} className="opacity-40" />
              </div>
            </button>
            <button 
              onClick={onClose}
              className="p-2 text-zinc-500 hover:text-white transition-colors"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Center Content Area */}
        <div className="flex-1 flex flex-col items-center justify-center max-w-sm mx-auto w-full">
          <h1 className="text-4xl md:text-5xl font-semibold text-white mb-12 tracking-tight">
            {isLogin ? 'Log into your account' : 'Create your account'}
          </h1>

          <div className="w-full space-y-3 mb-8">
             {/* Main Pill Button */}
             <button 
               onClick={() => socialLogin('X')}
               className="w-full flex items-center justify-center gap-3 py-4 bg-white text-black font-bold rounded-full hover:bg-zinc-200 active:scale-[0.98] transition-all"
             >
               <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current" aria-hidden="true">
                 <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"></path>
               </svg>
               Login with X
             </button>

             <div className="flex items-center gap-4 my-6">
                <div className="h-[1px] flex-1 bg-zinc-800" />
                <span className="text-[10px] text-zinc-600 font-bold tracking-widest uppercase">Or</span>
                <div className="h-[1px] flex-1 bg-zinc-800" />
             </div>

             {/* Secondary Social Pills */}
             <button 
               onClick={() => socialLogin('Google')}
               className="w-full flex items-center justify-center gap-3 py-4 bg-transparent border border-zinc-800 text-zinc-200 font-semibold rounded-full hover:bg-zinc-900 transition-all"
             >
               <Chrome size={20} className="text-zinc-400" />
               Login with Google
             </button>

             <button 
               onClick={() => socialLogin('Apple')}
               className="w-full flex items-center justify-center gap-3 py-4 bg-transparent border border-zinc-800 text-zinc-200 font-semibold rounded-full hover:bg-zinc-900 transition-all"
             >
               <Apple size={20} className="text-zinc-400" />
               Login with Apple
             </button>
          </div>

          {/* Email Form */}
          <form onSubmit={handleSubmit} className="w-full space-y-4">
             {!isLogin && (
                <input
                  required
                  type="text"
                  placeholder="Your Name"
                  className="w-full bg-transparent border border-zinc-800 rounded-full py-4 px-6 text-white outline-none focus:border-zinc-500 transition-all"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
             )}
             <input
               required
               type="email"
               placeholder="Email address"
               className="w-full bg-transparent border border-zinc-800 rounded-full py-4 px-6 text-white outline-none focus:border-zinc-500 transition-all"
               value={email}
               onChange={(e) => setEmail(e.target.value)}
             />
             <input
               required
               type="password"
               placeholder="Password"
               className="w-full bg-transparent border border-zinc-800 rounded-full py-4 px-6 text-white outline-none focus:border-zinc-500 transition-all"
               value={password}
               onChange={(e) => setPassword(e.target.value)}
             />

             {error && <p className="text-red-500 text-xs text-center px-4">{error}</p>}

             <button
               disabled={loading}
               type="submit"
               className="w-full bg-zinc-100 text-black font-bold py-4 rounded-full hover:bg-white transition-all flex items-center justify-center gap-2"
             >
               {loading ? <Loader2 className="animate-spin" size={20} /> : (isLogin ? 'Sign In' : 'Create Account')}
             </button>
          </form>

          <div className="mt-12 text-center">
            <p className="text-zinc-500 text-sm">
              {isLogin ? "Don't have an account?" : "Already have an account?"}
              <button 
                onClick={() => setIsLogin(!isLogin)}
                className="ml-2 text-white font-bold hover:underline"
              >
                {isLogin ? 'Sign up' : 'Log in'}
              </button>
            </p>
          </div>
        </div>

        {/* Footer info */}
        <div className="mt-auto pt-8 flex justify-center opacity-30">
          <span className="text-[10px] font-black tracking-[0.6em] text-white">VOID INTELLIGENCE</span>
        </div>
      </div>

      {/* Right Section: Visual Placeholder */}
      <div className="hidden md:flex md:w-1/2 h-full bg-[#050505] relative items-center justify-center overflow-hidden border-l border-white/5">
        {/* Cinematic Gradient Background */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_50%,rgba(59,130,246,0.08),transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.03),transparent)]" />
        
        {/* Placeholder Branding Area */}
        <div className="relative flex flex-col items-center">
          <div className="absolute inset-0 blur-3xl opacity-20 bg-white/20 rounded-full scale-150" />
          <VoidLogo className="w-100 text-white/5 relative" />
          
          <div className="mt-12 text-center relative">
            <h2 className="text-zinc-700 text-xs font-black tracking-[1em] uppercase mb-4">Void Technology</h2>
            <p className="text-zinc-800 text-sm font-light max-w-xs leading-relaxed">
              Propelling human intelligence through secure, private, and powerful neural networks.
            </p>
          </div>
        </div>

        {/* Dynamic Light streak */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-white/5 blur-[120px] rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none" />
      </div>
    </div>
  );
};

export default AuthPortal;
