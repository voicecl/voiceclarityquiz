/**
 * Research Audio Processor - CORRECT v2.7.2 Implementation
 * Implements precise bone conduction parameters for research study
 */

class ResearchAudioProcessor {
    constructor() {
        this.audioContext = null;
        this.superpowered = null;
        this.webaudioManager = null;
        this.workletNode = null;
        this.isInitialized = false;
        this.pendingRequests = new Map();
        
        console.log('🎯 ResearchAudioProcessor v2.7.2 created');
    }

    async initialize() {
        if (this.isInitialized) return;

        try {
            console.log('🚀 Starting ResearchAudioProcessor v2.7.2 initialization...');
            
            // 1. Wait for Superpowered to be globally available
            await this.waitForSuperpowered();
            
            // 2. ✅ CORRECT v2.7.2 Pattern: Instantiate first, then create WebAudio manager
            console.log('🔧 Instantiating Superpowered WebAssembly...');
            this.superpowered = await window.SuperpoweredGlue.Instantiate(
                'ExampleLicenseKey-WillExpire-OnNextUpdate'  // ✅ Single parameter for evaluation
            );
            console.log('✅ Superpowered WebAssembly instantiated:', this.superpowered);

            // 3. ✅ CORRECT v2.7.2 Pattern: Create WebAudio manager with instantiated WASM
            console.log('🔧 Creating SuperpoweredWebAudio manager...');
            this.webaudioManager = new window.SuperpoweredWebAudio(44100, this.superpowered);
            console.log('✅ SuperpoweredWebAudio manager created:', this.webaudioManager);
            
            // 4. Access the underlying AudioContext
            this.audioContext = this.webaudioManager.audioContext;
            console.log('✅ AudioContext available:', {
                sampleRate: this.audioContext.sampleRate,
                state: this.audioContext.state
            });

            // 5. Create research-grade AudioWorklet
            this.workletNode = await this.webaudioManager.createAudioNodeAsync(
                './scripts/voice-processor-worklet-v272.js',
                'VoiceProcessor',
                (message) => this.handleWorkletMessage(message),
                1, 1
            );

            console.log('✅ Research-grade AudioWorklet created');
            console.log('🎉 ResearchAudioProcessor v2.7.2 initialized successfully');
            this.isInitialized = true;

        } catch (error) {
            console.error('❌ ResearchAudioProcessor v2.7.2 initialization failed:', error);
            console.log('💡 Common v2.7.2 issues:');
            console.log('   - HTTPS required for SharedArrayBuffer features');
            console.log('   - CORS headers needed for cross-origin requests');
            console.log('   - ES6 module support required');
            throw error;
        }
    }

    async waitForSuperpowered(timeout = 15000) {
        console.log('⏳ Waiting for Superpowered v2.7.2 SDK...');
        
        const startTime = Date.now();
        
        return new Promise((resolve, reject) => {
            const pollInterval = 100; // Check every 100ms
            
            const poll = () => {
                const elapsed = Date.now() - startTime;
                
                if (window.SuperpoweredGlue && window.SuperpoweredWebAudio) {
                    console.log(`✅ Superpowered v2.7.2 SDK ready after ${elapsed}ms`);
                    resolve();
                } else if (elapsed >= timeout) {
                    const error = new Error(`Superpowered v2.7.2 SDK not available after ${timeout}ms`);
                    console.error('❌', error.message);
                    console.log('🔍 Debug info:', {
                        SuperpoweredGlue: typeof window.SuperpoweredGlue,
                        SuperpoweredWebAudio: typeof window.SuperpoweredWebAudio,
                        availableGlobals: Object.keys(window).filter(k => k.toLowerCase().includes('super'))
                    });
                    reject(error);
                } else {
                    setTimeout(poll, pollInterval);
                }
            };
            
            poll();
        });
    }

    handleWorkletMessage(data) {
        console.log('📨 Research worklet message:', data);
        
        if (data.type === 'ready') {
            console.log('🎵 Research VoiceProcessor ready:', data.message);
        } else if (data.type === 'error') {
            console.error('❌ Research VoiceProcessor error:', data.error);
        } else if (data.type === 'info') {
            console.log('ℹ️ Research VoiceProcessor info:', data.message);
        } else if (data.requestId && this.pendingRequests.has(data.requestId)) {
            const { resolve, reject } = this.pendingRequests.get(data.requestId);
            this.pendingRequests.delete(data.requestId);
            
            if (data.error) {
                reject(new Error(data.error));
            } else {
                resolve(data.versions);
            }
        }
    }

    async processRecording(audioBuffer) {
        if (!this.isInitialized) await this.initialize();

        if (!this.workletNode) {
            throw new Error('Research AudioWorklet not available');
        }

        console.log('🔬 Processing audio with research-grade parameters...');
        console.log('Parameters:');
        console.log('🔹 LIGHT: -60 cents, formant 0.9, 300-1200Hz, shelf EQ');
        console.log('🔸 MEDIUM: -120 cents, formant 0.85, 250-1400Hz, shelf EQ');
        console.log('🔴 DEEP: -160 cents, formant 0.75, 180-1600Hz, shelf EQ');
        
        return new Promise((resolve, reject) => {
            const requestId = Date.now() + Math.random();
            
            // Store promise handlers
            this.pendingRequests.set(requestId, { resolve, reject });
            
            // Set timeout for processing
            setTimeout(() => {
                if (this.pendingRequests.has(requestId)) {
                    this.pendingRequests.delete(requestId);
                    reject(new Error('Research processing timeout'));
                }
            }, 30000); // 30 second timeout

            // Send message to worklet
            try {
                const message = {
                    command: 'processVoice',
                    requestId,
                    audioData: Array.from(audioBuffer.getChannelData(0)) // Mono channel
                };

                this.workletNode.sendMessageToAudioScope(message);
            } catch (error) {
                this.pendingRequests.delete(requestId);
                reject(new Error(`Failed to send message to research worklet: ${error.message}`));
            }
        });
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
        
        // Clear pending requests
        this.pendingRequests.clear();
        
        // Cleanup worklet
        if (this.workletNode) {
            try {
                const cleanupMessage = { command: 'cleanup' };
                this.workletNode.sendMessageToAudioScope(cleanupMessage);
                
                if (this.workletNode.destruct) {
                    this.workletNode.destruct();
                }
                this.workletNode.disconnect();
            } catch (e) {
                console.warn('Research worklet cleanup warning:', e);
            }
            this.workletNode = null;
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
            audioContextState: this.audioContext?.state,
            hasWorkletNode: !!this.workletNode
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