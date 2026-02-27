import bcrypt from 'bcryptjs'

const SALT_ROUNDS = 10

/**
 * Hash a plaintext password using bcrypt
 */
export async function hashPassword(plaintext: string): Promise<string> {
    return bcrypt.hash(plaintext, SALT_ROUNDS)
}

/**
 * Verify a plaintext password against a bcrypt hash.
 * Passwords legacy non-hashed non sono più accettate per motivi di sicurezza.
 */
export async function verifyPassword(plaintext: string, storedHash: string): Promise<boolean> {
    if (!storedHash) return false

    if (storedHash.startsWith('$2a$') || storedHash.startsWith('$2b$')) {
        return bcrypt.compare(plaintext, storedHash)
    }

    // Password non hashata rilevata: rifiuta e forza reset
    console.warn('Password legacy non-hashata rilevata. L\'utente deve reimpostare la password.')
    return false
}
