import { ReactNode } from "react";

type CardProps = {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
};

export function Card({ title, subtitle, children, className = "" }: CardProps) {
  return (
    <section className={`panel p-5 sm:p-6 ${className}`.trim()}>
      {(title || subtitle) && (
        <header className="mb-4 space-y-1 pb-3">
          {title && <h3 className="text-lg font-semibold text-[color:var(--on-surface)]">{title}</h3>}
          {subtitle && <p className="text-xs text-[color:var(--on-surface-variant)]">{subtitle}</p>}
        </header>
      )}
      {children}
    </section>
  );
}
