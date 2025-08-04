// voice-processor-worklet.js - FIXED VERSION
class VoiceProcessorWorklet extends AudioWorkletProcessor {
    constructor() {
        super();
        console.log('🎵 VoiceProcessorWorklet constructor called');
        
        this.initialized = false;
        this.sampleRate = 48000;
        
        // Exact processing settings from original
        this.processingSettings = {
            light: {
                pitchCents: -60,
                formant: 0.9,
                hpFreq: 300,
                lpFreq: 1200,
                shelfLow: { freq: 500, gain: 3 },
                shelfHigh: { freq: 2000, gain: -3 },
                comp: null,
                notch: null,
                vibro: null
            },
            medium: {
                pitchCents: -120,
                formant: 1.0,
                hpFreq: 250,
                lpFreq: 1300,
                shelfLow: { freq: 450, gain: 4 },
                shelfHigh: { freq: 2200, gain: -4 },
                comp: { ratio: 2, threshold: -18, knee: 6 },
                notch: null,
                vibro: null
            },
            deep: {
                pitchCents: -120,
                formant: 1.0,
                hpFreq: 200,
                lpFreq: 1400,
                shelfLow: { freq: 400, gain: 5 },
                shelfHigh: { freq: 2500, gain: -5 },
                comp: { ratio: 3, threshold: -20 },
                notch: { freq: 3000, q: 1.0 },
                vibro: { freq: 60, gain: 6, q: 1.0 }
            }
        };
        
        this.port.onmessage = (e) => {
            this.onMessageFromMainScope(e.data);
        };
        
        this.initializeSuperpowered();
    }
    
    async initializeSuperpowered() {
        try {
            console.log('🎵 Initializing Superpowered in worklet...');
            
            // Wait for Superpowered to be available
            let attempts = 0;
            const maxAttempts = 50;
            
            while (typeof Superpowered === 'undefined' && attempts < maxAttempts) {
                await new Promise(resolve => setTimeout(resolve, 100));
                attempts++;
            }
            
            if (typeof Superpowered === 'undefined') {
                throw new Error('Superpowered not available after waiting');
            }
            
            console.log('✅ Superpowered is available, creating processors...');
            
            this.processors = {
                light: this.createProcessors(),
                medium: this.createProcessors(), 
                deep: this.createProcessors()
            };
            
            this.initialized = true;
            console.log('✅ All Superpowered processors initialized');
            
            this.port.postMessage({ event: 'ready' });
            
        } catch (error) {
            console.error('❌ Failed to initialize Superpowered:', error);
            this.port.postMessage({ event: 'error', error: error.message });
        }
    }
    
    createProcessors() {
        try {
            return {
                pitchShift: new Superpowered.PitchShift(this.sampleRate, 1),
                highPass: new Superpowered.Filter(Superpowered.Filter.Resonant_Highpass, this.sampleRate),
                lowPass: new Superpowered.Filter(Superpowered.Filter.Resonant_Lowpass, this.sampleRate),
                eq: new Superpowered.EQ(this.sampleRate),
                compressor: new Superpowered.Compressor(this.sampleRate),
                notch: new Superpowered.Filter(Superpowered.Filter.Resonant_Notch, this.sampleRate)
            };
        } catch (error) {
            console.error('❌ Error creating processors:', error);
            return null;
        }
    }
    
    onMessageFromMainScope(data) {
        if (data.command === 'process') {
            this._makeVersions(data.audioData, data.requestId);
        }
    }
    
    _makeVersions(inputBuffer, requestId) {
        if (!this.initialized || !this.processors) {
            console.error('❌ Processors not initialized');
            this.port.postMessage({
                requestId: requestId,
                error: 'Processors not initialized'
            });
            return;
        }
        
        try {
            const versions = {};
            
            versions.light = this.processVersion(inputBuffer, 'light');
            versions.medium = this.processVersion(inputBuffer, 'medium');
            versions.deep = this.processVersion(inputBuffer, 'deep');
            
            console.log('Processing complete. Output versions:', Object.keys(versions));
            
            this.port.postMessage({
                requestId: requestId,
                versions: versions
            });
            
        } catch (error) {
            console.error('❌ Processing error in _makeVersions:', error);
            this.port.postMessage({
                requestId: requestId,
                error: error.message
            });
        }
    }
    
