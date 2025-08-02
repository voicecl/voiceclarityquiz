// runs only in AudioWorkletGlobalScope
if (typeof registerProcessor === 'function') {
  importScripts(
    'https://cdn.jsdelivr.net/npm/@superpoweredsdk/web@2.7.2/dist/Superpowered.js'
  );

class VoiceProcessor extends SuperpoweredWebAudio.AudioWorkletProcessor {
    constructor(options) {
      super(options);
      
      // Initialize Superpowered
      this.superpowered = new Superpowered();
      this.superpowered.init();
      
      // Create DSP chains for different audio versions
      this.createDSPChains();
      
      // Buffer for processing
      this.inputBuffer = new Float32Array(4096);
      this.outputBuffer = new Float32Array(4096);
      
      console.log('VoiceProcessor: Initialized in Worklet context');
    }

    createDSPChains() {
      // Create different DSP chains for various audio processing
      this.originalChain = new Superpowered.FloatToInt16();
      this.enhancedChain = new Superpowered.FloatToInt16();
      this.filteredChain = new Superpowered.FloatToInt16();
      this.compressedChain = new Superpowered.FloatToInt16();
      
      // Configure enhanced chain with some effects
      this.enhancedChain.setSamplerate(44100);
      
      // Configure filtered chain
      this.filteredChain.setSamplerate(44100);
      
      // Configure compressed chain
      this.compressedChain.setSamplerate(44100);
    }
    
    process(inputs, outputs, parameters) {
      const input = inputs[0];
      const output = outputs[0];
      
      if (!input || !input[0]) return true;
      
      const inputData = input[0];
      const outputData = output[0];
      
      // Copy input to our processing buffer
      for (let i = 0; i < inputData.length; i++) {
        this.inputBuffer[i] = inputData[i];
      }
      
      // Process through different chains
      this.originalChain.process(this.inputBuffer, outputData, inputData.length);
      
      // For now, just copy input to output
      // In a real implementation, you'd process through different DSP chains
      for (let i = 0; i < inputData.length; i++) {
        outputData[i] = inputData[i];
      }
      
      return true;
    }

    destroy() {
      if (this.superpowered) {
        this.superpowered.destroy();
      }
    }
  }

  registerProcessor('VoiceProcessor', VoiceProcessor);
} 