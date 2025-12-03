export type SoundType = 'classic' | 'double' | 'chime' | 'alert' | 'soft' | 'success' | 'warning' | 'arcade'

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
                    // Simple Beep
                    oscillator.type = 'sine'
                    oscillator.frequency.setValueAtTime(880, now)
                    oscillator.frequency.exponentialRampToValueAtTime(440, now + 0.1)
                    gainNode.gain.setValueAtTime(0.3, now)
                    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.1)
                    oscillator.start(now)
                    oscillator.stop(now + 0.1)
                    break

                case 'double':
                    // Double Beep
                    oscillator.type = 'square'
                    oscillator.frequency.setValueAtTime(600, now)
                    gainNode.gain.setValueAtTime(0.1, now)
                    gainNode.gain.setValueAtTime(0, now + 0.1)
                    gainNode.gain.setValueAtTime(0.1, now + 0.15)
                    gainNode.gain.setValueAtTime(0, now + 0.25)
                    oscillator.start(now)
                    oscillator.stop(now + 0.25)
                    break

                case 'chime':
                    // Major Triad Arpeggio
                    oscillator.type = 'triangle'
                    oscillator.frequency.setValueAtTime(523.25, now) // C5
                    oscillator.frequency.setValueAtTime(659.25, now + 0.1) // E5
                    oscillator.frequency.setValueAtTime(783.99, now + 0.2) // G5
                    gainNode.gain.setValueAtTime(0.2, now)
                    gainNode.gain.linearRampToValueAtTime(0, now + 0.6)
                    oscillator.start(now)
                    oscillator.stop(now + 0.6)
                    break

                case 'alert':
                    // Urgent Sawtooth
                    oscillator.type = 'sawtooth'
                    oscillator.frequency.setValueAtTime(800, now)
                    oscillator.frequency.linearRampToValueAtTime(600, now + 0.2)
                    oscillator.frequency.linearRampToValueAtTime(800, now + 0.4)
                    gainNode.gain.setValueAtTime(0.1, now)
                    gainNode.gain.linearRampToValueAtTime(0, now + 0.4)
                    oscillator.start(now)
                    oscillator.stop(now + 0.4)
                    break

                case 'soft':
                    // Gentle Sine
                    oscillator.type = 'sine'
                    oscillator.frequency.setValueAtTime(440, now)
                    gainNode.gain.setValueAtTime(0, now)
                    gainNode.gain.linearRampToValueAtTime(0.2, now + 0.1)
                    gainNode.gain.linearRampToValueAtTime(0, now + 0.5)
                    oscillator.start(now)
                    oscillator.stop(now + 0.5)
                    break

                case 'success':
                    // Ascending Slide
                    oscillator.type = 'sine'
                    oscillator.frequency.setValueAtTime(400, now)
                    oscillator.frequency.exponentialRampToValueAtTime(1200, now + 0.3)
                    gainNode.gain.setValueAtTime(0.2, now)
                    gainNode.gain.linearRampToValueAtTime(0, now + 0.3)
                    oscillator.start(now)
                    oscillator.stop(now + 0.3)
                    break

                case 'warning':
                    // Descending Low
                    oscillator.type = 'triangle'
                    oscillator.frequency.setValueAtTime(300, now)
                    oscillator.frequency.linearRampToValueAtTime(100, now + 0.4)
                    gainNode.gain.setValueAtTime(0.3, now)
                    gainNode.gain.linearRampToValueAtTime(0, now + 0.4)
                    oscillator.start(now)
                    oscillator.stop(now + 0.4)
                    break

                case 'arcade':
                    // 8-bit Jump
                    oscillator.type = 'square'
                    oscillator.frequency.setValueAtTime(150, now)
                    oscillator.frequency.linearRampToValueAtTime(600, now + 0.1)
                    gainNode.gain.setValueAtTime(0.1, now)
                    gainNode.gain.linearRampToValueAtTime(0, now + 0.1)
                    oscillator.start(now)
                    oscillator.stop(now + 0.1)
                    break
            }

        } catch (e) {
            console.error("Audio playback failed", e)
        }
    }
}

export const soundManager = new SoundManager()