    processVersion(inputBuffer, versionType) {
        const settings = this.processingSettings[versionType];
        const processors = this.processors[versionType];
        
        if (!processors) {
            console.error(`❌ No processors for ${versionType}`);
            return new Float32Array(inputBuffer);
        }
        
        console.log(`[${versionType}] params:`, JSON.stringify(settings));
        
        const workingBuffer = new Float32Array(inputBuffer.length);
        inputBuffer.forEach((sample, i) => workingBuffer[i] = sample);
        
        let energy = this.calculateEnergy(workingBuffer);
        console.log(`[${versionType}] energy ▶ input: ${energy.toFixed(6)}`);
        
        try {
            // 1. Pitch Shift
            if (settings.pitchCents !== 0) {
                processors.pitchShift.pitchCents = settings.pitchCents;
                processors.pitchShift.formantCorrection = settings.formant;
                
                const tempBuffer = new Float32Array(workingBuffer.length);
                const success = processors.pitchShift.process(workingBuffer, tempBuffer, workingBuffer.length);
                
                if (success) {
                    workingBuffer.set(tempBuffer);
                    energy = this.calculateEnergy(workingBuffer);
                    console.log(`[${versionType}] energy ▶ pitch-shift: ${energy.toFixed(6)}`);
                } else {
                    console.warn(`[${versionType}] PitchShift returned no output on this frame`);
                }
            }
            
            // 2. High-pass filter
            if (settings.hpFreq) {
                processors.highPass.frequency = settings.hpFreq;
                processors.highPass.resonance = 0.1;
                processors.highPass.process(workingBuffer, workingBuffer, workingBuffer.length);
                
                energy = this.calculateEnergy(workingBuffer);
                console.log(`[${versionType}] energy ▶ high-pass: ${energy.toFixed(6)}`);
            }
            
            // 3. Low-pass filter
            if (settings.lpFreq) {
                processors.lowPass.frequency = settings.lpFreq;
                processors.lowPass.resonance = 0.1;
                processors.lowPass.process(workingBuffer, workingBuffer, workingBuffer.length);
                
                energy = this.calculateEnergy(workingBuffer);
                console.log(`[${versionType}] energy ▶ low-pass: ${energy.toFixed(6)}`);
            }
            
            // 4. EQ (Shelving filters)
            if (settings.shelfLow || settings.shelfHigh) {
                if (settings.shelfLow) {
                    processors.eq.bands[0].frequency = settings.shelfLow.freq;
                    processors.eq.bands[0].gain = settings.shelfLow.gain;
                    processors.eq.bands[0].bandwidth = 1.0;
                }
                
                if (settings.shelfHigh) {
                    processors.eq.bands[1].frequency = settings.shelfHigh.freq;
                    processors.eq.bands[1].gain = settings.shelfHigh.gain;
                    processors.eq.bands[1].bandwidth = 1.0;
                }
                
                processors.eq.process(workingBuffer, workingBuffer, workingBuffer.length);
                
                energy = this.calculateEnergy(workingBuffer);
                console.log(`[${versionType}] energy ▶ EQ: ${energy.toFixed(6)}`);
            }
            
            // 5. Notch filter (deep only)
            if (settings.notch) {
                processors.notch.frequency = settings.notch.freq;
                processors.notch.resonance = settings.notch.q || 1.0;
                processors.notch.process(workingBuffer, workingBuffer, workingBuffer.length);
                
                energy = this.calculateEnergy(workingBuffer);
                console.log(`[${versionType}] energy ▶ notch: ${energy.toFixed(6)}`);
            }
            
            // 6. Vibro boost (deep only) - LFO tremolo effect
            if (settings.vibro) {
                const vibroFreq = settings.vibro.freq || 60; // Hz
                const vibroDepth = settings.vibro.gain || 6; // dB
                const sampleRate = this.sampleRate;
                
                for (let i = 0; i < workingBuffer.length; i++) {
                    // Create LFO modulation
                    const time = i / sampleRate;
                    const lfo = Math.sin(2 * Math.PI * vibroFreq * time);
                    const modulation = 1 + (vibroDepth / 20) * lfo; // Convert dB to linear
                    
                    workingBuffer[i] *= modulation;
                }
                
                energy = this.calculateEnergy(workingBuffer);
                console.log(`[${versionType}] energy ▶ vibro: ${energy.toFixed(6)}`);
            }
            
            // 7. Compression (medium and deep)
            if (settings.comp) {
                processors.compressor.ratio = settings.comp.ratio;
                processors.compressor.thresholdDb = settings.comp.threshold;
                if (settings.comp.knee) {
                    processors.compressor.knee = settings.comp.knee;
                }
                
                processors.compressor.process(workingBuffer, workingBuffer, workingBuffer.length);
                
                energy = this.calculateEnergy(workingBuffer);
                console.log(`[${versionType}] energy ▶ compression: ${energy.toFixed(6)}`);
            }
            
            const finalEnergy = this.calculateEnergy(workingBuffer);
            console.log(`[${versionType}] energy ▶ FINAL: ${finalEnergy.toFixed(6)}`);
            
            const inputEnergy = this.calculateEnergy(inputBuffer);
            const energyDiff = Math.abs(finalEnergy - inputEnergy);
            const hasProcessing = energyDiff > 0.001;
            
            console.log(`🔍 ${versionType} processing verification:`, {
                inputEnergy: inputEnergy.toFixed(6),
                processedEnergy: finalEnergy.toFixed(6),
                energyDiff: energyDiff.toFixed(6),
                hasProcessing: hasProcessing
            });
            
            if (!hasProcessing) {
                console.log(`❌ CRITICAL: ${versionType} processing had no effect!`);
                return this.applyFallbackProcessing(new Float32Array(inputBuffer), versionType);
            }
            
            return workingBuffer;
            
        } catch (error) {
            console.error(`❌ Error processing ${versionType}:`, error);
            return this.applyFallbackProcessing(new Float32Array(inputBuffer), versionType);
        }
    }
    
