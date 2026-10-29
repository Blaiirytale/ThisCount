// One review: animal name, stars, text, photo, helpful, report, replies

import { useState, type FormEvent } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { animalEmoji, animalLabel } from '../i18n/animals';
import { isBlockedLanguage } from '../api/reviews';
import { shortDate } from '../utils/dates';
import { Stars } from './Stars';
import type { ReportReason, Review } from '../types';

const REASONS: ReportReason[] = ['spam', 'rude', 'wrong', 'other'];

interface Props {
  review: Review;
  isHelpful: boolean;
  canReply: boolean; // owner of this shop, or admin
  onHelpful: () => void;
  onReport: (reason: ReportReason) => Promise<void>;
  onDelete: () => void;
  onReply: (body: string) => Promise<void>;
}

export function ReviewItem({ review, isHelpful, canReply, onHelpful, onReport, onDelete, onReply }: Props) {
  const { t, lang } = useLanguage();
  const [reportState, setReportState] = useState<'idle' | 'choosing' | 'sent'>('idle');
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [replyError, setReplyError] = useState('');
  const [sending, setSending] = useState(false);

  async function handleReport(reason: ReportReason) {
    await onReport(reason);
    setReportState('sent');
  }

  async function handleReply(e: FormEvent) {
    e.preventDefault();
    if (!replyText.trim()) return;
    setSending(true);
    setReplyError('');
    try {
      await onReply(replyText);
      setReplyText('');
      setReplyOpen(false);
    } catch (err) {
      setReplyError(isBlockedLanguage(err) ? t('blockedLanguage') : t('actionError'));
    } finally {
      setSending(false);
    }
  }

  return (
    <li className="review">
      <div className="review-head">
        <span className="avatar" aria-hidden="true">
          {animalEmoji(review.author)}
        </span>
        <div className="review-who">
          <span className="review-name">{animalLabel(review.author, lang)}</span>
          <span className="review-date">{shortDate(review.createdAt)}</span>
        </div>
        <Stars value={review.rating} />
      </div>

      {review.isHidden && <p className="hidden-note">{t('hiddenNotice')}</p>}
      {review.worked === true && <span className="tag tag-good">✓ {t('worked')}</span>}
      {review.worked === false && <span className="tag tag-bad">✕ {t('didnt')}</span>}
      {review.body && <p className="review-body">{review.body}</p>}
      {review.photoUrl && (
        <a href={review.photoUrl} target="_blank" rel="noopener" className="review-photo">
          <img src={review.photoUrl} alt={t('photoAlt')} loading="lazy" />
        </a>
      )}

      <div className="review-actions">
        <button
          type="button"
          className="mini-btn"
          aria-pressed={isHelpful}
          onClick={onHelpful}
          disabled={review.isMine}
        >
          👍 {t('helpful')} · {review.helpfulCount}
        </button>
        {canReply && !replyOpen && (
          <button type="button" className="mini-btn" onClick={() => setReplyOpen(true)}>
            {t('reply')}
          </button>
        )}
        {review.isMine ? (
          <button type="button" className="link-btn" onClick={onDelete}>
            {t('deleteReview')}
          </button>
        ) : reportState === 'idle' ? (
          <button type="button" className="link-btn" onClick={() => setReportState('choosing')}>
            {t('report')}
          </button>
        ) : reportState === 'sent' ? (
          <span className="muted small">{t('reportSent')}</span>
        ) : null}
      </div>

      {/* Report: pick a reason (built into the page, no pop-up) */}
      {reportState === 'choosing' && (
        <div className="report-box">
          <span className="small">{t('reportQuestion')}</span>
          <div className="chips">
            {REASONS.map((r) => (
              <button key={r} type="button" className="chip" onClick={() => handleReport(r)}>
                {t(`reason.${r}`)}
              </button>
            ))}
            <button type="button" className="link-btn" onClick={() => setReportState('idle')}>
              {t('cancel')}
            </button>
          </div>
        </div>
      )}

      {review.replies.map((reply) => (
        <div key={reply.id} className="reply">
          <span className={`role-badge role-${reply.authorRole}`}>
            {reply.authorRole === 'owner' ? t('ownerBadge') : t('adminBadge')}
          </span>
          <span className="reply-name">{reply.authorLabel}</span>
          <p className="reply-body">{reply.body}</p>
        </div>
      ))}

      {replyOpen && (
        <form className="reply-form" onSubmit={handleReply}>
          <textarea
            id={`reply-${review.id}`}
            className="field"
            rows={2}
            maxLength={500}
            placeholder={t('replyPlaceholder')}
            aria-label={t('reply')}
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
          />
          <div className="row-gap">
            <button type="submit" className="btn-primary" disabled={sending}>
              {sending ? t('sending') : t('postReply')}
            </button>
            <button type="button" className="link-btn" onClick={() => setReplyOpen(false)}>
              {t('cancel')}
            </button>
          </div>
          {replyError && <p className="form-message" data-kind="error">{replyError}</p>}
        </form>
      )}
    </li>
  );
}
