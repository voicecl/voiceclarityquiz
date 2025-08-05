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

      // 2. Get Superpowered from window object (loaded via CDN)
      console.log('🎵 Loading Superpowered SDK from CDN...');
      
      if (!window.Superpowered || !window.SuperpoweredGlue) {
        throw new Error("❌ Superpowered SDK not available. Check if CDN script is loaded in index.html");
      }
      
      const Superpowered = window.Superpowered;
      const SuperpoweredGlue = window.SuperpoweredGlue;
      const SuperpoweredWebAudio = SuperpoweredGlue.SuperpoweredWebAudio;
      
      console.log('✅ Superpowered SDK loaded successfully from CDN');

      // 3. Initialize Superpowered WASM
      // ✅ Using Superpowered's official public test key for development only
      // ⚠️ Do not replace with a real license in public or testing environments
      this.superpowered = await SuperpoweredGlue.Instantiate(
        'ExampleLicenseKey-WillExpire-OnNextUpdate',
        Superpowered
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

        this.workletNode.sendMessageToAudioScope(message);
      } catch (error) {
        this.pendingRequests.delete(requestId);
        reject(new Error(`Failed to send message to research worklet: ${error.message}`));
      }
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