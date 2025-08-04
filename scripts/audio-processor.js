/**
 * Audio Processor - CORRECTED AudioContext and DSP Integration
 * Fixed AudioContext mismatch and DSP class availability
 */

class AudioProcessor {
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
      console.log('🎵 Initializing AudioProcessor...');
      
      // 1. Create AudioContext first - IMPORTANT: Create once and reuse
      if (!this.audioContext) {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        console.log('✅ AudioContext created with sample rate:', this.audioContext.sampleRate);
      }

      // 2. Load Superpowered SDK with multiple version attempts
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

      // 3. Initialize Superpowered WASM
      this.superpowered = await SuperpoweredGlue.Instantiate(
        'ExampleLicenseKey-WillExpire-OnNextUpdate',
        'https://cdn.jsdelivr.net/npm/@superpoweredsdk/web@2.6.5/dist/superpowered-npm.wasm'
      );
      console.log('✅ Superpowered WebAssembly initialized');

      // 4. Create WebAudio manager with EXISTING AudioContext
      this.webaudioManager = new SuperpoweredWebAudio(
        this.audioContext.sampleRate,
        this.superpowered
      );
      console.log('✅ Superpowered WebAudio manager created');

      // 5. CORRECTED: Use proper createAudioNodeAsync with context handling
      console.log('🎵 Creating AudioWorklet with corrected API...');
      
      this.workletNode = await this.webaudioManager.createAudioNodeAsync(
        './scripts/voice-processor-research.js',  // url (use the research-grade version)
        'VoiceProcessor',                       // className
        (message) => {                          // callback
          this.handleWorkletMessage(message);
        },
        1,  // numInputs
        1   // numOutputs
      );

      // 6. FIXED: Don't connect to destination for processing-only worklet
      // Only connect if we need real-time audio output
      // this.workletNode.connect(this.audioContext.destination);
      console.log('✅ AudioWorklet created (not connected to destination for offline processing)');

      console.log('✅ AudioProcessor initialized successfully with Superpowered 2.7.x');
      this.isInitialized = true;

    } catch (err) {
      console.error('❌ AudioProcessor initialization failed:', err);
      throw err; // No fallback - must use Superpowered
    }
  }

  handleWorkletMessage(data) {
    console.log('📨 Worklet message received:', data);
    
    if (data.type === 'ready') {
      console.log('🎵 VoiceProcessor worklet ready:', data.message);
    } else if (data.type === 'error') {
      console.error('❌ VoiceProcessor error:', data.error);
      // Don't throw here - let it continue and show what's available
      console.log('⚠️ Continuing with limited DSP capabilities...');
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
      throw new Error('AudioWorklet not available - Superpowered initialization failed');
    }

    console.log('🎵 Processing audio with Superpowered AudioWorklet');
    
    return new Promise((resolve, reject) => {
      const requestId = Date.now() + Math.random();
      
      // Store promise handlers
      this.pendingRequests.set(requestId, { resolve, reject });
      
      // Set timeout for processing
      setTimeout(() => {
        if (this.pendingRequests.has(requestId)) {
          this.pendingRequests.delete(requestId);
          reject(new Error('AudioWorklet processing timeout'));
        }
      }, 30000); // 30 second timeout

      // Send message to worklet
      try {
        this.workletNode.sendMessageToAudioScope({
          command: 'processVoice',
          requestId,
          audioData: audioBuffer.getChannelData(0) // Mono channel for voice
        });
      } catch (error) {
        this.pendingRequests.delete(requestId);
        reject(new Error(`Failed to send message to worklet: ${error.message}`));
      }
    });
  }

  // Fallback method for when Superpowered is not available
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
    console.log('🧹 Cleaning up AudioProcessor...');
    
    // Clear pending requests
    this.pendingRequests.clear();
    
    // Cleanup worklet using Superpowered method
    if (this.workletNode) {
      try {
        this.workletNode.sendMessageToAudioScope({ command: 'cleanup' });
        if (this.workletNode.destruct) {
          this.workletNode.destruct(); // Superpowered cleanup method
        }
        this.workletNode.disconnect();
      } catch (e) {
        console.warn('Worklet cleanup warning:', e);
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
    
    // DON'T close audio context - keep it for reuse
    // if (this.audioContext && this.audioContext.state !== 'closed') {
    //   this.audioContext.close();
    // }
    // this.audioContext = null;
    
    this.isInitialized = false;
    console.log('✅ AudioProcessor cleanup completed (AudioContext preserved)');
  }
}

// Export for global use
window.AudioProcessor = AudioProcessor;