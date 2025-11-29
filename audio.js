// Audio context for sound effects
const audioContext = new (window.AudioContext || window.webkitAudioContext)();

// Audio configuration
const AUDIO_CONFIG = {
    slapSounds: [
        `${import.meta.env.BASE_URL}assets/ass2.m4a`,
        `${import.meta.env.BASE_URL}assets/ass3.m4a`,
        `${import.meta.env.BASE_URL}assets/ass5.m4a`
    ],
    explosionSound: `${import.meta.env.BASE_URL}assets/uh.m4a`,
    pitchVariationMin: 0.85,
    pitchVariationMax: 1.15,
    highShelfFrequency: 2000,
    highShelfGainMin: 3,
    highShelfGainMax: 6,
    lowpassFrequencyMin: 8000,
    lowpassFrequencyMax: 12000,
    lowpassQ: 0.7,
    silentOffset: 0.08
};

// Sound buffers
const slapSounds = [];
let explosionSound = null;

/**
 * Load a single audio file and return the decoded buffer
 */
async function loadAudioFile(path) {
    const response = await fetch(path);
    const arrayBuffer = await response.arrayBuffer();
    return await audioContext.decodeAudioData(arrayBuffer);
}

/**
 * Load all sound files
 */
async function loadSounds() {
    // Load slap sounds
    for (let i = 0; i < AUDIO_CONFIG.slapSounds.length; i++) {
        try {
            const buffer = await loadAudioFile(AUDIO_CONFIG.slapSounds[i]);
            slapSounds.push(buffer);
        } catch (error) {
            console.error(`Error loading slap sound ${i + 1}:`, error);
        }
    }
    
    // Load explosion sound
    try {
        explosionSound = await loadAudioFile(AUDIO_CONFIG.explosionSound);
    } catch (error) {
        console.error('Error loading explosion sound:', error);
    }
}

/**
 * Play a slap/smack sound with randomized modulation for variety
 * @param {number} intensity - Volume intensity (0-1)
 */
function playSmackSound(intensity = 1.0) {
    if (slapSounds.length === 0) return;
    
    const now = audioContext.currentTime;
    
    // Randomly select one of the loaded sounds
    const randomSound = slapSounds[Math.floor(Math.random() * slapSounds.length)];
    
    // Create buffer source
    const source = audioContext.createBufferSource();
    source.buffer = randomSound;
    
    // Add pitch/speed variation for variety
    const pitchVariation = AUDIO_CONFIG.pitchVariationMin + 
        Math.random() * (AUDIO_CONFIG.pitchVariationMax - AUDIO_CONFIG.pitchVariationMin);
    source.playbackRate.value = pitchVariation;
    
    // Create gain node for volume control
    const gainNode = audioContext.createGain();
    gainNode.gain.setValueAtTime(intensity * 0.7, now);
    
    // Add a high-shelf EQ for brightness control
    const highShelf = audioContext.createBiquadFilter();
    highShelf.type = 'highshelf';
    highShelf.frequency.value = AUDIO_CONFIG.highShelfFrequency;
    highShelf.gain.value = AUDIO_CONFIG.highShelfGainMin + 
        Math.random() * (AUDIO_CONFIG.highShelfGainMax - AUDIO_CONFIG.highShelfGainMin);
    
    // Add a slight low-pass variation for tonal variety
    const lowpass = audioContext.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = AUDIO_CONFIG.lowpassFrequencyMin + 
        Math.random() * (AUDIO_CONFIG.lowpassFrequencyMax - AUDIO_CONFIG.lowpassFrequencyMin);
    lowpass.Q.value = AUDIO_CONFIG.lowpassQ;
    
    // Connect the audio graph
    source.connect(lowpass);
    lowpass.connect(highShelf);
    highShelf.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    // Play the sound with offset to skip silent beginning
    source.start(now, AUDIO_CONFIG.silentOffset);
}

/**
 * Play the explosion sound effect
 * @param {number} intensity - Volume intensity (0-1)
 */
function playExplosionSound(intensity = 1.0) {
    if (!explosionSound) return;
    
    const now = audioContext.currentTime;
    
    // Create buffer source
    const source = audioContext.createBufferSource();
    source.buffer = explosionSound;
    
    // Create gain node for volume control
    const gainNode = audioContext.createGain();
    gainNode.gain.setValueAtTime(intensity * 0.8, now);
    
    // Connect the audio graph
    source.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    // Play the sound
    source.start(now);
}

/**
 * Resume audio context (required for browsers that suspend audio until user interaction)
 */
async function resumeAudioContext() {
    if (audioContext.state === 'suspended') {
        await audioContext.resume();
    }
}

export { loadSounds, playSmackSound, playExplosionSound, resumeAudioContext };

