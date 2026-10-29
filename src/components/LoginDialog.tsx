// Login pop-up: enter email, get a magic link

import { useState, type FormEvent } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { sendLoginLink } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { Modal, ModalHeader } from './Modal';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface Props {
  open: boolean;
  onClose: () => void;
}

export function LoginDialog({ open, onClose }: Props) {
  const { t } = useLanguage();
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState('');

  function close() {
    setStatus('idle');
    setError('');
    onClose();
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!supabase) return setError(t('loginOffline'));
    if (!EMAIL_PATTERN.test(email.trim())) return setError(t('emailInvalid'));
    setStatus('sending');
    setError('');
    try {
      await sendLoginLink(email.trim());
      setStatus('sent');
    } catch (err) {
      console.error('[ThisCount] login', err);
      setStatus('idle');
      setError(t('loginError'));
    }
  }

  return (
    <Modal open={open} onClose={close} labelledBy="login-title">
      <ModalHeader id="login-title" title={t('loginTitle')} onClose={close} closeLabel={t('close')} />
      {status === 'sent' ? (
        <p className="form-message" data-kind="ok">{t('loginSent')}</p>
      ) : (
        <form className="stack" onSubmit={handleSubmit} noValidate>
          <p className="muted">{t('loginIntro')}</p>
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
          <button type="submit" className="btn-primary" disabled={status === 'sending'}>
            {status === 'sending' ? t('sending') : t('sendLink')}
          </button>
          {error && <p className="form-message" data-kind="error">{error}</p>}
        </form>
      )}
    </Modal>
  );
}
