// Fallback processor using native Web Audio (no external dependencies)
// This works when Superpowered SDK CDN is not available

class VoiceProcessorFallback extends AudioWorkletProcessor {
    constructor() {
        super();
        this.port.onmessage = this.onMessage.bind(this);
        this.port.postMessage({type: 'ready', message: 'Fallback VoiceProcessor initialized'});
        console.log('✅ Fallback VoiceProcessor initialized');
    }
    
    onMessage(event) {
        const { command, requestId, audioData } = event.data;
        
        if (command === 'processVoice') {
            try {
                // Simple audio processing without Superpowered
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
        // Simple low-pass filter for bone conduction simulation
        const result = new Float32Array(audioData.length);
        
        for (let i = 0; i < audioData.length; i++) {
            if (i === 0) {
                result[i] = audioData[i] * intensity;
            } else {
                // Simple low-pass filter: average with previous sample
                result[i] = (audioData[i] + audioData[i-1]) * 0.5 * intensity;
            }
        }
        
        return result;
    }
    
    process(inputs, outputs) {
        // Real-time processing - just pass through for now
        return true;
    }
}

registerProcessor('VoiceProcessor', VoiceProcessorFallback); 