// Round picture, or the first letter of the animal name if there's no picture

interface Props {
  url: string | null | undefined;
  initial: string;
  size?: 'small' | 'big';
}

export function Avatar({ url, initial, size = 'small' }: Props) {
  const className = size === 'big' ? 'avatar avatar-big' : 'avatar';
  if (url) {
    return <img className={`${className} avatar-img`} src={url} alt="" loading="lazy" />;
  }
  return (
    <span className={className} aria-hidden="true">
      {initial}
    </span>
  );
}
