
import React, { useState, useEffect } from 'react';
import { VoidLogo } from './Logo';
import { ArrowLeft, ArrowRight, ChevronDown, Loader2, Mail, MessageCircle, ShieldCheck, Sparkles, X } from 'lucide-react';
import { authService } from '../services/authService';
import { User as UserType } from '../types';

declare global {
  interface Window {
    google: any;
  }
}

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (response: { access_token?: string; error?: string }) => void;
          }) => { requestAccessToken: () => void };
        };
      };
    };
    AppleID?: {
      auth: {
        init: (config: {
          clientId: string;
          scope: string;
          redirectURI: string;
          usePopup: boolean;
        }) => void;
        signIn: () => Promise<{
          authorization?: { id_token?: string };
          user?: { name?: { firstName?: string; lastName?: string } };
        }>;
      };
    };
  }
}

interface AuthPortalProps {
  onAuthenticated: (user: UserType) => void;
  onClose: () => void;
  initialMode?: 'login' | 'signup';
}

const AuthPortal: React.FC<AuthPortalProps> = ({ onAuthenticated, onClose, initialMode = 'login' }) => {
  const [isLogin, setIsLogin] = useState(initialMode === 'login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showEmailForm, setShowEmailForm] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');

  // Load Google Sign-In script
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);
  }, []);

  const loadScript = (src: string, id: string) => {
    return new Promise<void>((resolve, reject) => {
      if (document.getElementById(id)) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.id = id;
      script.src = src;
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Failed to load ${id}`));
      document.head.appendChild(script);
    });
  };

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

  const loginWithGoogle = async () => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!clientId) {
      setError('Missing VITE_GOOGLE_CLIENT_ID in the frontend environment.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await loadScript('https://accounts.google.com/gsi/client', 'google-identity-services');
      if (!window.google?.accounts?.oauth2) {
        throw new Error('Google Identity Services did not initialize.');
      }

      const tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: 'openid email profile',
        callback: async (response) => {
          if (response.error || !response.access_token) {
            setError(response.error || 'Google login failed.');
            setLoading(false);
            return;
          }

          try {
            const user = await authService.socialLogin('google', response.access_token, 'access_token');
            onAuthenticated(user);
          } catch (err: any) {
            setError(err.message);
          } finally {
            setLoading(false);
          }
        }
      });

      tokenClient.requestAccessToken();
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  const loginWithApple = async () => {
    const clientId = import.meta.env.VITE_APPLE_CLIENT_ID;
    const redirectURI = import.meta.env.VITE_APPLE_REDIRECT_URI || window.location.origin;
    if (!clientId) {
      setError('Missing VITE_APPLE_CLIENT_ID in the frontend environment.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await loadScript('https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js', 'apple-signin-js');
      if (!window.AppleID?.auth) {
        throw new Error('Sign in with Apple did not initialize.');
      }

      window.AppleID.auth.init({
        clientId,
        scope: 'name email',
        redirectURI,
        usePopup: true
      });

      const response = await window.AppleID.auth.signIn();
      const idToken = response.authorization?.id_token;
      if (!idToken) {
        throw new Error('Apple did not return an identity token.');
      }

      const appleName = [
        response.user?.name?.firstName,
        response.user?.name?.lastName
      ].filter(Boolean).join(' ');
      const user = await authService.socialLogin('apple', idToken, 'id_token', appleName || undefined);
      onAuthenticated(user);
    } catch (err: any) {
      setError(err.message || 'Apple login failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[500] bg-black flex animate-appear overflow-hidden">
      {/* Left Section: Form */}
      <div className="w-full md:w-1/2 h-full flex flex-col relative p-8 md:p-5 overflow-y-auto bg-black">
        
        {/* Top Navigation Row */}
        <a href="/" className="w-15">
          <div className="flex items-center justify-between mb-10">
          <VoidLogo className="w-15 text-white" />
        </div>
        </a>

        {/* Center Content Area */}
        <div className="flex-1 flex flex-col items-center justify-center max-w-sm mx-auto w-full">
          <h1 className="text-4xl md:text-5xl font-semibold text-white mb-12 tracking-tight">
            {isLogin ? 'Log into your account' : 'Create your account'}
          </h1>

          {!showEmailForm && (
          <div className="w-full space-y-3 mb-8">
             <button 
               onClick={loginWithGoogle}
               disabled={loading}
               className="w-full flex items-center justify-center gap-3 py-2 bg-transparent border border-zinc-800 text-zinc-200 font-semibold rounded-full hover:bg-zinc-900 transition-all"
             >
               <img src="/assests/google.png" alt="Google" className="w-5 h-5" />
               Login with Google
             </button>

             <button 
               onClick={loginWithApple}
               disabled={loading}
               className="w-full flex items-center justify-center gap-3 py-2 bg-transparent border border-zinc-800 text-zinc-200 font-semibold rounded-full hover:bg-zinc-900 transition-all"
             >
               <img src="/assests/apple.png" alt="Apple" className="w-5 h-5" />
               Login with Apple
             </button>

             <button 
               type="button"
               onClick={() => setShowEmailForm(true)}
               className="w-full flex items-center justify-center gap-3 py-2 bg-transparent border border-zinc-800 text-zinc-200 font-semibold rounded-full hover:bg-zinc-900 transition-all"
             >
               <Mail size={18} />
               {isLogin ? 'Login in Email' : 'Sign up with Email'}
             </button>
             {error && <p className="text-red-500 text-xs text-center px-4">{error}</p>}
          </div>
          )}

          {/* Email Form */}
          {showEmailForm && (
          <div className="w-full">
          <button
            type="button"
            onClick={() => {
              setShowEmailForm(false);
              setError(null);
            }}
            className="mb-6 flex items-center gap-2 text-sm font-semibold text-zinc-400 hover:text-white transition-colors"
          >
            <ArrowLeft size={16} />
            Back
          </button>
          <form onSubmit={handleSubmit} className="w-full space-y-4">
             {!isLogin && (
                <input
                  required
                  type="text"
                  placeholder="Your Name"
                  className="w-full bg-transparent border border-zinc-800 rounded-full py-2 px-6 text-white outline-none focus:border-zinc-500 transition-all"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
             )}
             <input
               required
               type="email"
               placeholder="Email address"
               className="w-full bg-transparent border border-zinc-800 rounded-full py-2 px-6 text-white outline-none focus:border-zinc-500 transition-all"
               value={email}
               onChange={(e) => setEmail(e.target.value)}
             />
             <input
               required
               type="password"
               placeholder="Password"
               className="w-full bg-transparent border border-zinc-800 rounded-full py-2 px-6 text-white outline-none focus:border-zinc-500 transition-all"
               value={password}
               onChange={(e) => setPassword(e.target.value)}
             />

             {error && <p className="text-red-500 text-xs text-center px-4">{error}</p>}

             <button
               disabled={loading}
               type="submit"
               className="w-full bg-zinc-100 text-black font-bold py-2 rounded-full hover:bg-white transition-all flex items-center justify-center gap-2"
             >
               {loading ? <Loader2 className="animate-spin" size={20} /> : (isLogin ? 'Sign In' : 'Create Account')}
             </button>
          </form>
          </div>
          )}

          <div className="mt-12 text-center">
            <p className="text-zinc-500 text-sm">
              {isLogin ? "Don't have an account?" : "Already have an account?"}
              <button 
                onClick={() => {
                  setIsLogin(!isLogin);
                  setShowEmailForm(false);
                  setError(null);
                }}
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

      {/* Right Section: Visual Panel */}
      <div className="hidden md:flex w-1/2 h-full relative overflow-hidden bg-zinc-950">
        <img 
          src="/assests/backg.png" 
          alt="Vella visual identity" 
          className="absolute inset-0 h-full w-full object-cover object-center opacity-80 scale-105"
        />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(34,211,238,0.24),transparent_34%),linear-gradient(90deg,rgba(0,0,0,0.82)_0%,rgba(0,0,0,0.26)_42%,rgba(0,0,0,0.58)_100%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:72px_72px] opacity-25" />

        <div className="relative z-10 flex h-full w-full flex-col justify-between p-8 lg:p-12">
          

          
        </div>
      </div>
    </div>
  );
};

export default AuthPortal;
