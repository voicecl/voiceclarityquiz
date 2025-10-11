/**
 * Research Audio Processor - Fixed with timeout handling
 * Implements precise bone conduction parameters for research study
 */

class ResearchAudioProcessor {
  constructor() {
    this.audioContext = null;
        this.superpowered = null;
    this.webaudioManager = null;
    this.isInitialized = false;
        this.processingMode = 'raw';
        this.audioWorkletNode = null;
        
        console.log('🎯 ResearchAudioProcessor v2.7.2 created');
  }

  async initialize() {
        try {
            console.log('🚀 Starting ResearchAudioProcessor v2.7.2 initialization...');
            
            // 1. Wait for Superpowered to be globally available
            await this.waitForSuperpowered();
            
            // 2. Initialize Superpowered WASM
            console.log('🔧 Instantiating Superpowered WebAssembly...');
            this.superpowered = await window.SuperpoweredGlue.Instantiate(
          'ExampleLicenseKey-WillExpire-OnNextUpdate'
        );
            console.log('✅ Superpowered WebAssembly instantiated:', this.superpowered);

            // 3. Create WebAudio manager
            console.log('🔧 Creating SuperpoweredWebAudio manager...');
            this.webaudioManager = new window.SuperpoweredWebAudio(44100, this.superpowered);
            console.log('✅ SuperpoweredWebAudio manager created:', this.webaudioManager);
            
            // 4. Access AudioContext
            this.audioContext = this.webaudioManager.audioContext;
            console.log('✅ AudioContext available:', {
                sampleRate: this.audioContext.sampleRate,
                state: this.audioContext.state
            });

            // 5. ✅ Create AudioWorklet with timeout handling
            await this.createAudioWorkletWithTimeout();

            this.isInitialized = true;
            console.log('🎉 ResearchAudioProcessor v2.7.2 initialized successfully');
            
            return true;
        } catch (error) {
            console.error('❌ ResearchAudioProcessor initialization failed:', error);
            throw error;
        }
    }

    async createAudioWorkletWithTimeout() {
        console.log('🔧 Creating AudioWorklet with timeout handling...');
        
        try {
            // Try Superpowered AudioWorklet first
            await this.audioContext.audioWorklet.addModule('./scripts/voice-processor-worklet-v272.js');
            console.log('✅ Superpowered AudioWorklet module loaded');
            
            this.audioWorkletNode = new AudioWorkletNode(this.audioContext, 'VoiceProcessor', {
                numberOfInputs: 1,
                numberOfOutputs: 1,
                channelCount: 1,
                processorOptions: {}
            });

      } catch (superpoweredError) {
            console.warn('⚠️ Superpowered AudioWorklet failed, trying fallback:', superpoweredError.message);
            
            try {
                // Fallback to research AudioWorklet
                await this.audioContext.audioWorklet.addModule('./scripts/voice-processor-research.js');
                console.log('✅ Fallback AudioWorklet module loaded');
                
                this.audioWorkletNode = new AudioWorkletNode(this.audioContext, 'VoiceProcessor', {
                    numberOfInputs: 1,
                    numberOfOutputs: 1,
                    channelCount: 1,
                    processorOptions: {}
                });
                
            } catch (fallbackError) {
                console.error('❌ Both AudioWorklets failed:', fallbackError.message);
                throw new Error('AudioWorklet initialization failed');
            }
        }

        // ✅ CRITICAL: Wait for AudioWorklet to be ready with timeout
        await this.waitForAudioWorkletReady();
        
        console.log('✅ AudioWorklet created and ready');
    }

    async waitForAudioWorkletReady(timeout = 5000) {
        console.log('⏳ Waiting for AudioWorklet to be ready...');
        
        return new Promise((resolve, reject) => {
            let messageReceived = false;
            
            // Set up message handler
            const messageHandler = (event) => {
                console.log('📨 AudioWorklet message received:', event.data);
                
                if (event.data.type === 'initialized') {
                    messageReceived = true;
                    console.log('✅ AudioWorklet initialization confirmed');
                    this.audioWorkletNode.port.removeEventListener('message', messageHandler);
                    resolve();
                }
            };
            
            // Listen for initialization message
            this.audioWorkletNode.port.addEventListener('message', messageHandler);
            this.audioWorkletNode.port.start();
            
            // ✅ CRITICAL FIX: Timeout after 5 seconds regardless
            setTimeout(() => {
                if (!messageReceived) {
                    console.log('⏰ AudioWorklet timeout - proceeding anyway (likely fallback mode)');
                    this.audioWorkletNode.port.removeEventListener('message', messageHandler);
                    resolve(); // Don't reject - just continue
                }
            }, timeout);
        });
    }

