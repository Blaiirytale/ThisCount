// Login pop-up: log in or create an account with email + password

import { useState, type FormEvent } from 'react';
import { useLanguage, type TextKey } from '../i18n/LanguageContext';
import { AuthError, logIn, signUp, type AuthProblem } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { Modal, ModalHeader } from './Modal';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 6; // Supabase's default minimum

const PROBLEM_TEXT: Record<AuthProblem, TextKey> = {
  wrongPassword: 'authWrongPassword',
  alreadyRegistered: 'authAlreadyRegistered',
  weakPassword: 'authWeakPassword',
  confirmEmail: 'authConfirmEmail',
  tooMany: 'authTooMany',
  other: 'loginError',
};

interface Props {
  open: boolean;
  onClose: () => void;
}

export function LoginDialog({ open, onClose }: Props) {
  const { t } = useLanguage();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false); // true = show the password
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  function close() {
    setPassword('');
    setError('');
    setInfo('');
    onClose();
  }

  function switchMode(next: 'login' | 'signup') {
    setMode(next);
    setError('');
    setInfo('');
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!supabase) return setError(t('loginOffline'));
    if (!EMAIL_PATTERN.test(email.trim())) return setError(t('emailInvalid'));
    if (password.length < MIN_PASSWORD) return setError(t('authWeakPassword'));

    setSending(true);
    setError('');
    setInfo('');
    try {
      if (mode === 'login') {
        await logIn(email.trim(), password);
        close();
      } else {
        const loggedIn = await signUp(email.trim(), password);
        if (loggedIn) close();
        else setInfo(t('authConfirmEmail')); // email confirmation is still on in Supabase
      }
    } catch (err) {
      console.error('[ThisCount] login', err);
      setError(t(err instanceof AuthError ? PROBLEM_TEXT[err.problem] : 'loginError'));
    } finally {
      setSending(false);
    }
  }

  return (
    <Modal open={open} onClose={close} labelledBy="login-title">
      <ModalHeader
        id="login-title"
        title={mode === 'login' ? t('loginTitle') : t('signupTitle')}
        onClose={close}
        closeLabel={t('close')}
      />

      <div className="chips auth-tabs" role="group" aria-label={t('loginTitle')}>
        <button type="button" className="chip" aria-pressed={mode === 'login'} onClick={() => switchMode('login')}>
          {t('login')}
        </button>
        <button type="button" className="chip" aria-pressed={mode === 'signup'} onClick={() => switchMode('signup')}>
          {t('signup')}
        </button>
      </div>

      <form className="stack" onSubmit={handleSubmit} noValidate>
        <label className="form-row" htmlFor="login-email">
          <span>{t('email')}</span>
          <input
            id="login-email"
            className="field"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label className="form-row" htmlFor="login-password">
          <span>{t('password')}</span>
          <div className="password-box">
            <input
              id="login-password"
              className="field"
              type={showPassword ? 'text' : 'password'}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              className="link-btn"
              aria-pressed={showPassword}
              onClick={() => setShowPassword((s) => !s)}
            >
              {showPassword ? t('hidePassword') : t('showPassword')}
            </button>
          </div>
        </label>
        {mode === 'signup' && <p className="muted small">{t('passwordHint')}</p>}
        <button type="submit" className="btn-primary" disabled={sending}>
          {sending ? t('sending') : mode === 'login' ? t('login') : t('signup')}
        </button>
        {error && <p className="form-message" data-kind="error">{error}</p>}
        {info && <p className="form-message" data-kind="ok">{info}</p>}
      </form>
    </Modal>
  );
}
