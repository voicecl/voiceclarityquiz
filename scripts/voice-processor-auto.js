// Auto-fallback VoiceProcessor that tries Superpowered first, then falls back to native Web Audio

let VoiceProcessor;

try {
    // Try to import Superpowered SDK
    import { SuperpoweredWebAudio } from 'https://cdn.jsdelivr.net/npm/@superpoweredsdk/web@2.6.5';
    
    // If import succeeds, use Superpowered version
    VoiceProcessor = class extends SuperpoweredWebAudio.AudioWorkletProcessor {
        constructor() {
            super();
            this.isInitialized = false;
            this.processingMode = 'A';
            this.pendingRequests = new Map();
            this.bufferSize = 1024;
        }

        onReady() {
            try {
                console.log('🎵 VoiceProcessor onReady() called');
                
                this.inputBuffer = new this.Superpowered.Float32Buffer(this.bufferSize);
                this.outputBuffer = new this.Superpowered.Float32Buffer(this.bufferSize);
                this.workBuffer = new this.Superpowered.Float32Buffer(this.bufferSize);
                
                this.pitchShift = new this.Superpowered.PitchShift(this.samplerate, this.bufferSize);
                this.filter = new this.Superpowered.Filter(this.Superpowered.Filter_Resonant_Lowpass, this.samplerate);
                this.compressor = new this.Superpowered.Compressor(this.samplerate);
                
                this.setupProcessors();
                
                this.isInitialized = true;
                this.sendMessageToMainScope({
                    type: 'ready',
                    message: 'Superpowered VoiceProcessor initialized successfully'
                });
                
                console.log('✅ Superpowered VoiceProcessor initialized successfully');
                
            } catch (error) {
                console.error('❌ Superpowered VoiceProcessor initialization failed:', error);
                this.sendMessageToMainScope({
                    type: 'error',
                    error: error.message
                });
            }
        }

        setupProcessors() {
            this.pitchShift.pitchShiftCents = -100;
            this.filter.frequency = 1000;
            this.filter.resonance = 0.7;
            this.compressor.ratio = 3.0;
            this.compressor.attackSec = 0.01;
            this.compressor.releaseSec = 0.1;
        }

        onMessageFromMainScope(message) {
            console.log('📨 VoiceProcessor received:', message);
            
            if (message.command === 'processVoice') {
                this.handleProcessVoice(message);
            } else if (message.command === 'setMode') {
                this.processingMode = message.mode;
            }
        }

        handleProcessVoice(message) {
            if (!this.isInitialized) {
                this.sendMessageToMainScope({
                    requestId: message.requestId,
                    error: 'Processor not initialized'
                });
                return;
            }

            try {
                const { audioData, requestId } = message;
                
                if (!audioData || !Array.isArray(audioData)) {
                    throw new Error('Invalid audio data');
                }

                const processedVersions = this.generateProcessedVersions(audioData);
                
                this.sendMessageToMainScope({
                    requestId: requestId,
                    versions: processedVersions
                });

            } catch (error) {
                console.error('Processing error:', error);
                this.sendMessageToMainScope({
                    requestId: message.requestId,
                    error: error.message
                });
            }
        }

        generateProcessedVersions(audioData) {
            const length = audioData.length;
            const chunkSize = Math.min(length, this.bufferSize);
            const result = {
                light: new Float32Array(length),
                medium: new Float32Array(length),
                deep: new Float32Array(length)
            };

            for (let offset = 0; offset < length; offset += chunkSize) {
                const currentChunkSize = Math.min(chunkSize, length - offset);
                const chunk = audioData.slice(offset, offset + currentChunkSize);
                
                result.light.set(this.processChunk(chunk, 'light'), offset);
                result.medium.set(this.processChunk(chunk, 'medium'), offset);
                result.deep.set(this.processChunk(chunk, 'deep'), offset);
            }

            return result;
        }

        processChunk(chunk, mode) {
            const chunkSize = chunk.length;
            const inputArray = new Float32Array(chunk);
            
            this.inputBuffer.copyFrom(inputArray, 0, chunkSize);
            
            switch (mode) {
                case 'light':
                    this.processLight(chunkSize);
                    break;
                case 'medium':
                    this.processMedium(chunkSize);
                    break;
                case 'deep':
                    this.processDeep(chunkSize);
                    break;
            }
            
            const outputArray = new Float32Array(chunkSize);
            this.outputBuffer.copyTo(outputArray, 0, chunkSize);
            
            return outputArray;
        }

        processLight(bufferSize) {
            // Light bone conduction - subtle filtering
            this.filter.frequency = 1200;
            this.filter.resonance = 0.5;
            this.filter.process(
                this.inputBuffer.pointer,
                this.outputBuffer.pointer,
                bufferSize
            );
        }

        processMedium(bufferSize) {
            // Medium bone conduction - moderate filtering + compression
            this.filter.frequency = 1000;
            this.filter.resonance = 0.7;
            this.compressor.ratio = 2.0;
            
            this.filter.process(
                this.inputBuffer.pointer,
                this.workBuffer.pointer,
                bufferSize
            );
            
            this.compressor.process(
                this.workBuffer.pointer,
                this.outputBuffer.pointer,
                bufferSize
            );
        }

        processDeep(bufferSize) {
            // Deep bone conduction - strong filtering + pitch shift + compression
            this.pitchShift.pitchShiftCents = -100;
            this.filter.frequency = 800;
            this.filter.resonance = 0.8;
            this.compressor.ratio = 4.0;
            
            this.pitchShift.process(
                this.inputBuffer.pointer,
                this.workBuffer.pointer,
                bufferSize
            );
            
            this.filter.process(
                this.workBuffer.pointer,
                this.workBuffer.pointer,
                bufferSize
            );
            
            this.compressor.process(
                this.workBuffer.pointer,
                this.outputBuffer.pointer,
                bufferSize
            );
        }

        processAudio(inputBuffer, outputBuffer, buffersize) {
            if (!this.isInitialized) {
                for (let i = 0; i < buffersize; i++) {
                    outputBuffer.pointer[i] = 0;
                }
                return;
            }
            
            this.Superpowered.memoryCopy(
                outputBuffer.pointer,
                inputBuffer.pointer,
                buffersize * 4
            );
        }

        onDestruct() {
            console.log('🧹 VoiceProcessor cleanup...');
            
            if (this.inputBuffer) {
                this.inputBuffer.destruct();
                this.inputBuffer = null;
            }
            if (this.outputBuffer) {
                this.outputBuffer.destruct();
                this.outputBuffer = null;
            }
            if (this.workBuffer) {
                this.workBuffer.destruct();
                this.workBuffer = null;
            }
            
            if (this.pitchShift) {
                this.pitchShift.destruct();
                this.pitchShift = null;
            }
            if (this.filter) {
                this.filter.destruct();
                this.filter = null;
            }
            if (this.compressor) {
                this.compressor.destruct();
                this.compressor = null;
            }
            
            this.isInitialized = false;
            console.log('✅ VoiceProcessor cleanup complete');
        }
    };
    
    console.log('✅ Using Superpowered VoiceProcessor');
    
} catch (error) {
    console.warn('⚠️ Superpowered SDK not available, using fallback:', error.message);
    console.warn('⚠️ Error type:', error.constructor.name);
    console.warn('⚠️ Error stack:', error.stack);
    
    // Fallback to native Web Audio
    VoiceProcessor = class extends AudioWorkletProcessor {
        constructor() {
            super();
            this.port.onmessage = this.onMessage.bind(this);
            this.port.postMessage({type: 'ready', message: 'Fallback VoiceProcessor initialized'});
            console.log('✅ Fallback VoiceProcessor initialized');
            
            // Additional safety check
            if (!this.port) {
                console.error('❌ Port not available in fallback processor');
                throw new Error('AudioWorklet port not available');
            }
        }
        
        onMessage(event) {
            const { command, requestId, audioData } = event.data;
            
            if (command === 'processVoice') {
                try {
                    const versions = {
                        light: this.processBasic(audioData, 0.9),    // Light bone conduction
                        medium: this.processBasic(audioData, 0.7),   // Medium bone conduction
                        deep: this.processBasic(audioData, 0.5)      // Deep bone conduction
                    };
                    
                    this.port.postMessage({
                        requestId: requestId,
                        versions: versions
                    });
                    
                    console.log('✅ Fallback processing completed');
                } catch (error) {
                    console.error('❌ Fallback processing error:', error);
                    this.port.postMessage({
                        requestId: requestId,
                        error: error.message
                    });
                }
            }
        }
        
        processBasic(audioData, intensity = 1.0) {
            const result = new Float32Array(audioData.length);
            
            for (let i = 0; i < audioData.length; i++) {
                if (i === 0) {
                    result[i] = audioData[i] * intensity;
                } else {
                    result[i] = (audioData[i] + audioData[i-1]) * 0.5 * intensity;
                }
            }
            
            return result;
        }
        
        process(inputs, outputs) {
            return true;
        }
    };
    
    console.log('✅ Using Fallback VoiceProcessor');
}

registerProcessor('VoiceProcessor', VoiceProcessor); 