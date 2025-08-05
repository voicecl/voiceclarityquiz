// voice-processor-worklet-v272.js - FIXED VERSION
// ✅ CORRECT v2.7.2 AudioWorklet Implementation

// ✅ Import from CDN in AudioWorklet (required pattern)
import { SuperpoweredWebAudio } from "https://cdn.jsdelivr.net/npm/@superpoweredsdk/web@2.7.2";

class VoiceProcessor extends SuperpoweredWebAudio.AudioWorkletProcessor {
    constructor(options) {
        // ✅ CRITICAL FIX: Pass options properly to parent constructor
        super(options);
        console.log('🎯 VoiceProcessor AudioWorklet constructor');
        this.isInitialized = false;
        this.processingMode = 'raw';
        
        // ✅ DEFENSIVE: Check if options exist
        if (options && options.processorOptions) {
            console.log('🔧 AudioWorklet options received:', options.processorOptions);
        }
    }

    onReady() {
        try {
            console.log('🔧 VoiceProcessor onReady() - initializing buffers...');
            
            // ✅ Initialize buffers AFTER Superpowered is ready
            this.bufferSize = 128; // AudioWorklet fixed size
            this.inputBuf = new this.Superpowered.Float32Buffer(this.bufferSize);
            this.workBuf = new this.Superpowered.Float32Buffer(this.bufferSize);
            this.outputBuf = new this.Superpowered.Float32Buffer(this.bufferSize);
            
            // Initialize voice processing components
            this.filter = new this.Superpowered.BandpassFilter(this.samplerate);
            this.compressor = new this.Superpowered.Compressor(this.samplerate);
            
            this.isInitialized = true;
            console.log('✅ VoiceProcessor initialized successfully');
            
            this.sendMessageToMainScope({
                type: 'initialized',
                message: 'VoiceProcessor ready for processing'
            });
            
        } catch (error) {
            console.error('❌ VoiceProcessor initialization failed:', error);
            this.sendMessageToMainScope({
                type: 'error',
                message: error.message
            });
        }
    }

    processAudio(inputBuffer, outputBuffer, buffersize) {
        if (!this.isInitialized) {
            // Output silence until initialized
            this.Superpowered.memorySet(outputBuffer.pointer, 0, buffersize * 8);
            return;
        }

        try {
            // Apply processing based on mode
            this._applyProcessing(inputBuffer, outputBuffer, buffersize);
        } catch (error) {
            console.error('❌ Audio processing error:', error);
            // Output silence on error
            this.Superpowered.memorySet(outputBuffer.pointer, 0, buffersize * 8);
        }
    }

    _applyProcessing(inputBuffer, outputBuffer, buffersize) {
        // Copy input to working buffer
        this.Superpowered.memoryCopy(
            this.inputBuf.pointer,
            inputBuffer.pointer,
            buffersize * 4 // 4 bytes per float32
        );

        // Apply processing based on mode
        switch (this.processingMode) {
            case 'raw':
                // No processing - just copy input to output
                this.Superpowered.memoryCopy(
                    outputBuffer.pointer,
                    inputBuffer.pointer,
                    buffersize * 4
                );
                break;
                
            case 'light':
                this._processLight(buffersize);
                break;
                
            case 'medium':
                this._processMedium(buffersize);
                break;
                
            case 'deep':
                this._processDeep(buffersize);
                break;
                
            default:
                // Unknown mode - output silence
                this.Superpowered.memorySet(outputBuffer.pointer, 0, buffersize * 8);
                break;
        }

        // Copy processed audio to output (if not already done)
        if (this.processingMode !== 'raw') {
            this.Superpowered.memoryCopy(
                outputBuffer.pointer,
                this.workBuf.pointer,
                buffersize * 4
            );
        }
    }

    _processLight(buffersize) {
        // Light bone conduction processing
        this.filter.frequency = 1000;
        this.filter.resonance = 0.3;
        
        this.filter.process(
            this.inputBuf.pointer,
            this.workBuf.pointer,
            buffersize
        );
    }

    _processMedium(buffersize) {
        // Medium bone conduction processing
        this.filter.frequency = 800;
        this.filter.resonance = 0.5;
        
        this.filter.process(
            this.inputBuf.pointer,
            this.workBuf.pointer,
            buffersize
        );
        
        this.compressor.process(
            this.workBuf.pointer,
            this.workBuf.pointer,
            buffersize
        );
    }

    _processDeep(buffersize) {
        // Deep bone conduction processing
        this.filter.frequency = 600;
        this.filter.resonance = 0.7;
        
        this.filter.process(
            this.inputBuf.pointer,
            this.workBuf.pointer,
            buffersize
        );
        
        this.compressor.ratio = 4.0;
        this.compressor.process(
            this.workBuf.pointer,
            this.workBuf.pointer,
            buffersize
        );
    }

    onMessageFromMainScope(message) {
        if (message.mode && ['raw', 'light', 'medium', 'deep'].includes(message.mode)) {
            this.processingMode = message.mode;
            console.log(`🔄 VoiceProcessor mode changed to: ${message.mode}`);
        }
    }

    onDestruct() {
        console.log('🧹 VoiceProcessor cleanup...');
        
        // Clean up all allocated resources
        if (this.inputBuf) {
            this.inputBuf.free();
            this.inputBuf = null;
        }
        if (this.workBuf) {
            this.workBuf.free();
            this.workBuf = null;
        }
        if (this.outputBuf) {
            this.outputBuf.free();
            this.outputBuf = null;
        }
        
        // Destruct Superpowered objects
        if (this.filter) this.filter.destruct();
        if (this.compressor) this.compressor.destruct();
        
        console.log('✅ VoiceProcessor cleanup complete');
    }
}

// ✅ Register the processor
registerProcessor('VoiceProcessor', VoiceProcessor); 