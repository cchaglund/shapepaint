import { createContext, useContext, useLayoutEffect, useSyncExternalStore, useCallback, type ReactNode } from 'react';

interface HeaderConfig {
  centerContent?: ReactNode;
  rightContent?: ReactNode;
}

type Listener = () => void;

function createHeaderStore() {
  let config: HeaderConfig = {};
  const listeners = new Set<Listener>();

  return {
    getConfig: () => config,
    setConfig: (c: HeaderConfig) => {
      config = c;
      listeners.forEach((l) => l());
    },
    clearConfig: () => {
      config = {};
      listeners.forEach((l) => l());
    },
    subscribe: (listener: Listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

type HeaderStore = ReturnType<typeof createHeaderStore>;

const HeaderContext = createContext<HeaderStore | null>(null);

// Module-level singleton avoids ref access during render
const headerStore = createHeaderStore();

export function HeaderProvider({ children }: { children: ReactNode }) {
  return (
    <HeaderContext.Provider value={headerStore}>
      {children}
    </HeaderContext.Provider>
  );
}

/** Read current header config (used by TopBar). Re-renders when config changes. */
// eslint-disable-next-line react-refresh/only-export-components
export function useHeaderConfig() {
  const store = useContext(HeaderContext);
  if (!store) throw new Error('useHeaderConfig must be used within HeaderProvider');
  return useSyncExternalStore(store.subscribe, store.getConfig);
}

/**
 * Set header config from a page. Updates after every commit, clears on unmount.
 * Uses an external store instead of React state to avoid re-render loops.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useSetHeader(config: HeaderConfig) {
  const store = useContext(HeaderContext);
  if (!store) throw new Error('useSetHeader must be used within HeaderProvider');

  // Set after every commit (layout effect with no deps fires after every render).
  // This does NOT cause a re-render loop because setConfig mutates an external store,
  // and only TopBar (the subscriber) re-renders — not the page that called useSetHeader.
  useLayoutEffect(() => {
    store.setConfig(config);
  });

  // Clear on unmount only
  const clearConfig = useCallback(() => store.clearConfig(), [store]);
  useLayoutEffect(() => clearConfig, [clearConfig]);
}
