export const generateQrCode = (tableId: string) => {
    // Get the base URL (handling both dev and prod)
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
    // Modern format for customer menu
    return `${baseUrl}/client/table/${tableId}`
}
