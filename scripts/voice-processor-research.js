// voice-processor-research.js - Exact Research Parameters Implementation
import { SuperpoweredWebAudio } from 'https://cdn.jsdelivr.net/npm/@superpoweredsdk/web@2.6.5';

class VoiceProcessorResearch extends SuperpoweredWebAudio.AudioWorkletProcessor {
    constructor() {
        super();
        this.isInitialized = false;
        this.useSuperpowered = true;
        this.pendingRequests = new Map();
        this.bufferSize = 1024;
        
        // Try to initialize Superpowered, fallback if it fails
        this.initializeProcessor();
    }

    async initializeProcessor() {
        try {
            // Will be called when Superpowered is ready
            this.port.postMessage({type: 'info', message: 'Waiting for Superpowered...'});
        } catch (error) {
            console.warn('Superpowered initialization failed, using fallback:', error);
            this.useSuperpowered = false;
            this.initializeFallback();
        }
    }

    onReady() {
        try {
            console.log('🎵 Research VoiceProcessor onReady() called');
            
            if (this.useSuperpowered) {
                // Initialize Superpowered components for research-grade processing
                this.inputBuffer = new this.Superpowered.Float32Buffer(this.bufferSize);
                this.outputBuffer = new this.Superpowered.Float32Buffer(this.bufferSize);
                this.workBuffer = new this.Superpowered.Float32Buffer(this.bufferSize);
                
                // Initialize processing components
                this.pitchShift = new this.Superpowered.PitchShift(this.samplerate, this.bufferSize);
                this.compressor = new this.Superpowered.Compressor(this.samplerate);
                
                // Initialize filters and EQ
                this.highPassFilter = new this.Superpowered.Filter(this.Superpowered.Filter_Resonant_Highpass, this.samplerate);
                this.lowPassFilter = new this.Superpowered.Filter(this.Superpowered.Filter_Resonant_Lowpass, this.samplerate);
                this.eq = new this.Superpowered.EQ(this.samplerate);
                
                this.isInitialized = true;
                this.port.postMessage({
                    type: 'ready',
                    message: 'Research VoiceProcessor ready with Superpowered SDK'
                });
            }
            
        } catch (error) {
            console.error('❌ Superpowered initialization failed:', error);
            this.useSuperpowered = false;
            this.initializeFallback();
        }
    }

    initializeFallback() {
        console.log('🔄 Initializing native Web Audio fallback...');
        this.isInitialized = true;
        this.port.postMessage({
            type: 'ready',
            message: 'Research VoiceProcessor ready with native Web Audio fallback'
        });
    }

    onMessageFromMainScope(message) {
        const { command, requestId, audioData } = message;
        
        if (command === 'processVoice') {
            this.handleProcessVoice({ requestId, audioData });
        }
    }

    handleProcessVoice({ requestId, audioData }) {
        if (!this.isInitialized) {
            this.port.postMessage({
                requestId: requestId,
                error: 'Processor not initialized'
            });
            return;
        }

        try {
            if (!audioData || !Array.isArray(audioData)) {
                throw new Error('Invalid audio data');
            }

            // Generate the 3 processed versions with exact research parameters
            const processedVersions = {
                light: this.processLight(audioData),
                medium: this.processMedium(audioData),
                deep: this.processDeep(audioData)
            };
            
            this.port.postMessage({
                requestId: requestId,
                versions: processedVersions
            });

        } catch (error) {
            console.error('Processing error:', error);
            this.port.postMessage({
                requestId: requestId,
                error: error.message
            });
        }
    }

    processLight(audioData) {
        // 🔹 LIGHT: Subtle enhancement with minimal transformation
        const params = {
            pitchCents: -60,
            formant: 0.9,
            hpFreq: 300,
            lpFreq: 1200,
            shelfLow: { freq: 500, gain: 3 },
            shelfHigh: { freq: 2000, gain: -3 }
        };
        
        return this.useSuperpowered ? 
            this.processWithSuperpowered(audioData, params) :
            this.processWithFallback(audioData, params);
    }

    processMedium(audioData) {
        // 🔸 MEDIUM: Enhanced warmth and internal resonance
        const params = {
            pitchCents: -120,
            formant: 0.85,
            hpFreq: 250,
            lpFreq: 1400,
            shelfLow: { freq: 400, gain: 4 },
            shelfHigh: { freq: 2200, gain: -4 }
        };
        
        return this.useSuperpowered ? 
            this.processWithSuperpowered(audioData, params) :
            this.processWithFallback(audioData, params);
    }

    processDeep(audioData) {
        // 🔴 DEEP: Internal thought-like voice perception
        const params = {
            pitchCents: -160,
            formant: 0.75,
            hpFreq: 180,
            lpFreq: 1600,
            shelfLow: { freq: 350, gain: 5 },
            shelfHigh: { freq: 2500, gain: -6 }
        };
        
        return this.useSuperpowered ? 
            this.processWithSuperpowered(audioData, params) :
            this.processWithFallback(audioData, params);
    }

    processWithSuperpowered(audioData, params) {
        const length = audioData.length;
        const chunkSize = Math.min(length, this.bufferSize);
        const result = new Float32Array(length);

        // Process in chunks
        for (let offset = 0; offset < length; offset += chunkSize) {
            const currentChunkSize = Math.min(chunkSize, length - offset);
            const chunk = audioData.slice(offset, offset + currentChunkSize);
            
            // Convert to Superpowered buffer
            const inputArray = new Float32Array(chunk);
            this.inputBuffer.copyFrom(inputArray, 0, currentChunkSize);
            
            // Apply research parameters
            this.applySuperpoweredProcessing(currentChunkSize, params);
            
            // Copy back to result
            const outputArray = new Float32Array(currentChunkSize);
            this.outputBuffer.copyTo(outputArray, 0, currentChunkSize);
            result.set(outputArray, offset);
        }

        return Array.from(result);
    }

