// voice-processor.js - CORRECTED implementation for Superpowered SDK v2.6.5
// Addresses setTimeout errors and proper buffer handling

import { SuperpoweredWebAudio } from '/static/superpowered/Superpowered.js';

class VoiceProcessor extends SuperpoweredWebAudio.AudioWorkletProcessor {
    constructor() {
        super();
        // DON'T initialize anything here - wait for onReady()
        this.isInitialized = false;
        this.processingMode = 'A';
        this.pendingRequests = new Map();
        this.bufferSize = 1024; // Larger buffer for voice processing
    }

    onReady() {
        try {
            console.log('🎵 VoiceProcessor onReady() called');
            
            // CORRECTED: Proper buffer allocation
            this.inputBuffer = new this.Superpowered.Float32Buffer(this.bufferSize);
            this.outputBuffer = new this.Superpowered.Float32Buffer(this.bufferSize);
            this.workBuffer = new this.Superpowered.Float32Buffer(this.bufferSize);
            
            // CORRECTED: Proper API names and parameters for v2.7.2
            this.pitchShift = new this.Superpowered.PitchShift(this.samplerate, this.bufferSize);
            this.filter = new this.Superpowered.Filter(this.Superpowered.Filter_Resonant_Lowpass, this.samplerate);
            this.compressor = new this.Superpowered.Compressor(this.samplerate);
            
            // Configure for bone conduction
            this.setupProcessors();
            
            this.isInitialized = true;
            this.sendMessageToMainScope({
                type: 'ready',
                message: 'VoiceProcessor initialized successfully'
            });
            
            console.log('✅ VoiceProcessor initialized successfully');
            
        } catch (error) {
            console.error('❌ VoiceProcessor initialization failed:', error);
            this.sendMessageToMainScope({
                type: 'error',
                error: error.message
            });
        }
    }

    setupProcessors() {
        // Configure pitch shift for bone conduction
        this.pitchShift.pitchShiftCents = -100; // Slight pitch down
        
        // Configure filter for bone conduction frequency response
        this.filter.frequency = 1000;
        this.filter.resonance = 0.7;
        
        // Configure compressor for voice clarity
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

            // Process audio and generate versions
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

            // Process in chunks to handle large audio files
            for (let offset = 0; offset < length; offset += chunkSize) {
                const currentChunkSize = Math.min(chunkSize, length - offset);
                const chunk = audioData.slice(offset, offset + currentChunkSize);
                
                // Process each version
                result.light.set(this.processChunk(chunk, 'light'), offset);
                result.medium.set(this.processChunk(chunk, 'medium'), offset);
                result.deep.set(this.processChunk(chunk, 'deep'), offset);
            }

            return result;
        }

        processChunk(chunk, mode) {
            const chunkSize = chunk.length;
            
            // CORRECTED: Proper way to copy data to Superpowered buffers
            // Convert JS array to Float32Array first
            const inputArray = new Float32Array(chunk);
            
            // Copy to Superpowered buffer using proper API
            this.inputBuffer.copyFrom(inputArray, 0, chunkSize);
            
            // Apply processing based on mode
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
            
            // CORRECTED: Copy back from Superpowered buffer
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

    // IMPORTANT: Real-time processing method for AudioWorklet
    processAudio(inputBuffer, outputBuffer, buffersize) {
        if (!this.isInitialized) {
            // Output silence
            for (let i = 0; i < buffersize; i++) {
                outputBuffer.pointer[i] = 0;
            }
            return;
        }
        
        // Real-time processing would go here
        // For now, just pass through
        this.Superpowered.memoryCopy(
            outputBuffer.pointer,
            inputBuffer.pointer,
            buffersize * 4
        );
    }

    onDestruct() {
        console.log('🧹 VoiceProcessor cleanup...');
        
        // Clean up buffers
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
        
        // Clean up processors
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
}

registerProcessor('VoiceProcessor', VoiceProcessor); 