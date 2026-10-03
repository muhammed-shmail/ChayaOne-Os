export function AlphaTag({ className = '' }: { className?: string }) {
  return (
    <span className={`alpha-tag ${className}`} aria-label="Alpha version" role="note">
      Alpha version
    </span>
  );
}