    applySuperpoweredProcessing(bufferSize, params) {
        // Apply pitch shift with formant preservation
        this.pitchShift.pitchShiftCents = params.pitchCents;
        this.pitchShift.formantCorrection = params.formant;
        this.pitchShift.process(
            this.inputBuffer.pointer,
            this.workBuffer.pointer,
            bufferSize
        );

        // Apply high-pass filter
        this.highPassFilter.frequency = params.hpFreq;
        this.highPassFilter.resonance = 0.7;
        this.highPassFilter.process(
            this.workBuffer.pointer,
            this.workBuffer.pointer,
            bufferSize
        );

        // Apply low-pass filter
        this.lowPassFilter.frequency = params.lpFreq;
        this.lowPassFilter.resonance = 0.7;
        this.lowPassFilter.process(
            this.workBuffer.pointer,
            this.workBuffer.pointer,
            bufferSize
        );

        // Apply EQ shelving
        this.eq.bands[0].frequency = params.shelfLow.freq;
        this.eq.bands[0].gain = params.shelfLow.gain;
        this.eq.bands[0].q = 0.7;

        this.eq.bands[1].frequency = params.shelfHigh.freq;
        this.eq.bands[1].gain = params.shelfHigh.gain;
        this.eq.bands[1].q = 0.7;

        this.eq.process(
            this.workBuffer.pointer,
            this.outputBuffer.pointer,
            bufferSize
        );
    }

    processWithFallback(audioData, params) {
        // Native Web Audio implementation - approximates research parameters
        let processed = [...audioData];
        
        // Approximate pitch shifting with simple frequency domain manipulation
        processed = this.approximatePitchShift(processed, params.pitchCents);
        
        // Apply filtering
        processed = this.applyBandPassFilter(processed, params.hpFreq, params.lpFreq);
        
        // Apply shelving EQ approximation
        processed = this.applyShelvingEQ(processed, params.shelfLow, params.shelfHigh);
        
        // Apply formant approximation (subtle spectral shaping)
        processed = this.approximateFormantShift(processed, params.formant);
        
        return processed;
    }

    approximatePitchShift(audioData, cents) {
        // Simple pitch shift approximation using time-domain stretching
        const factor = Math.pow(2, cents / 1200);
        const newLength = Math.floor(audioData.length / factor);
        const result = new Float32Array(audioData.length);
        
        for (let i = 0; i < audioData.length; i++) {
            const sourceIndex = i * factor;
            const index = Math.floor(sourceIndex);
            const frac = sourceIndex - index;
            
            if (index < audioData.length - 1) {
                result[i] = audioData[index] * (1 - frac) + audioData[index + 1] * frac;
            } else if (index < audioData.length) {
                result[i] = audioData[index];
            }
        }
        
        return Array.from(result);
    }

    applyBandPassFilter(audioData, hpFreq, lpFreq) {
        // Simple IIR bandpass filter approximation
        const sampleRate = 48000;
        let result = [...audioData];
        
        // High-pass component
        const hpAlpha = 1 / (1 + 2 * Math.PI * hpFreq / sampleRate);
        let hpY1 = 0;
        for (let i = 0; i < result.length; i++) {
            const hpOutput = hpAlpha * (result[i] - (i > 0 ? result[i-1] : 0)) + (1 - hpAlpha) * hpY1;
            result[i] = hpOutput;
            hpY1 = hpOutput;
        }
        
        // Low-pass component
        const lpAlpha = 2 * Math.PI * lpFreq / sampleRate / (1 + 2 * Math.PI * lpFreq / sampleRate);
        let lpY1 = 0;
        for (let i = 0; i < result.length; i++) {
            result[i] = lpAlpha * result[i] + (1 - lpAlpha) * lpY1;
            lpY1 = result[i];
        }
        
        return result;
    }

    applyShelvingEQ(audioData, shelfLow, shelfHigh) {
        // Approximation of shelving EQ using simple gain curves
        const sampleRate = 48000;
        let result = [...audioData];
        
        // Apply frequency-dependent gain (simplified)
        const lowGainLinear = Math.pow(10, shelfLow.gain / 20);
        const highGainLinear = Math.pow(10, shelfHigh.gain / 20);
        
        // Simple spectral shaping approximation
        for (let i = 0; i < result.length; i++) {
            // Low shelf approximation
            if (i < result.length * 0.3) {
                result[i] *= lowGainLinear;
            }
            // High shelf approximation
            if (i > result.length * 0.7) {
                result[i] *= highGainLinear;
            }
        }
        
        return result;
    }

    approximateFormantShift(audioData, formantRatio) {
        // Simple spectral envelope modification
        const gain = 0.8 + (formantRatio - 0.75) * 0.4; // Map 0.75-0.9 to 0.8-1.0
        return audioData.map(sample => sample * gain);
    }

    onDestruct() {
        console.log('🧹 Research VoiceProcessor cleanup...');
        
        if (this.useSuperpowered) {
            // Clean up Superpowered resources
            if (this.inputBuffer) this.inputBuffer.destruct();
            if (this.outputBuffer) this.outputBuffer.destruct();
            if (this.workBuffer) this.workBuffer.destruct();
            if (this.pitchShift) this.pitchShift.destruct();
            if (this.highPassFilter) this.highPassFilter.destruct();
            if (this.lowPassFilter) this.lowPassFilter.destruct();
            if (this.eq) this.eq.destruct();
            if (this.compressor) this.compressor.destruct();
        }
        
        this.isInitialized = false;
        console.log('✅ Research VoiceProcessor cleanup complete');
    }
}

registerProcessor('VoiceProcessor', VoiceProcessorResearch); 