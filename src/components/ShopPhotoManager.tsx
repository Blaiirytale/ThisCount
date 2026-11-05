// Thumbnails with Remove, plus "Add photo" (owners). Admins can use it with canAdd = false.

import { useState, type ChangeEvent } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { addShopPhoto, MAX_SHOP_PHOTOS, photoErrorKey, removeShopPhoto, type ShopPhoto } from '../api/shopPhotos';
import { checkPhoto, MAX_PHOTO_MB } from '../utils/image';

interface Props {
  dealId: string;
  photos: ShopPhoto[];
  userId: string | null;
  canAdd: boolean;
  onChanged: () => void;
}

export function ShopPhotoManager({ dealId, photos, userId, canAdd, onChanged }: Props) {
  const { t } = useLanguage();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function pick(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // lets you pick the same file again
    if (!file || !userId) return;
    const problem = checkPhoto(file);
    if (problem) return setError(problem === 'type' ? t('photoType') : t('photoTooBig').replace('{mb}', String(MAX_PHOTO_MB)));
    setBusy(true);
    setError('');
    try {
      await addShopPhoto(dealId, file, userId);
      onChanged();
    } catch (err) {
      console.error('[ThisCount] addShopPhoto', err);
      setError(t(photoErrorKey(err)));
    } finally {
      setBusy(false);
    }
  }

  async function remove(photo: ShopPhoto) {
    try {
      await removeShopPhoto(photo);
      onChanged();
    } catch (err) {
      console.error('[ThisCount] removeShopPhoto', err);
      setError(t('actionError'));
    }
  }

  const inputId = `shop-photo-${dealId}`;

  return (
    <div className="photo-manager">
      <span className="small">
        <strong>{t('storePhotos')}</strong> ({photos.length}/{MAX_SHOP_PHOTOS})
      </span>
      <div className="thumb-row">
        {photos.map((p) => (
          <figure key={p.id} className="thumb">
            <img src={p.url} alt={t('storePhotoAlt')} loading="lazy" />
            <button type="button" className="thumb-remove" aria-label={t('removePhoto')} onClick={() => remove(p)}>
              ✕
            </button>
          </figure>
        ))}
        {canAdd && photos.length < MAX_SHOP_PHOTOS && (
          <label className="thumb thumb-add" htmlFor={inputId}>
            {busy ? t('sending') : `+ ${t('addPhoto')}`}
            <input id={inputId} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={pick} disabled={busy} />
          </label>
        )}
      </div>
      {error && <p className="form-message" data-kind="error">{error}</p>}
    </div>
  );
}
