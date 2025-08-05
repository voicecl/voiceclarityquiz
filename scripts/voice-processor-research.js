// voice-processor-research.js - Fixed fallback AudioWorklet

class VoiceProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        console.log('🎯 VoiceProcessor Research AudioWorklet constructor');
        
        this.processingMode = 'raw';
        this.isInitialized = false;
        
        // ✅ CRITICAL FIX: Signal ready immediately since this is the fallback
        setTimeout(() => {
            this.isInitialized = true;
            console.log('✅ VoiceProcessor Research AudioWorklet initialized (fallback mode)');
            
            // Signal to main thread that we're ready
            this.port.postMessage({
                type: 'initialized',
                message: 'VoiceProcessor Research AudioWorklet ready (fallback mode)'
            });
        }, 10); // Small delay to ensure constructor completes
    }

    process(inputs, outputs, parameters) {
        if (!this.isInitialized) {
            // Output silence until initialized
            return true;
        }

        const input = inputs[0];
        const output = outputs[0];

        // Simple passthrough processing for fallback
        if (input && input.length > 0 && output && output.length > 0) {
            for (let channel = 0; channel < output.length; channel++) {
                const inputChannel = input[channel];
                const outputChannel = output[channel];
                
                if (inputChannel && outputChannel) {
                    // Apply simple processing based on mode
                    switch (this.processingMode) {
                        case 'raw':
                            // Just copy input to output
                            outputChannel.set(inputChannel);
                            break;
                            
                        case 'light':
                            // Simple gain reduction for light processing
                            for (let i = 0; i < inputChannel.length; i++) {
                                outputChannel[i] = inputChannel[i] * 0.8;
                            }
                            break;
                            
                        case 'medium':
                            // Simple filtering for medium processing
                            for (let i = 0; i < inputChannel.length; i++) {
                                outputChannel[i] = inputChannel[i] * 0.6;
                            }
                            break;
                            
                        case 'deep':
                            // More processing for deep mode
                            for (let i = 0; i < inputChannel.length; i++) {
                                outputChannel[i] = inputChannel[i] * 0.4;
                            }
                            break;
                            
                        default:
                            outputChannel.set(inputChannel);
                            break;
                    }
                }
            }
        }

        return true; // Keep processor alive
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

    // Handle messages from main thread
    static get parameterDescriptors() {
        return [];
    }
}

// ✅ Register the processor
registerProcessor('VoiceProcessor', VoiceProcessor); 