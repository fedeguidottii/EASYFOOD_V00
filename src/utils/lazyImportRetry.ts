import { lazy, ComponentType } from 'react';

/**
 * A wrapper for React.lazy that reloads the page once if the module fails to load.
 * This handles the "Failed to fetch dynamically imported module" error common in
 * SPAs after a new deployment.
 */
export const lazyImportRetry = <T extends ComponentType<any>>(
    factory: () => Promise<{ default: T }>
) => {
    return lazy(async () => {
        try {
            return await factory();
        } catch (error: any) {
            const isChunkLoadError =
                error?.name === 'ChunkLoadError' ||
                error?.message?.includes?.('Failed to fetch dynamically imported module');

            if (isChunkLoadError) {
                // Prepare storage key to prevent infinite reload loops
                const storageKey = `lazy_retry_${window.location.pathname}`;
                const hasRetried = sessionStorage.getItem(storageKey);

                if (!hasRetried) {
                    sessionStorage.setItem(storageKey, 'true');
                    window.location.reload();
                    // Return a never-resolving promise to wait for reload
                    return new Promise(() => { });
                }

                // If already retried, clear flag and throw (will be caught by ErrorBoundary)
                sessionStorage.removeItem(storageKey);
            }

            throw error;
        }
    });
};
