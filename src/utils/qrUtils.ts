export const generateQrCode = (tableId: string) => {
    // Get the base URL (handling both dev and prod)
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
    return `${baseUrl}/menu?tableId=${tableId}`
}
