// Device-Aware Processing Module
class DeviceAwareProcessor {
    constructor() {
        this.deviceInfo = this.detectDevice();
        this.audioSettings = this.getOptimizedAudioSettings();
        this.processingSettings = this.getOptimizedProcessingSettings();
        
        console.log('Device-aware processor initialized:', this.deviceInfo);
    }

    detectDevice() {
        const userAgent = navigator.userAgent;
        const platform = navigator.platform;
        
        // Detect device type
        let deviceType = 'desktop';
        let devicePlatform = 'unknown';
        let isMobile = false;
        
        if (/Android/i.test(userAgent)) {
            deviceType = 'mobile';
            devicePlatform = 'Android';
            isMobile = true;
        } else if (/iPhone|iPad|iPod/i.test(userAgent)) {
            deviceType = 'mobile';
            devicePlatform = 'iOS';
            isMobile = true;
        } else if (/Macintosh/i.test(userAgent)) {
            deviceType = 'laptop';
            devicePlatform = 'Mac';
        } else if (/Windows/i.test(userAgent)) {
            deviceType = 'laptop';
            devicePlatform = 'Windows';
        } else if (/Linux/i.test(userAgent)) {
            deviceType = 'laptop';
            devicePlatform = 'Linux';
        }

        // Detect browser
        let browser = 'unknown';
        if (/Chrome/i.test(userAgent) && !/Edge/i.test(userAgent)) {
            browser = 'Chrome';
        } else if (/Firefox/i.test(userAgent)) {
            browser = 'Firefox';
        } else if (/Safari/i.test(userAgent) && !/Chrome/i.test(userAgent)) {
            browser = 'Safari';
        } else if (/Edge/i.test(userAgent)) {
            browser = 'Edge';
        }

        // Detect screen size
        const screenWidth = window.screen.width;
        const screenHeight = window.screen.height;
        const pixelRatio = window.devicePixelRatio || 1;

        // Detect audio capabilities
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const maxChannels = audioContext.destination.maxChannelCount;
        const sampleRate = audioContext.sampleRate;
        audioContext.close();

        return {
            type: deviceType,
            platform: devicePlatform,
            isMobile,
            browser,
            screenWidth,
            screenHeight,
            pixelRatio,
            maxChannels,
            sampleRate,
            userAgent: userAgent.substring(0, 100) // Truncated for privacy
        };
    }

    getOptimizedAudioSettings() {
        const settings = {
            sampleRate: 44100,
            channelCount: 1,
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: false
        };

        // Device-specific optimizations
        if (this.deviceInfo.isMobile) {
            // Mobile devices often have better built-in processing
            settings.echoCancellation = true;
            settings.noiseSuppression = true;
            settings.autoGainControl = false; // Preserve natural dynamics
            
            // iOS-specific optimizations
            if (this.deviceInfo.platform === 'iOS') {
                settings.sampleRate = 44100; // iOS prefers 44.1kHz
                settings.latencyHint = 'interactive';
            }
            
            // Android-specific optimizations
            if (this.deviceInfo.platform === 'Android') {
                settings.sampleRate = 44100;
                settings.latencyHint = 'balanced';
            }
        } else {
            // Desktop/laptop optimizations
            settings.echoCancellation = true;
            settings.noiseSuppression = false; // Desktop mics usually better quality
            settings.autoGainControl = false;
            settings.latencyHint = 'interactive';
        }

        return settings;
    }

    getOptimizedProcessingSettings() {
        const settings = {
            maxProcessingTime: 5000,
            qualityLevel: 'high',
            bufferSize: 2048,
            enableParallelProcessing: true,
            enableAdvancedFilters: true
        };

        if (this.deviceInfo.isMobile) {
            // Reduce processing complexity for mobile devices
            settings.maxProcessingTime = 3000; // 3 seconds max
            settings.qualityLevel = 'medium';
            settings.bufferSize = 1024;
            
            // Further optimize for older/slower mobile devices
            if (this.deviceInfo.screenWidth < 768 || this.deviceInfo.pixelRatio < 2) {
                settings.qualityLevel = 'basic';
                settings.enableAdvancedFilters = false;
                settings.maxProcessingTime = 2000;
            }
        } else {
            // Full quality for desktop
            settings.maxProcessingTime = 5000; // 5 seconds max
            settings.qualityLevel = 'high';
            settings.bufferSize = 2048;
            settings.enableAdvancedFilters = true;
        }

        return settings;
    }

