export type SoundType = 'classic' | 'double' | 'chime' | 'alert' | 'soft' | 'success' | 'warning' | 'kitchen-bell'

class SoundManager {
    private audioContext: AudioContext | null = null

    private getContext(): AudioContext {
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
        }
        return this.audioContext
    }

    play(type: SoundType = 'classic') {
        try {
            const ctx = this.getContext()
            if (ctx.state === 'suspended') {
                ctx.resume()
            }

            const oscillator = ctx.createOscillator()
            const gainNode = ctx.createGain()

            oscillator.connect(gainNode)
            gainNode.connect(ctx.destination)

            const now = ctx.currentTime

            switch (type) {
                case 'classic':
                    // Kitchen Bell - Single Ding (Clean and Professional)
                    oscillator.type = 'sine'
                    oscillator.frequency.setValueAtTime(1046.50, now) // C6 - High pitch bell
                    gainNode.gain.setValueAtTime(0.4, now)
                    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.8)
                    oscillator.start(now)
                    oscillator.stop(now + 0.8)
                    break

                case 'double':
                    // Double Kitchen Bell (More Attention-Grabbing)
                    oscillator.type = 'sine'
                    oscillator.frequency.setValueAtTime(1046.50, now) // C6
                    gainNode.gain.setValueAtTime(0.4, now)
                    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.3)
                    gainNode.gain.setValueAtTime(0.4, now + 0.35)
                    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.7)
                    oscillator.start(now)
                    oscillator.stop(now + 0.7)
                    break

                case 'chime':
                    // Service Bell (Elegant Bell Tone)
                    oscillator.type = 'sine'
                    oscillator.frequency.setValueAtTime(1046.50, now) // C6
                    oscillator.frequency.setValueAtTime(1318.51, now + 0.15) // E6
                    oscillator.frequency.setValueAtTime(1567.98, now + 0.3) // G6
                    gainNode.gain.setValueAtTime(0.35, now)
                    gainNode.gain.linearRampToValueAtTime(0, now + 1.2)
                    oscillator.start(now)
                    oscillator.stop(now + 1.2)
                    break

                case 'alert':
                    // Urgent Kitchen Alert (Attention-Grabbing but Professional)
                    oscillator.type = 'sine'
                    oscillator.frequency.setValueAtTime(880, now) // A5
                    oscillator.frequency.setValueAtTime(1046.50, now + 0.15) // C6
                    oscillator.frequency.setValueAtTime(880, now + 0.3) // A5
                    oscillator.frequency.setValueAtTime(1046.50, now + 0.45) // C6
                    gainNode.gain.setValueAtTime(0.35, now)
                    gainNode.gain.linearRampToValueAtTime(0, now + 0.6)
                    oscillator.start(now)
                    oscillator.stop(now + 0.6)
                    break

                case 'soft':
                    // Gentle Notification (Subtle but Audible)
                    oscillator.type = 'sine'
                    oscillator.frequency.setValueAtTime(783.99, now) // G5
                    gainNode.gain.setValueAtTime(0, now)
                    gainNode.gain.linearRampToValueAtTime(0.25, now + 0.05)
                    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.6)
                    oscillator.start(now)
                    oscillator.stop(now + 0.6)
                    break

                case 'success':
                    // Order Complete (Positive and Clear)
                    oscillator.type = 'sine'
                    oscillator.frequency.setValueAtTime(659.25, now) // E5
                    oscillator.frequency.setValueAtTime(783.99, now + 0.12) // G5
                    oscillator.frequency.setValueAtTime(1046.50, now + 0.24) // C6
                    gainNode.gain.setValueAtTime(0.3, now)
                    gainNode.gain.linearRampToValueAtTime(0, now + 0.5)
                    oscillator.start(now)
                    oscillator.stop(now + 0.5)
                    break

                case 'warning':
                    // Warning Bell (Lower, Attention-Getting)
                    oscillator.type = 'sine'
                    oscillator.frequency.setValueAtTime(523.25, now) // C5
                    oscillator.frequency.setValueAtTime(440, now + 0.2) // A4
                    gainNode.gain.setValueAtTime(0.35, now)
                    gainNode.gain.linearRampToValueAtTime(0, now + 0.6)
                    oscillator.start(now)
                    oscillator.stop(now + 0.6)
                    break

                case 'kitchen-bell':
                    // Professional Kitchen Bell (Strong and Clear)
                    oscillator.type = 'sine'
                    oscillator.frequency.setValueAtTime(1318.51, now) // E6 - Bright bell tone
                    gainNode.gain.setValueAtTime(0.45, now)
                    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 1.0)
                    oscillator.start(now)
                    oscillator.stop(now + 1.0)
                    break
            }

        } catch (e) {
            console.error("Audio playback failed", e)
        }
    }
}

export const soundManager = new SoundManager()
