// voice-processor-research.js
// Fallback AudioWorklet for research processing (no Superpowered dependency)

class VoiceProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        console.log('🎯 VoiceProcessor Research AudioWorklet constructor');
        this.isInitialized = false;
        this.processingMode = 'raw';
        this.sampleRate = 44100;
    }

    process(inputs, outputs, parameters) {
        const input = inputs[0];
        const output = outputs[0];
        
        if (!input || !output) return true;

        try {
            // Apply processing based on mode
            this._applyProcessing(input, output);
        } catch (error) {
            console.error('❌ Audio processing error:', error);
            // Output silence on error
            for (let channel = 0; channel < output.length; channel++) {
                output[channel].fill(0);
            }
        }

        return true;
    }

    _applyProcessing(input, output) {
        const inputChannel = input[0];
        const outputChannel = output[0];
        
        if (!inputChannel || !outputChannel) return;

        // Apply processing based on mode
        switch (this.processingMode) {
            case 'raw':
                // No processing - just copy input to output
                outputChannel.set(inputChannel);
                break;
                
            case 'light':
                this._processLight(inputChannel, outputChannel);
                break;
                
            case 'medium':
                this._processMedium(inputChannel, outputChannel);
                break;
                
            case 'deep':
                this._processDeep(inputChannel, outputChannel);
                break;
                
            default:
                // Unknown mode - output silence
                outputChannel.fill(0);
                break;
        }
    }

    _processLight(input, output) {
        // Light bone conduction processing - simple EQ
        for (let i = 0; i < input.length; i++) {
            // Simple high-pass filter effect
            const sample = input[i];
            output[i] = sample * 0.8; // Slight attenuation
        }
    }

    _processMedium(input, output) {
        // Medium bone conduction processing
        for (let i = 0; i < input.length; i++) {
            const sample = input[i];
            // Add some compression-like effect
            output[i] = Math.tanh(sample * 1.5) * 0.6;
        }
    }

    _processDeep(input, output) {
        // Deep bone conduction processing
        for (let i = 0; i < input.length; i++) {
            const sample = input[i];
            // More aggressive processing
            output[i] = Math.tanh(sample * 2.0) * 0.4;
        }
    }

    onMessageFromMainScope(message) {
        console.log('📨 VoiceProcessor received message:', message);
        
        if (message.mode && ['raw', 'light', 'medium', 'deep'].includes(message.mode)) {
            this.processingMode = message.mode;
            console.log(`🔄 VoiceProcessor mode changed to: ${message.mode}`);
        }
        
        if (message.command === 'processVoice') {
            console.log('🎵 Processing voice with mode:', this.processingMode);
        }
    }
}

// Register the processor
registerProcessor('VoiceProcessor', VoiceProcessor); 