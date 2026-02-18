// Sound utility for playing notification sounds using Web Audio API
// No external sound files needed - generates sounds programmatically

let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  }

  // Resume if suspended (required on mobile after user interaction)
  if (audioContext.state === 'suspended') {
    audioContext.resume().catch(e => console.warn('Could not resume audio context:', e));
  }

  return audioContext;
}

// Play a pleasant notification chime for new orders (admin)
export function playNewOrderSound(): void {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    // Create a pleasant two-tone chime
    const frequencies = [523.25, 659.25]; // C5 and E5

    frequencies.forEach((freq, index) => {
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.frequency.value = freq;
      oscillator.type = 'sine';

      // Envelope: quick attack, sustain, decay
      const startTime = now + index * 0.15;
      gainNode.gain.setValueAtTime(0, startTime);
      gainNode.gain.linearRampToValueAtTime(0.3, startTime + 0.05);
      gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + 0.4);

      oscillator.start(startTime);
      oscillator.stop(startTime + 0.5);
    });
  } catch (e) {
    console.warn('Could not play sound:', e);
  }
}

// Play a subtle status change sound (for users)
export function playStatusChangeSound(): void {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.frequency.value = 880; // A5
    oscillator.type = 'sine';

    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(0.2, now + 0.02);
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.2);

    oscillator.start(now);
    oscillator.stop(now + 0.25);
  } catch (e) {
    console.warn('Could not play sound:', e);
  }
}

// Play a celebratory sound for order completion
export function playOrderReadySound(): void {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    // Major chord arpeggio: C5, E5, G5, C6
    const frequencies = [523.25, 659.25, 783.99, 1046.50];

    frequencies.forEach((freq, index) => {
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.frequency.value = freq;
      oscillator.type = 'sine';

      const startTime = now + index * 0.1;
      gainNode.gain.setValueAtTime(0, startTime);
      gainNode.gain.linearRampToValueAtTime(0.25, startTime + 0.03);
      gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + 0.5);

      oscillator.start(startTime);
      oscillator.stop(startTime + 0.6);
    });
  } catch (e) {
    console.warn('Could not play sound:', e);
  }
}

// Resume audio context (required after user interaction on some browsers)
export function resumeAudioContext(): void {
  if (audioContext && audioContext.state === 'suspended') {
    audioContext.resume();
  }
}

// Initialize audio context on first user interaction (call this early)
export function initAudioOnInteraction(): void {
  const initAudio = () => {
    // Create context if needed and resume it
    getAudioContext();
    // Remove listeners after first interaction
    document.removeEventListener('touchstart', initAudio);
    document.removeEventListener('click', initAudio);
  };

  document.addEventListener('touchstart', initAudio, { once: true, passive: true });
  document.addEventListener('click', initAudio, { once: true, passive: true });
}