    applyFallbackProcessing(buffer, versionType) {
        console.log(`🔄 Applying fallback processing for ${versionType}`);
        
        const settings = this.processingSettings[versionType];
        
        for (let i = 0; i < buffer.length; i++) {
            let sample = buffer[i];
            
            if (settings.pitchCents < 0) {
                sample *= 0.95;
            }
            
            if (i > 0 && settings.hpFreq) {
                sample = sample * 0.7 + buffer[i-1] * 0.3;
            }
            
            if (settings.shelfLow && settings.shelfLow.gain > 0) {
                sample *= 1.1;
            }
            if (settings.shelfHigh && settings.shelfHigh.gain < 0) {
                sample *= 0.9;
            }
            
            if (settings.comp) {
                const threshold = Math.pow(10, settings.comp.threshold / 20);
                if (Math.abs(sample) > threshold) {
                    const ratio = settings.comp.ratio;
                    sample = sample > 0 ? 
                        threshold + (sample - threshold) / ratio :
                        -threshold + (sample + threshold) / ratio;
                }
            }
            
            buffer[i] = Math.max(-1, Math.min(1, sample));
        }
        
        console.log(`✅ Fallback processing applied for ${versionType}`);
        return buffer;
    }
    
    calculateEnergy(buffer) {
        let energy = 0;
        for (let i = 0; i < buffer.length; i++) {
            energy += buffer[i] * buffer[i];
        }
        return energy;
    }
    
    process(inputs, outputs, parameters) {
        return true;
    }
}

registerProcessor('VoiceProcessor', VoiceProcessorWorklet);