    getDeviceAdjustments() {
        const adjustments = {
            pitchAdjustment: 0,
            eqAdjustment: 0,
            compressionAdjustment: 0,
            formantAdjustment: 0
        };

        if (this.deviceInfo.isMobile) {
            // Mobile devices typically have smaller speakers and different acoustics
            adjustments.pitchAdjustment = +10; // Mobile mics often need less aggressive processing
            adjustments.eqAdjustment = -5; // Reduce EQ intensity
            adjustments.compressionAdjustment = +5; // Slightly more compression for mobile playback
            
            if (this.deviceInfo.platform === 'iOS') {
                // iOS devices have good built-in audio processing
                adjustments.formantAdjustment = +5;
            } else if (this.deviceInfo.platform === 'Android') {
                // Android devices vary more in quality
                adjustments.formantAdjustment = 0;
                adjustments.eqAdjustment = -10;
            }
        } else {
            // Desktop/laptop adjustments
            adjustments.pitchAdjustment = -5; // Desktop mics may need more correction
            adjustments.eqAdjustment = +5; // Can handle more aggressive EQ
            adjustments.compressionAdjustment = 0; // Standard compression
            adjustments.formantAdjustment = 0; // Standard formant correction
        }

        return adjustments;
    }

    getRecordingConstraints() {
        const baseConstraints = {
            audio: {
                sampleRate: this.audioSettings.sampleRate,
                channelCount: this.audioSettings.channelCount,
                echoCancellation: this.audioSettings.echoCancellation,
                noiseSuppression: this.audioSettings.noiseSuppression,
                autoGainControl: this.audioSettings.autoGainControl
            }
        };

        // Add device-specific constraints
        if (this.audioSettings.latencyHint) {
            baseConstraints.audio.latencyHint = this.audioSettings.latencyHint;
        }

        // Browser-specific optimizations
        if (this.deviceInfo.browser === 'Safari') {
            // Safari has some quirks with audio constraints
            delete baseConstraints.audio.latencyHint;
        } else if (this.deviceInfo.browser === 'Firefox') {
            // Firefox handles some constraints differently
            baseConstraints.audio.mozNoiseSuppression = baseConstraints.audio.noiseSuppression;
            baseConstraints.audio.mozEchoCancellation = baseConstraints.audio.echoCancellation;
        }

        return baseConstraints;
    }

    adjustProcessingForDevice(processingConfig, version) {
        const adjustments = this.getDeviceAdjustments();
        const adjusted = { ...processingConfig };

        // Apply device-specific adjustments
        adjusted.pitchShiftCents += adjustments.pitchAdjustment;
        adjusted.formantCorrection += (adjustments.formantAdjustment / 100);
        
        // Adjust EQ based on device
        if (adjusted.eq) {
            adjusted.eq.low += adjustments.eqAdjustment / 10;
            adjusted.eq.mid += adjustments.eqAdjustment / 15;
            adjusted.eq.high += adjustments.eqAdjustment / 20;
        }

        // Ensure values stay within reasonable bounds
        adjusted.pitchShiftCents = Math.max(-300, Math.min(100, adjusted.pitchShiftCents));
        adjusted.formantCorrection = Math.max(0.5, Math.min(1.2, adjusted.formantCorrection));

        console.log(`Processing adjusted for ${this.deviceInfo.type} (${this.deviceInfo.platform}):`, adjusted);
        return adjusted;
    }

