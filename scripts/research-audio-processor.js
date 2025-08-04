/**
 * Research Audio Processor - Exact Parameter Implementation
 * Implements precise bone conduction parameters for research study
 */

class ResearchAudioProcessor {
  constructor() {
    this.audioContext = null;
    this.webaudioManager = null;
    this.workletNode = null;
    this.superpowered = null;
    this.isInitialized = false;
    this.pendingRequests = new Map();
  }

  async initialize() {
    if (this.isInitialized) return;

    try {
      console.log('🎵 Initializing Research AudioProcessor...');
      
      // 1. Create AudioContext
      if (!this.audioContext) {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        console.log('✅ AudioContext created with sample rate:', this.audioContext.sampleRate);
      }

      // 2. Try to load Superpowered SDK with multiple version attempts
      console.log('🎵 Loading Superpowered SDK...');
      
      const versionsToTry = [
        'https://cdn.jsdelivr.net/npm/@superpoweredsdk/web@2.6.5',
        'https://cdn.jsdelivr.net/npm/@superpoweredsdk/web@2.6.4',
        'https://cdn.jsdelivr.net/npm/@superpoweredsdk/web@2.7.0',
        'https://unpkg.com/@superpoweredsdk/web@2.6.5',
        'https://unpkg.com/@superpoweredsdk/web@2.6.4'
      ];
      
      let SuperpoweredGlue, SuperpoweredWebAudio;
      let successfulVersion = null;
      
      for (const versionUrl of versionsToTry) {
        try {
          console.log(`🔍 Trying version: ${versionUrl}`);
          const module = await import(versionUrl);
          console.log('🔍 Available exports:', Object.keys(module));
          
          // Try to get the exports we need
          SuperpoweredGlue = module.SuperpoweredGlue || module.default?.SuperpoweredGlue;
          SuperpoweredWebAudio = module.SuperpoweredWebAudio || module.default?.SuperpoweredWebAudio;
          
          if (SuperpoweredGlue && SuperpoweredWebAudio) {
            successfulVersion = versionUrl;
            console.log(`✅ Superpowered SDK loaded successfully from: ${versionUrl}`);
            break;
          } else {
            console.warn(`⚠️ Version ${versionUrl} has no required exports. Available: ${Object.keys(module).join(', ')}`);
          }
        } catch (versionError) {
          console.warn(`⚠️ Version ${versionUrl} failed:`, versionError.message);
        }
      }
      
      if (!SuperpoweredGlue || !SuperpoweredWebAudio) {
        throw new Error(`All Superpowered versions failed. Available versions tried: ${versionsToTry.join(', ')}`);
      }

      try {
        // 3. Initialize Superpowered WASM
        this.superpowered = await SuperpoweredGlue.Instantiate(
          'ExampleLicenseKey-WillExpire-OnNextUpdate'
        );
        console.log('✅ Superpowered WebAssembly initialized');

        // 4. Create WebAudio manager
        this.webaudioManager = new SuperpoweredWebAudio(
          this.audioContext.sampleRate,
          this.superpowered
        );
        console.log('✅ Superpowered WebAudio manager created');

        // 5. Create research-grade AudioWorklet
        this.workletNode = await this.webaudioManager.createAudioNodeAsync(
          './scripts/voice-processor-research.js',
          'VoiceProcessor',
          (message) => this.handleWorkletMessage(message),
          1, 1
        );

        console.log('✅ Research-grade AudioWorklet created');

      } catch (superpoweredError) {
        console.warn('⚠️ Superpowered SDK failed, using fallback:', superpoweredError);
        
        // Fallback to native Web Audio AudioWorklet
        await this.audioContext.audioWorklet.addModule('./scripts/voice-processor-research.js');
        this.workletNode = new AudioWorkletNode(this.audioContext, 'VoiceProcessor');
        this.workletNode.port.onmessage = (event) => this.handleWorkletMessage(event.data);
        
        console.log('✅ Fallback AudioWorklet created');
      }

      console.log('✅ Research AudioProcessor initialized successfully');
      this.isInitialized = true;

    } catch (err) {
      console.error('❌ Research AudioProcessor initialization failed:', err);
      throw err;
    }
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

        if (this.workletNode.sendMessageToAudioScope) {
          // Superpowered AudioWorklet
          this.workletNode.sendMessageToAudioScope(message);
        } else {
          // Standard AudioWorklet
          this.workletNode.port.postMessage(message);
        }
      } catch (error) {
        this.pendingRequests.delete(requestId);
        reject(new Error(`Failed to send message to research worklet: ${error.message}`));
      }
    });
  }

  async processRecordingFallback(audioBuffer) {
    console.log('🔄 Using fallback processing without Superpowered...');
    
    // Simple fallback processing without Superpowered
    const audioData = Array.from(audioBuffer.getChannelData(0));
    
    return {
      light: new Float32Array(this.processBasicFilter(audioData, 0.8)),
      medium: new Float32Array(this.processBasicFilter(audioData, 0.6)),
      deep: new Float32Array(this.processBasicFilter(audioData, 0.4))
    };
  }

  processBasicFilter(audioData, intensity) {
    // Basic low-pass filter simulation
    return audioData.map((sample, i) => {
      if (i === 0) return sample * intensity;
      return (sample + audioData[i-1]) * 0.5 * intensity;
    });
  }

  cleanup() {
    console.log('🧹 Cleaning up Research AudioProcessor...');
    
    // Clear pending requests
    this.pendingRequests.clear();
    
    // Cleanup worklet
    if (this.workletNode) {
      try {
        const cleanupMessage = { command: 'cleanup' };
        
        if (this.workletNode.sendMessageToAudioScope) {
          this.workletNode.sendMessageToAudioScope(cleanupMessage);
        } else {
          this.workletNode.port.postMessage(cleanupMessage);
        }
        
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
    this.webaudioManager = null;
    
    // Cleanup Superpowered
    if (this.superpowered) {
      this.superpowered.destruct();
      this.superpowered = null;
    }
    
    this.isInitialized = false;
    console.log('✅ Research AudioProcessor cleanup completed');
  }
}

// Export for both ES6 modules and global use
export { ResearchAudioProcessor };
window.ResearchAudioProcessor = ResearchAudioProcessor; 