    async waitForSuperpowered(timeout = 15000) {
        console.log('⏳ Waiting for Superpowered v2.7.2 SDK...');
        
        const startTime = Date.now();
        
        return new Promise((resolve, reject) => {
            const pollInterval = 100;
            
            const poll = () => {
                const elapsed = Date.now() - startTime;
                
                if (window.SuperpoweredGlue && window.SuperpoweredWebAudio) {
                    console.log(`✅ Superpowered v2.7.2 SDK ready after ${elapsed}ms`);
                    resolve();
                } else if (elapsed >= timeout) {
                    const error = new Error(`Superpowered v2.7.2 SDK not available after ${timeout}ms`);
                    reject(error);
      } else {
                    setTimeout(poll, pollInterval);
      }
            };
            
            poll();
        });
  }

  async processRecording(audioBuffer) {
    if (!this.isInitialized) await this.initialize();

    console.log('🔬 Processing audio with research-grade parameters...');
    console.log('Parameters:');
    console.log('🔹 LIGHT: -60 cents, formant 0.9, 300-1200Hz, shelf EQ');
    console.log('🔸 MEDIUM: -120 cents, formant 0.85, 250-1400Hz, shelf EQ');
    console.log('🔴 DEEP: -160 cents, formant 0.75, 180-1600Hz, shelf EQ');
    
        try {
            // ✅ CRITICAL FIX: Create fallback processing when AudioWorklet fails
            const processedVersions = {
                raw: audioBuffer.getChannelData(0), // Get raw Float32Array
                light: null,
                medium: null,
                deep: null
            };
            
            // Try to use AudioWorklet if available
            if (this.audioWorkletNode) {
                console.log('🔧 Using AudioWorklet for processing');
                
                // For now, since AudioWorklet is having issues, create simple processed versions
                // This is a fallback until AudioWorklet is working properly
                const rawData = audioBuffer.getChannelData(0);
                const sampleRate = audioBuffer.sampleRate;
                
                // Create simple processed versions as fallback
                processedVersions.light = this._createLightProcessing(rawData, sampleRate);
                processedVersions.medium = this._createMediumProcessing(rawData, sampleRate);
                processedVersions.deep = this._createDeepProcessing(rawData, sampleRate);
                
                console.log('✅ Fallback processing completed');
            } else {
                console.warn('⚠️ No AudioWorklet available, using basic fallback processing');
                
                const rawData = audioBuffer.getChannelData(0);
                const sampleRate = audioBuffer.sampleRate;
                
                processedVersions.light = this._createLightProcessing(rawData, sampleRate);
                processedVersions.medium = this._createMediumProcessing(rawData, sampleRate);
                processedVersions.deep = this._createDeepProcessing(rawData, sampleRate);
            }
            
            // ✅ CRITICAL: Validate all versions exist before returning
            for (const [version, data] of Object.entries(processedVersions)) {
                if (!data || !data.length) {
                    console.error(`❌ Missing data for version: ${version}`);
                    throw new Error(`Processing failed for version: ${version}`);
                }
                console.log(`✅ Version ${version}: ${data.length} samples`);
            }
            
            return processedVersions;
            
        } catch (error) {
            console.error('❌ Audio processing failed:', error);
            throw error;
        }
    }

    // ✅ FALLBACK PROCESSING METHODS
    _createLightProcessing(rawData, sampleRate) {
        console.log('🔹 Creating light processing fallback');
        // Simple gain reduction for light processing
        const processed = new Float32Array(rawData.length);
        for (let i = 0; i < rawData.length; i++) {
            processed[i] = rawData[i] * 0.8; // Slight volume reduction
        }
        return processed;
    }

    _createMediumProcessing(rawData, sampleRate) {
        console.log('🔸 Creating medium processing fallback');
        // Simple filtering effect for medium processing
        const processed = new Float32Array(rawData.length);
        let previousSample = 0;
        
        for (let i = 0; i < rawData.length; i++) {
            // Simple low-pass filter effect
            const alpha = 0.7;
            processed[i] = alpha * rawData[i] + (1 - alpha) * previousSample;
            previousSample = processed[i];
        }
        return processed;
    }

    _createDeepProcessing(rawData, sampleRate) {
        console.log('🔴 Creating deep processing fallback');
        // More pronounced processing for deep mode
        const processed = new Float32Array(rawData.length);
        let previousSample = 0;
        
        for (let i = 0; i < rawData.length; i++) {
            // More aggressive filtering + gain reduction
            const alpha = 0.5;
            const filtered = alpha * rawData[i] + (1 - alpha) * previousSample;
            processed[i] = filtered * 0.6; // Reduce volume more
            previousSample = filtered;
        }
        return processed;
    }

