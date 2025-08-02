// Audio Recording Module
class AudioRecorder {
    constructor() {
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.isRecording = false;
        this.stream = null;
        this.audioContext = null;
        this.analyser = null;
        
        this.constraints = {
            audio: {
                sampleRate: 44100,
                channelCount: 1,
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            }
        };
    }

    async initialize() {
        try {
            // Check if getUserMedia is supported
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                throw new Error('getUserMedia not supported in this browser');
            }

            // Request microphone permission with fallbacks
            let stream;
            try {
                stream = await navigator.mediaDevices.getUserMedia(this.constraints);
            } catch (permissionError) {
                console.warn('Primary audio constraints failed, trying fallback:', permissionError);
                
                // Try with more basic constraints
                const fallbackConstraints = {
                    audio: {
                        echoCancellation: false,
                        noiseSuppression: false,
                        autoGainControl: false
                    }
                };
                
                try {
                    stream = await navigator.mediaDevices.getUserMedia(fallbackConstraints);
                } catch (fallbackError) {
                    console.error('Fallback audio constraints also failed:', fallbackError);
                    throw new Error(`Microphone access failed: ${fallbackError.message}`);
                }
            }
            
            this.stream = stream;
            
            // Create audio context for analysis
            try {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
                this.analyser = this.audioContext.createAnalyser();
                
                const source = this.audioContext.createMediaStreamSource(this.stream);
                source.connect(this.analyser);
                
                this.analyser.fftSize = 256;
            } catch (audioContextError) {
                console.warn('Audio context creation failed, continuing without analysis:', audioContextError);
                // Continue without audio analysis - recording will still work
            }
            
            console.log('Audio recorder initialized successfully');
            return true;
        } catch (error) {
            console.error('Failed to initialize audio recorder:', error);
            
            // Provide more specific error messages
            if (error.name === 'NotAllowedError') {
                throw new Error('Microphone permission denied. Please allow microphone access and try again.');
            } else if (error.name === 'NotFoundError') {
                throw new Error('No microphone found. Please connect a microphone and try again.');
            } else if (error.name === 'NotSupportedError') {
                throw new Error('Microphone not supported in this browser. Please try a different browser.');
            } else {
                throw new Error(`Microphone access failed: ${error.message}`);
            }
        }
    }

    async startRecording() {
        if (this.isRecording) {
            console.warn('Recording already in progress');
            return;
        }

        try {
            // Initialize if not already done
            if (!this.stream) {
                console.log('Initializing audio recorder...');
                await this.initialize();
            }

            // Verify stream is still active
            if (!this.stream || !this.stream.active) {
                console.log('Stream inactive, reinitializing...');
                await this.initialize();
            }

            // Reset audio chunks
            this.audioChunks = [];

            // Create MediaRecorder with error handling
            const options = {
                mimeType: this.getSupportedMimeType(),
                audioBitsPerSecond: 128000
            };

            console.log('Creating MediaRecorder with options:', options);

            this.mediaRecorder = new MediaRecorder(this.stream, options);

            // Set up event handlers
            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.audioChunks.push(event.data);
                    console.log('Audio chunk received, size:', event.data.size);
                }
            };

            this.mediaRecorder.onstop = () => {
                console.log('Recording stopped, total chunks:', this.audioChunks.length);
            };

            this.mediaRecorder.onerror = (event) => {
                console.error('MediaRecorder error:', event.error);
                this.isRecording = false;
            };

            // Start recording
            this.mediaRecorder.start(100); // Collect data every 100ms
            this.isRecording = true;

            console.log('Recording started successfully');
            return Promise.resolve();

        } catch (error) {
            console.error('Failed to start recording:', error);
            this.isRecording = false;
            throw error;
        }
    }

    async stopRecording() {
        if (!this.isRecording || !this.mediaRecorder) {
            console.warn('No recording in progress');
            return null;
        }

        return new Promise((resolve, reject) => {
            // Set timeout to prevent hanging
            const timeout = setTimeout(() => {
                reject(new Error('Recording stop timeout'));
            }, 5000);

            this.mediaRecorder.onstop = () => {
                try {
                    clearTimeout(timeout);
                    
                    // Validate that we have audio data
                    if (this.audioChunks.length === 0) {
                        reject(new Error('No audio data recorded'));
                        return;
                    }

                    // Create blob from chunks
                    const audioBlob = new Blob(this.audioChunks, {
                        type: this.getSupportedMimeType()
                    });

                    // Validate blob size
                    if (audioBlob.size === 0) {
                        reject(new Error('Recording failed - no audio data captured'));
                        return;
                    }

                    this.isRecording = false;
                    this.audioChunks = [];

                    console.log('Recording completed successfully, blob size:', audioBlob.size);
                    resolve(audioBlob);
                } catch (error) {
                    clearTimeout(timeout);
                    reject(error);
                }
            };

            this.mediaRecorder.onerror = (event) => {
                clearTimeout(timeout);
                reject(new Error(`Recording error: ${event.error}`));
            };

            try {
                this.mediaRecorder.stop();
            } catch (error) {
                clearTimeout(timeout);
                reject(error);
            }
        });
    }

    getSupportedMimeType() {
        const types = [
            'audio/webm;codecs=opus',
            'audio/webm',
            'audio/mp4',
            'audio/ogg;codecs=opus',
            'audio/wav'
        ];

        for (const type of types) {
            if (MediaRecorder.isTypeSupported(type)) {
                return type;
            }
        }

        return 'audio/webm'; // Fallback
    }

    async convertToWav(audioBlob) {
        try {
            // Convert blob to array buffer
            const arrayBuffer = await audioBlob.arrayBuffer();
            
            // Decode audio data
            const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
            
            // Convert to WAV format
            const wavBuffer = this.audioBufferToWav(audioBuffer);
            
            return new Blob([wavBuffer], { type: 'audio/wav' });
        } catch (error) {
            console.error('Failed to convert to WAV:', error);
            throw error;
        }
    }

    audioBufferToWav(buffer) {
        const length = buffer.length;
        const sampleRate = buffer.sampleRate;
        const numberOfChannels = buffer.numberOfChannels;
        
        // Create WAV header
        const arrayBuffer = new ArrayBuffer(44 + length * 2);
        const view = new DataView(arrayBuffer);
        
        // WAV header
        const writeString = (offset, string) => {
            for (let i = 0; i < string.length; i++) {
                view.setUint8(offset + i, string.charCodeAt(i));
            }
        };
        
        writeString(0, 'RIFF');
        view.setUint32(4, 36 + length * 2, true);
        writeString(8, 'WAVE');
        writeString(12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true);
        view.setUint16(22, numberOfChannels, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * numberOfChannels * 2, true);
        view.setUint16(32, numberOfChannels * 2, true);
        view.setUint16(34, 16, true);
        writeString(36, 'data');
        view.setUint32(40, length * 2, true);
        
        // Convert audio data
        const channelData = buffer.getChannelData(0);
        let offset = 44;
        for (let i = 0; i < length; i++) {
            const sample = Math.max(-1, Math.min(1, channelData[i]));
            view.setInt16(offset, sample * 0x7FFF, true);
            offset += 2;
        }
        
        return arrayBuffer;
    }

    async blobToBase64(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                const base64 = reader.result.split(',')[1];
                resolve(base64);
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }

    getAudioLevel() {
        if (!this.analyser) return 0;

        const bufferLength = this.analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        this.analyser.getByteFrequencyData(dataArray);

        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
            sum += dataArray[i];
        }

        return sum / bufferLength / 255; // Normalize to 0-1
    }

    async checkMicrophonePermission() {
        try {
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                return {
                    supported: false,
                    message: 'Microphone access not supported in this browser'
                };
            }

            // Try to get permission without actually starting a stream
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            
            // Immediately stop the test stream
            stream.getTracks().forEach(track => track.stop());
            
            return {
                supported: true,
                permitted: true,
                message: 'Microphone access granted'
            };
        } catch (error) {
            return {
                supported: true,
                permitted: false,
                message: `Microphone access denied: ${error.message}`
            };
        }
    }

    cleanup() {
        try {
            // Stop recording if active
            if (this.isRecording && this.mediaRecorder) {
                this.mediaRecorder.stop();
                this.isRecording = false;
            }

            // Stop all tracks in the stream
            if (this.stream) {
                this.stream.getTracks().forEach(track => {
                    track.stop();
                });
                this.stream = null;
            }

            // Close audio context
            if (this.audioContext && this.audioContext.state !== 'closed') {
                this.audioContext.close();
                this.audioContext = null;
            }

            // Clear arrays
            this.audioChunks = [];
            this.analyser = null;

            console.log('Audio recorder cleaned up successfully');
        } catch (error) {
            console.error('Error during cleanup:', error);
        }
    }

    // Device detection for optimization
    detectDevice() {
        const userAgent = navigator.userAgent.toLowerCase();
        const isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/.test(userAgent);
        const isIOS = /ipad|iphone|ipod/.test(userAgent);
        const isAndroid = /android/.test(userAgent);

        return {
            isMobile,
            isIOS,
            isAndroid,
            isDesktop: !isMobile
        };
    }

    // Get optimized constraints based on device
    getOptimizedConstraints() {
        const device = this.detectDevice();
        
        if (device.isIOS) {
            return {
                audio: {
                    sampleRate: 44100,
                    channelCount: 1,
                    echoCancellation: true,
                    noiseSuppression: false, // iOS handles this well natively
                    autoGainControl: true
                }
            };
        } else if (device.isAndroid) {
            return {
                audio: {
                    sampleRate: 44100,
                    channelCount: 1,
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            };
        } else {
            // Desktop
            return {
                audio: {
                    sampleRate: 44100,
                    channelCount: 1,
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: false // Better control on desktop
                }
            };
        }
    }
}

// Initialize global audio recorder
window.audioRecorder = new AudioRecorder();

// Handle page unload
window.addEventListener('beforeunload', () => {
    if (window.audioRecorder) {
        window.audioRecorder.cleanup();
    }
});

