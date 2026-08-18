import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';

function PasswordInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="input pr-10"
        required
      />
      <button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted">
        {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  );
}

export default function AuthPage() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { login, register, error, clearError } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    clearError();
    try {
      if (mode === 'login') {
        await login(email || username, password, remember);
      } else {
        await register({ username, email, password, confirmPassword });
      }
      navigate('/');
    } catch { /* error handled in store */ }
    finally { setSubmitting(false); }
  };

  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary to-primary-dark p-12 flex-col justify-between text-white">
        <div>
          <div className="flex items-center gap-3 mb-12">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-xl">⏱️</div>
            <span className="font-display font-bold text-lg">Premium Time Tracker</span>
          </div>
          <h2 className="text-4xl font-display font-bold leading-tight mb-4">
            Plan · Track · Improve
          </h2>
          <p className="text-white/70 text-lg max-w-md">
            Transform how you spend your time with intelligent tracking, analytics, and productivity scoring.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {['30-min time blocks', 'Productivity score', 'Activity analytics', 'Offline support'].map((f) => (
            <div key={f} className="flex items-center gap-2 text-sm text-white/80">
              <span className="w-1.5 h-1.5 rounded-full bg-white/60" />
              {f}
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md animate-fade-in">
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-xl">⏱️</div>
            <span className="font-display font-bold">Premium Time Tracker</span>
          </div>

          <h1 className="text-2xl font-display font-bold mb-1">
            {mode === 'login' ? 'Welcome back' : 'Create account'}
          </h1>
          <p className="text-muted text-sm mb-6">
            {mode === 'login' ? 'Sign in to your private workspace' : 'Start tracking your productivity today'}
          </p>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-error/10 text-error text-sm border border-error/20">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <div>
                <label className="label">Username</label>
                <input value={username} onChange={(e) => setUsername(e.target.value)} className="input" placeholder="yourname" required minLength={3} />
              </div>
            )}
            <div>
              <label className="label">{mode === 'login' ? 'Username or Email' : 'Email'}</label>
              <input
                value={mode === 'login' ? (email || username) : email}
                onChange={(e) => mode === 'login' ? setEmail(e.target.value) : setEmail(e.target.value)}
                className="input"
                placeholder={mode === 'login' ? 'username or email' : 'you@example.com'}
                type={mode === 'register' ? 'email' : 'text'}
                required
              />
            </div>
            <div>
              <label className="label">Password</label>
              <PasswordInput value={password} onChange={setPassword} placeholder="••••••••" />
            </div>
            {mode === 'register' && (
              <div>
                <label className="label">Confirm Password</label>
                <PasswordInput value={confirmPassword} onChange={setConfirmPassword} placeholder="••••••••" />
              </div>
            )}
            {mode === 'login' && (
              <label className="flex items-center gap-2 text-sm text-muted cursor-pointer">
                <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="rounded" />
                Remember session
              </label>
            )}
            <button type="submit" disabled={submitting} className="btn-primary w-full py-3">
              {submitting ? 'Please wait...' : mode === 'login' ? 'Sign in' : 'Create account'}
            </button>
          </form>

          <p className="text-center text-sm text-muted mt-6">
            {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}{' '}
            <button
              onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); clearError(); }}
              className="text-primary font-medium hover:underline"
            >
              {mode === 'login' ? 'Sign up' : 'Sign in'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
