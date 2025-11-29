// Audio context for sound effects
const audioContext = new (window.AudioContext || window.webkitAudioContext)();

// Load slap sound effects
const slapSounds = [];
const slapSoundPaths = [
    '/assets/Slap sound effect 1.mp3',
    '/assets/Slap sound effect 2.mp3',
    '/assets/Slap sound effect 3.mp3'
];

// Load all sound files
async function loadSounds() {
    for (let i = 0; i < slapSoundPaths.length; i++) {
        try {
            const response = await fetch(slapSoundPaths[i]);
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
            slapSounds.push(audioBuffer);
            console.log(`✅ Loaded sound ${i + 1}`);
        } catch (error) {
            console.error(`❌ Error loading sound ${i + 1}:`, error);
        }
    }
}

// Function to play slap sounds with modulation
function playSmackSound(intensity = 1.0) {
    if (slapSounds.length === 0) {
        console.log('Sounds not loaded yet...');
        return;
    }
    
    const now = audioContext.currentTime;
    
    // Randomly select one of the loaded sounds
    const randomSound = slapSounds[Math.floor(Math.random() * slapSounds.length)];
    
    // Create buffer source
    const source = audioContext.createBufferSource();
    source.buffer = randomSound;
    
    // Add pitch/speed variation for variety
    const pitchVariation = 0.85 + Math.random() * 0.3; // Random pitch between 0.85x and 1.15x
    source.playbackRate.value = pitchVariation;
    
    // Create gain node for volume control
    const gainNode = audioContext.createGain();
    gainNode.gain.setValueAtTime(intensity * 0.7, now);
    
    // Optional: Add a high-shelf EQ for brightness control
    const highShelf = audioContext.createBiquadFilter();
    highShelf.type = 'highshelf';
    highShelf.frequency.value = 2000;
    highShelf.gain.value = 3 + Math.random() * 3; // Random brightness boost 3-6dB
    
    // Optional: Add a slight low-pass variation for tonal variety
    const lowpass = audioContext.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 8000 + Math.random() * 4000; // Random cutoff 8-12kHz
    lowpass.Q.value = 0.7;
    
    // Connect the audio graph
    source.connect(lowpass);
    lowpass.connect(highShelf);
    highShelf.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    // Play the sound with offset to skip silent beginning
    // Typical slap sounds have ~0.05-0.1s of silence at the start
    const silentOffset = 0.08; // Skip first 80ms
    source.start(now, silentOffset);
}

export { loadSounds, playSmackSound };

