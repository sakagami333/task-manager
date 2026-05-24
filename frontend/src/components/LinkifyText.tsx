const SPLIT_REGEX = /(https?:\/\/[^\s　「」『』【】〔〕、。！）（《》〈〉「」］［)},]+)/g;
const IS_URL = /^https?:\/\//;

interface Props {
  text: string;
  className?: string;
}

export function LinkifyText({ text, className }: Props) {
  const parts = text.split(SPLIT_REGEX);

  return (
    <span className={className}>
      {parts.map((part, i) =>
        IS_URL.test(part) ? (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 underline hover:text-blue-800 break-all"
            onClick={e => e.stopPropagation()}
          >
            {part}
          </a>
        ) : (
          part
        )
      )}
    </span>
  );
}