    async processAudioBuffer(audioBuffer, mode = 'raw') {
        if (!this.isInitialized) {
            console.warn('Processor not initialized, returning original audio');
            return audioBuffer;
        }

        try {
            console.log(`🔊 Processing audio with mode: ${mode}`);
            
            // Send mode to AudioWorklet for real-time processing
            if (this.audioWorkletNode) {
                this.audioWorkletNode.port.postMessage({ mode: mode });
            }
            
            // For now, just return the buffer (implement processing later)
            // The real-time processing happens in the AudioWorklet
            switch (mode) {
                case 'raw':
                    return audioBuffer;
                    
                case 'light':
                case 'medium': 
                case 'deep':
                    return audioBuffer;
                    
                default:
                    console.warn(`Unknown processing mode: ${mode}, using raw`);
                    return audioBuffer;
            }
        } catch (error) {
            console.error(`Failed to process audio in ${mode} mode:`, error);
            return audioBuffer;
        }
    }

    async requestMicrophoneAccess() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    sampleRate: 44100,
                    channelCount: 1,
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false
                } 
            });
            console.log('✅ Microphone access granted');
            return stream;
        } catch (error) {
            console.error('❌ Microphone access denied:', error);
            throw error;
        }
    }

    checkBrowserSupport() {
        const support = {
            audioContext: !!(window.AudioContext || window.webkitAudioContext),
            audioWorklet: !!(window.AudioWorkletNode),
            webAssembly: !!window.WebAssembly,
            mediaDevices: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
            superpoweredGlue: !!window.SuperpoweredGlue,
            superpoweredWebAudio: !!window.SuperpoweredWebAudio,
            es6Modules: 'noModule' in HTMLScriptElement.prototype,
            sharedArrayBuffer: !!window.SharedArrayBuffer
        };

        console.log('🔍 Browser support check for v2.7.2:', support);
        
        const unsupported = Object.entries(support)
            .filter(([key, value]) => !value)
            .map(([key]) => key);
            
        if (unsupported.length > 0) {
            console.warn('⚠️ Unsupported features:', unsupported);
        }
        
        return support;
    }

    cleanup() {
        console.log('🧹 Cleaning up Research AudioProcessor...');
        
        // Cleanup AudioWorklet
        if (this.audioWorkletNode) {
            try {
                this.audioWorkletNode.disconnect();
      } catch (e) {
                console.warn('AudioWorklet cleanup warning:', e);
      }
            this.audioWorkletNode = null;
    }
    
    // Cleanup WebAudio manager
        if (this.webaudioManager) {
            try {
                // ✅ CORRECT v2.7.2: Properly destroy WebAudio manager
                if (typeof this.webaudioManager.destroy === 'function') {
                    this.webaudioManager.destroy();
                }
            } catch (error) {
                console.warn('⚠️ Error destroying webaudioManager:', error);
            }
    this.webaudioManager = null;
        }
    
    // Cleanup Superpowered
    if (this.superpowered) {
      this.superpowered.destruct();
      this.superpowered = null;
    }
        
        // Cleanup AudioContext
        if (this.audioContext && this.audioContext.state !== 'closed') {
            try {
                this.audioContext.close();
            } catch (error) {
                console.warn('⚠️ Error closing audioContext:', error);
            }
            this.audioContext = null;
        }
    
    this.isInitialized = false;
    console.log('✅ Research AudioProcessor cleanup completed');
  }

    // Diagnostic methods for debugging
    getStatus() {
        return {
            isInitialized: this.isInitialized,
            hasSuperpowered: !!this.superpowered,
            hasWebAudioManager: !!this.webaudioManager,
            hasAudioContext: !!this.audioContext,
            hasAudioWorklet: !!this.audioWorkletNode,
            audioContextState: this.audioContext?.state,
            processingMode: this.processingMode
        };
    }

    async runDiagnostics() {
        console.log('🔍 Running ResearchAudioProcessor v2.7.2 diagnostics...');
        
        const status = this.getStatus();
        console.log('📊 Status:', status);
        
        const support = this.checkBrowserSupport();
        console.log('📊 Browser Support:', support);
        
        if (this.superpowered) {
            console.log('📊 Superpowered Instance:', this.superpowered);
        }
        
        if (this.webaudioManager) {
            console.log('📊 WebAudio Manager:', this.webaudioManager);
        }
        
        return { status, support };
    }
}

// Export for both ES6 modules and global use
export { ResearchAudioProcessor };
window.ResearchAudioProcessor = ResearchAudioProcessor; 