// AUDIO.JS - Retro 8-Bit Web Audio Synthesizer Engine

class AudioEngine {
    constructor() {
        this.ctx = null;
        this.bgmInterval = null;
        this.isMuted = false;
        this.masterVolume = null;
        this.bgmVolume = null;
        this.sfxVolume = null;
        this.beatCount = 0;
    }

    init() {
        if (this.ctx) return;
        
        // Create audio context
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioContextClass();
        
        // Setup volume nodes
        this.masterVolume = this.ctx.createGain();
        this.masterVolume.gain.setValueAtTime(0.3, this.ctx.currentTime); // Limit maximum master volume
        this.masterVolume.connect(this.ctx.destination);
        
        this.bgmVolume = this.ctx.createGain();
        this.bgmVolume.gain.setValueAtTime(0.4, this.ctx.currentTime);
        this.bgmVolume.connect(this.masterVolume);

        this.sfxVolume = this.ctx.createGain();
        this.sfxVolume.gain.setValueAtTime(0.7, this.ctx.currentTime);
        this.sfxVolume.connect(this.masterVolume);
    }

    resume() {
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    // Dynamic Sound Effects
    playEatRed() {
        this.init();
        this.resume();
        if (this.isMuted) return;

        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(600, t);
        osc.frequency.exponentialRampToValueAtTime(1200, t + 0.08);
        
        gain.gain.setValueAtTime(0.2, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.08);
        
        osc.connect(gain);
        gain.connect(this.sfxVolume);
        
        osc.start(t);
        osc.stop(t + 0.08);
    }

    playEatGold() {
        this.init();
        this.resume();
        if (this.isMuted) return;

        const t = this.ctx.currentTime;
        const notes = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99, 1046.50]; // C Major rising arpeggio
        
        notes.forEach((freq, idx) => {
            const nt = t + idx * 0.04;
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, nt);
            
            gain.gain.setValueAtTime(0.15, nt);
            gain.gain.exponentialRampToValueAtTime(0.01, nt + 0.15);
            
            osc.connect(gain);
            gain.connect(this.sfxVolume);
            
            osc.start(nt);
            osc.stop(nt + 0.15);
        });
    }

    playShootIce() {
        this.init();
        this.resume();
        if (this.isMuted) return;

        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(800, t);
        osc.frequency.exponentialRampToValueAtTime(150, t + 0.25);
        
        gain.gain.setValueAtTime(0.2, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.25);
        
        osc.connect(gain);
        gain.connect(this.sfxVolume);
        
        osc.start(t);
        osc.stop(t + 0.25);
    }

    playFreezeHit() {
        this.init();
        this.resume();
        if (this.isMuted) return;

        const t = this.ctx.currentTime;
        
        // Create glassy crystal sound using 4 short high-pitched oscillators
        const freqs = [1800, 2200, 2900, 3500];
        freqs.forEach((freq, idx) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, t + idx * 0.02);
            
            gain.gain.setValueAtTime(0.1, t + idx * 0.02);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15 + idx * 0.02);
            
            osc.connect(gain);
            gain.connect(this.sfxVolume);
            
            osc.start(t + idx * 0.02);
            osc.stop(t + 0.2);
        });
    }

    playLightning() {
        this.init();
        this.resume();
        if (this.isMuted) return;

        const t = this.ctx.currentTime;
        
        // Thunder clap noise
        const bufferSize = this.ctx.sampleRate * 0.5; // 0.5 seconds
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        
        const noiseNode = this.ctx.createBufferSource();
        noiseNode.buffer = buffer;
        
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(100, t);
        filter.frequency.exponentialRampToValueAtTime(1000, t + 0.1);
        filter.frequency.exponentialRampToValueAtTime(80, t + 0.5);
        
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.5, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.5);
        
        noiseNode.connect(filter);
        filter.connect(gain);
        gain.connect(this.sfxVolume);
        
        noiseNode.start(t);
        noiseNode.stop(t + 0.5);

        // Low heavy hum osc
        const osc = this.ctx.createOscillator();
        const oscGain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(90, t);
        osc.frequency.linearRampToValueAtTime(40, t + 0.45);
        
        oscGain.gain.setValueAtTime(0.4, t);
        oscGain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
        
        osc.connect(oscGain);
        oscGain.connect(this.sfxVolume);
        
        osc.start(t);
        osc.stop(t + 0.45);
    }

    playExplosion() {
        this.init();
        this.resume();
        if (this.isMuted) return;

        const t = this.ctx.currentTime;
        
        // Noise buffer
        const bufferSize = this.ctx.sampleRate * 0.8;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        
        const noiseNode = this.ctx.createBufferSource();
        noiseNode.buffer = buffer;
        
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(400, t);
        filter.frequency.exponentialRampToValueAtTime(10, t + 0.8);
        
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.6, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.8);
        
        noiseNode.connect(filter);
        filter.connect(gain);
        gain.connect(this.sfxVolume);
        
        noiseNode.start(t);
        noiseNode.stop(t + 0.8);

        // Sub bass drop
        const osc = this.ctx.createOscillator();
        const oscGain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(100, t);
        osc.frequency.exponentialRampToValueAtTime(30, t + 0.6);
        
        oscGain.gain.setValueAtTime(0.5, t);
        oscGain.gain.exponentialRampToValueAtTime(0.01, t + 0.6);
        
        osc.connect(oscGain);
        oscGain.connect(this.sfxVolume);
        
        osc.start(t);
        osc.stop(t + 0.6);
    }

    // Dynamic Chiptune Background Music Loop (8-bit Sequencer)
    startBGM() {
        this.init();
        this.resume();
        this.stopBGM();
        if (this.isMuted) return;

        this.beatCount = 0;
        const tempo = 125; // BPM
        const noteDuration = 60 / tempo / 2; // 8th notes

        // Progressive melody chords
        const chords = [
            [130.81, 196.00], // C3, G3
            [146.83, 220.00], // D3, A3
            [164.81, 246.94], // E3, B3
            [174.61, 261.63]  // F3, C4
        ];
        
        const leadScale = [
            261.63, 293.66, 329.63, 349.23, 392.00, 440.00, 493.88, 523.25 // C Major scale
        ];

        this.bgmInterval = setInterval(() => {
            const t = this.ctx.currentTime;
            
            // Bass beat (on every 1st and 3rd 8th note of a bar)
            const barIndex = Math.floor(this.beatCount / 8) % chords.length;
            const beatInBar = this.beatCount % 8;
            
            // Bass note trigger
            if (beatInBar === 0 || beatInBar === 3 || beatInBar === 6) {
                const bassOsc = this.ctx.createOscillator();
                const bassGain = this.ctx.createGain();
                
                bassOsc.type = 'triangle';
                const rootFreq = chords[barIndex][beatInBar === 3 ? 1 : 0];
                bassOsc.frequency.setValueAtTime(rootFreq, t);
                
                bassGain.gain.setValueAtTime(0.18, t);
                bassGain.gain.exponentialRampToValueAtTime(0.01, t + noteDuration * 1.5);
                
                bassOsc.connect(bassGain);
                bassGain.connect(this.bgmVolume);
                
                bassOsc.start(t);
                bassOsc.stop(t + noteDuration * 1.5);
            }

            // Lead Synth Melody (plays on random beats to create endless retro vibe)
            if (beatInBar !== 1 && beatInBar !== 5 && Math.random() > 0.4) {
                const leadOsc = this.ctx.createOscillator();
                const leadGain = this.ctx.createGain();
                
                leadOsc.type = 'square';
                // Pick notes semi-randomly but fitting the scale and current chord
                let noteChoice = leadScale[Math.floor(Math.random() * leadScale.length)];
                if (beatInBar === 0) noteChoice = chords[barIndex][0] * 2; // Resolve to root octave
                
                leadOsc.frequency.setValueAtTime(noteChoice, t);
                
                leadGain.gain.setValueAtTime(0.05, t);
                leadGain.gain.exponentialRampToValueAtTime(0.001, t + noteDuration * 0.9);
                
                leadOsc.connect(leadGain);
                leadGain.connect(this.bgmVolume);
                
                leadOsc.start(t);
                leadOsc.stop(t + noteDuration * 0.9);
            }

            // Simulating hi-hat (short white noise burst on even beats)
            if (beatInBar % 2 === 0) {
                const noiseOsc = this.ctx.createOscillator(); // Just use a high frequency triangle instead of buffer for performance
                const noiseGain = this.ctx.createGain();
                
                noiseOsc.type = 'sine';
                noiseOsc.frequency.setValueAtTime(8000 + Math.random() * 2000, t);
                
                noiseGain.gain.setValueAtTime(0.012, t);
                noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
                
                noiseOsc.connect(noiseGain);
                noiseGain.connect(this.bgmVolume);
                
                noiseOsc.start(t);
                noiseOsc.stop(t + 0.03);
            }

            this.beatCount++;
        }, noteDuration * 1000);
    }

    stopBGM() {
        if (this.bgmInterval) {
            clearInterval(this.bgmInterval);
            this.bgmInterval = null;
        }
    }
}

// Instantiate globally
const audio = new AudioEngine();
window.audio = audio;
