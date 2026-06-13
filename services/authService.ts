import { User } from '../types';

const BACKEND = 'https://exhilaratingly-heaveless-lael.ngrok-free.dev';
// const BACKEND = "http://localhost:8001"; // Uncomment for local testing

type SocialProvider = 'google' | 'apple';

export const authService = {
  register: async (email: string, password: string, name: string): Promise<User> => {
    const res = await fetch(`${BACKEND}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name })
    });

    if (!res.ok) throw new Error((await res.json()).detail);
    const user = await res.json();
    localStorage.setItem('vella_session', JSON.stringify(user));
    return user;
  },

  login: async (email: string, password: string): Promise<User> => {
    const res = await fetch(`${BACKEND}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    if (!res.ok) throw new Error((await res.json()).detail);
    const user = await res.json();
    localStorage.setItem('vella_session', JSON.stringify(user));
    return user;
  },

  socialLogin: async (
    provider: SocialProvider,
    token: string,
    tokenType: 'access_token' | 'id_token',
    name?: string
  ): Promise<User> => {
    const res = await fetch(`${BACKEND}/auth/social`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider, token, token_type: tokenType, name })
    });

    if (!res.ok) throw new Error((await res.json()).detail);
    const user = await res.json();
    localStorage.setItem('vella_session', JSON.stringify(user));
    return user;
  },

  getCurrentUser: (): User | null => {
    const s = localStorage.getItem('vella_session');
    return s ? JSON.parse(s) : null;
  },

  logout: () => {
    localStorage.removeItem('vella_session');
  }
};
