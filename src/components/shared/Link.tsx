import type { AnchorHTMLAttributes, MouseEvent } from 'react';
import { navigate } from '../../lib/router';

interface LinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string;
  replace?: boolean;
}

/** Anchor that navigates client-side instead of triggering a full page reload. */
export function Link({ href, replace, onClick, children, ...rest }: LinkProps) {
  const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e);
    if (e.defaultPrevented) return;
    // Let modifier-key clicks open in new tab naturally
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    if (rest.target === '_blank' || rest.download !== undefined) return;
    // Only intercept same-origin links
    try {
      const url = new URL(href, window.location.origin);
      if (url.origin !== window.location.origin) return;
    } catch {
      return;
    }
    e.preventDefault();
    navigate(href, { replace });
  };

  return <a href={href} onClick={handleClick} {...rest}>{children}</a>;
}