    getOptimizedUISettings() {
        const settings = {
            animationDuration: 300,
            enableHapticFeedback: false,
            touchTargetSize: 44,
            enableGestures: false,
            enableKeyboardShortcuts: true
        };

        if (this.deviceInfo.isMobile) {
            // Mobile UI optimizations
            settings.touchTargetSize = 48; // Larger touch targets
            settings.enableGestures = true;
            settings.enableKeyboardShortcuts = false;
            
            // Enable haptic feedback if supported
            if ('vibrate' in navigator) {
                settings.enableHapticFeedback = true;
            }
            
            // Reduce animations on slower devices
            if (this.deviceInfo.screenWidth < 768) {
                settings.animationDuration = 200;
            }
        } else {
            // Desktop UI optimizations
            settings.touchTargetSize = 32; // Smaller targets for mouse precision
            settings.enableGestures = false;
            settings.enableKeyboardShortcuts = true;
            settings.animationDuration = 300;
        }

        return settings;
    }

    getPerformanceProfile() {
        let profile = 'high';

        // Determine performance profile based on device characteristics
        if (this.deviceInfo.isMobile) {
            if (this.deviceInfo.screenWidth < 768 || this.deviceInfo.pixelRatio < 2) {
                profile = 'low';
            } else {
                profile = 'medium';
            }
        } else {
            // Desktop devices generally have better performance
            profile = 'high';
        }

        // Browser-specific adjustments
        if (this.deviceInfo.browser === 'Safari' && this.deviceInfo.isMobile) {
            // Safari on mobile can be more resource-constrained
            profile = profile === 'medium' ? 'low' : profile;
        }

        return {
            profile,
            enableParallelProcessing: profile !== 'low',
            enableAdvancedFilters: profile === 'high',
            maxConcurrentOperations: profile === 'high' ? 4 : profile === 'medium' ? 2 : 1
        };
    }

    logDeviceInfo() {
        // Log device information for analytics (anonymized)
        const logData = {
            deviceType: this.deviceInfo.type,
            platform: this.deviceInfo.platform,
            browser: this.deviceInfo.browser,
            screenSize: `${this.deviceInfo.screenWidth}x${this.deviceInfo.screenHeight}`,
            pixelRatio: this.deviceInfo.pixelRatio,
            audioChannels: this.deviceInfo.maxChannels,
            sampleRate: this.deviceInfo.sampleRate,
            performanceProfile: this.getPerformanceProfile().profile,
            timestamp: new Date().toISOString()
        };

        console.log('Device analytics:', logData);
        return logData;
    }

    // Method to update audio processor with device-aware settings
    configureAudioProcessor(audioProcessor) {
        if (!audioProcessor) return;

        // Apply device-specific settings to audio processor
        const performanceProfile = this.getPerformanceProfile();
        
        // Update processing configurations with device adjustments
        Object.keys(audioProcessor.processingConfigs).forEach(version => {
            audioProcessor.processingConfigs[version] = this.adjustProcessingForDevice(
                audioProcessor.processingConfigs[version], 
                version
            );
        });

        // Set performance-based options
        audioProcessor.enableParallelProcessing = performanceProfile.enableParallelProcessing;
        audioProcessor.enableAdvancedFilters = performanceProfile.enableAdvancedFilters;
        audioProcessor.maxConcurrentOperations = performanceProfile.maxConcurrentOperations;

        console.log('Audio processor configured for device:', this.deviceInfo.type);
    }

    // Method to update UI controller with device-aware settings
    configureUIController(uiController) {
        if (!uiController) return;

        const uiSettings = this.getOptimizedUISettings();
        
        // Apply UI settings
        uiController.animationDuration = uiSettings.animationDuration;
        uiController.enableHapticFeedback = uiSettings.enableHapticFeedback;
        uiController.touchTargetSize = uiSettings.touchTargetSize;
        uiController.enableGestures = uiSettings.enableGestures;
        uiController.enableKeyboardShortcuts = uiSettings.enableKeyboardShortcuts;

        console.log('UI controller configured for device:', this.deviceInfo.type);
    }
}

// Initialize global device-aware processor
window.deviceAwareProcessor = new DeviceAwareProcessor();

// Configure other modules when they're available
document.addEventListener('DOMContentLoaded', () => {
    // Configure audio processor
    if (window.audioProcessor) {
        window.deviceAwareProcessor.configureAudioProcessor(window.audioProcessor);
    }
    
    // Configure UI controller
    if (window.uiController) {
        window.deviceAwareProcessor.configureUIController(window.uiController);
    }
    
    // Log device info for analytics
    window.deviceAwareProcessor.logDeviceInfo();
});

