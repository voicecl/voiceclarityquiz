// User Registration and Data Management Module
class UserManager {
    constructor() {
        this.currentUser = null;
        this.sessionId = null;
        this.deviceInfo = null;
        this.versionOrder = null;
        this.responses = [];
        this.storageKey = 'voice_quiz_user_data';
        this.participantsKey = 'voice_quiz_participants';
        this.startTime = null;
        
        // Initialize device detection
        this.detectDevice();
        
        // Generate session ID
        this.sessionId = this.generateSessionId();
        
        // Initialize storage
        this.initializeStorage();
        
        // Initialize user manager
        this.initialize();
    }

    detectDevice() {
        const userAgent = navigator.userAgent;
        
        if (/Android/i.test(userAgent)) {
            this.deviceInfo = { type: 'mobile', platform: 'Android' };
        } else if (/iPhone|iPad|iPod/i.test(userAgent)) {
            this.deviceInfo = { type: 'mobile', platform: 'iOS' };
        } else if (/Macintosh/i.test(userAgent)) {
            this.deviceInfo = { type: 'laptop', platform: 'Mac' };
        } else if (/Windows/i.test(userAgent)) {
            this.deviceInfo = { type: 'laptop', platform: 'Windows' };
        } else {
            this.deviceInfo = { type: 'unknown', platform: 'unknown' };
        }
        
        console.log('Device detected:', this.deviceInfo);
    }

    generateSessionId() {
        // Generate unique session identifier
        const timestamp = Date.now();
        const randomString = Math.random().toString(36).substring(2, 15);
        return `session_${timestamp}_${randomString}`;
    }

    initializeStorage() {
        // Initialize localStorage for temporary data
        if (!localStorage.getItem('voiceQuiz_sessions')) {
            localStorage.setItem('voiceQuiz_sessions', JSON.stringify({}));
        }
    }

    initialize() {
        // Load existing user data if available
        this.loadUserData();
        console.log('User Manager initialized');
    }

    async registerUser(userData) {
        try {
            // Validate user data
            if (!this.validateUserData(userData)) {
                return {
                    success: false,
                    message: 'Please provide all required information'
                };
            }

            // Check if user has already participated
            const participants = this.getParticipants();
            const userEmail = userData.email.toLowerCase();
            
            if (participants.includes(userEmail)) {
                return {
                    success: false,
                    blocked: true,
                    message: 'You have already participated in this study'
                };
            }

            // Initialize version order randomization
            this.initializeVersionOrder();

            // Set start time when user registers
            this.startTime = Date.now();

            // Create user object
            const user = {
                id: this.generateUserId(),
                firstName: userData.firstName,
                lastName: userData.lastName,
                email: userEmail,
                consent: userData.consent,
                registrationDate: new Date().toISOString(),
                deviceInfo: this.getDeviceInfo(),
                studyProgress: {
                    currentQuestion: 1,
                    totalQuestions: 7,
                    responses: [],
                    startTime: new Date().toISOString()
                }
            };

            // Save user data
            this.currentUser = user;
            this.saveUserData();
            this.addParticipant(userEmail);

            console.log('User registered successfully:', user);
            return {
                success: true,
                user: user
            };

        } catch (error) {
            console.error('Registration failed:', error);
            return {
                success: false,
                message: 'Registration failed. Please try again.'
            };
        }
    }

    initializeVersionOrder() {
        // For counter-balanced trials, we use a fixed mapping
        // This ensures consistent version assignment across all trials
        this.versionOrder = {
            A: 'raw',     // Raw version is always A
            B: 'light',   // Light processing is B
            C: 'medium',  // Medium processing is C
            D: 'deep'     // Deep processing is D
        };
        
        console.log('Counter-balanced version order initialized:', this.versionOrder);
    }

    validateUserData(userData) {
        return userData.firstName && 
               userData.lastName && 
               userData.email && 
               userData.consent &&
               this.isValidEmail(userData.email);
    }

    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    generateUserId() {
        return 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    getDeviceInfo() {
        return {
            userAgent: navigator.userAgent,
            platform: navigator.platform,
            language: navigator.language,
            screenWidth: window.screen.width,
            screenHeight: window.screen.height,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
        };
    }

    saveUserData() {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(this.currentUser));
        } catch (error) {
            console.error('Failed to save user data:', error);
        }
    }

    loadUserData() {
        try {
            const data = localStorage.getItem(this.storageKey);
            if (data) {
                this.currentUser = JSON.parse(data);
                console.log('User data loaded:', this.currentUser);
            }
        } catch (error) {
            console.error('Failed to load user data:', error);
        }
    }

    getParticipants() {
        try {
            const data = localStorage.getItem(this.participantsKey);
            return data ? JSON.parse(data) : [];
        } catch (error) {
            console.error('Failed to load participants:', error);
            return [];
        }
    }

    addParticipant(email) {
        try {
            const participants = this.getParticipants();
            if (!participants.includes(email)) {
                participants.push(email);
                localStorage.setItem(this.participantsKey, JSON.stringify(participants));
            }
        } catch (error) {
            console.error('Failed to add participant:', error);
        }
    }

    updateStudyProgress(progress) {
        if (this.currentUser) {
            this.currentUser.studyProgress = {
                ...this.currentUser.studyProgress,
                ...progress
            };
            this.saveUserData();
        }
    }

    addResponse(questionNumber, response) {
        if (this.currentUser) {
            if (!this.currentUser.studyProgress.responses) {
                this.currentUser.studyProgress.responses = [];
            }
            
            this.currentUser.studyProgress.responses[questionNumber - 1] = {
                questionNumber,
                selectedVersion: response.selectedVersion,
                feedback: response.feedback,
                timestamp: new Date().toISOString()
            };
            
            this.saveUserData();
        }
    }

    async completeStudy() {
        if (this.currentUser) {
            this.currentUser.studyProgress.completed = true;
            this.currentUser.studyProgress.completionDate = new Date().toISOString();
            
            // Calculate total duration
            const totalDuration = this.startTime ? (Date.now() - this.startTime) / 1000 : 0;
            this.currentUser.studyProgress.totalDuration = Math.round(totalDuration);
            
            this.saveUserData();
            
            // Clean up voice recordings after completion
            this.cleanupRecordings();
            
            console.log('Study completed for user:', this.currentUser.id);
        }
    }

    cleanupRecordings() {
        // Remove any stored audio data
        try {
            const keys = Object.keys(localStorage);
            keys.forEach(key => {
                if (key.includes('audio') || key.includes('recording')) {
                    localStorage.removeItem(key);
                }
            });
        } catch (error) {
            console.error('Failed to cleanup recordings:', error);
        }
    }

    getUserData() {
        return this.currentUser;
    }

    isUserRegistered() {
        return !!this.currentUser;
    }

    isStudyCompleted() {
        return this.currentUser && this.currentUser.studyProgress.completed;
    }

    getStudyProgress() {
        return this.currentUser ? this.currentUser.studyProgress : null;
    }

    // Export user data for research purposes
    exportUserData() {
        if (!this.currentUser) {
            return null;
        }

        // Create anonymized export (remove personal identifiers)
        const exportData = {
            userId: this.currentUser.id,
            registrationDate: this.currentUser.registrationDate,
            deviceInfo: this.currentUser.deviceInfo,
            studyProgress: {
                totalQuestions: this.currentUser.studyProgress.totalQuestions,
                responses: this.currentUser.studyProgress.responses,
                completionDate: this.currentUser.studyProgress.completionDate
            }
        };

        return exportData;
    }

    // Download user data as JSON file
    downloadUserData() {
        const data = this.exportUserData();
        if (!data) {
            console.error('No user data to download');
            return;
        }

        const blob = new Blob([JSON.stringify(data, null, 2)], {
            type: 'application/json'
        });

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `voice_quiz_data_${this.currentUser.id}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // Reset user data (for testing purposes)
    resetUserData() {
        this.currentUser = null;
        localStorage.removeItem(this.storageKey);
        console.log('User data reset');
    }

    // Get study statistics
    getStudyStats() {
        const participants = this.getParticipants();
        const totalParticipants = participants.length;
        
        // Calculate completion rate (if we had more data)
        const completionRate = this.isStudyCompleted() ? 100 : 0;
        
        return {
            totalParticipants,
            completionRate,
            currentUser: this.currentUser ? {
                id: this.currentUser.id,
                progress: this.currentUser.studyProgress
            } : null
        };
    }

    async recordResponse(questionId, selectedChoice, trialType, responseTime, feedback = {}, isCatch = false) {
        try {
            // 🔍 DEBUG: Verify we're recording the correct actual processing type
            console.log(`🔍 recordResponse debug for question ${questionId + 1}:`, {
                selectedChoice,
                trialType, // This should now be the actual processing type (raw, light, medium, deep)
                isCatch,
(index):64 cdn.tailwindcss.com should not be used in production. To use Tailwind CSS in production, install it as a PostCSS plugin or use the Tailwind CLI: https://tailwindcss.com/docs/installation
(anonymous) @ (index):64
user-manager.js:41 Device detected: Objectplatform: "Windows"type: "laptop"[[Prototype]]: Object
user-manager.js:183 User data loaded: Objectconsent: truedeviceInfo: {userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWeb…KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36', platform: 'Win32', language: 'en-US', screenWidth: 1536, screenHeight: 864, …}email: "mmw@yahoo.com"firstName: "mmmmm"id: "user_1754261322873_8kvg6xsle"lastName: "mmmmmmm"registrationDate: "2025-08-03T22:48:42.873Z"studyProgress: {currentQuestion: 1, totalQuestions: 7, responses: Array(0), startTime: '2025-08-03T22:48:42.902Z', completed: true, …}[[Prototype]]: Object
user-manager.js:61 User Manager initialized
device-aware.js:8 Device-aware processor initialized: Object
audio-format-fix.js:111 🎯 Audio format fixes loaded!
audio-format-fix.js:112 💡 Try: fixProcessedAudioFormats() - to convert all versions
audio-format-fix.js:113 💡 Try: window.voiceQuizApp.playVersionWebAudio("B") - to test Web Audio API playback
device-aware.js:309 Device analytics: Object
app-simple.js:256 🎯 Generating counter-balanced trial set...
app-simple.js:319 ✅ Generated trial set: Object
app-simple.js:346 Counter-balanced versionOrder initialized: Object
app-simple.js:353 AudioWorklet support: true
app-simple.js:354 WebAssembly support: true
app-simple.js:2815 🎯 Voice Quiz App initialized with version mapping support
app-simple.js:2816 💡 Use window.debugVersionMapping() to check version mapping state
content.js:1 [MindStudio][Content] Initializing content script
app-simple.js:359 Microphone permission check: Object
app-simple.js:376 AudioProcessor available (will create instance when needed)
app-simple.js:387 Voice Quiz App initialized successfully
user-manager.js:139 Counter-balanced version order initialized: {A: 'raw', B: 'light', C: 'medium', D: 'deep'}
user-manager.js:114 User registered successfully: {id: 'user_1754263429449_tgyt7is50', firstName: 'da', lastName: 'da', email: 'dadadadadada@yahoo.com', consent: true, …}
app-simple.js:575 User registered successfully
app-simple.js:639 📝 showRecordingPage() called for question: 0
app-simple.js:1710 🔇 Stopping all audio playback...
app-simple.js:1769 ✅ All audio stopped and UI reset
app-simple.js:2595 📊 Memory Status [Start of Question]:
app-simple.js:2596    - Tracked URLs: 0
app-simple.js:2597    - Tracked Blobs: 0
app-simple.js:2598    - Current Recording: No
app-simple.js:2599    - Processed Versions: 0
app-simple.js:2600    - Currently Playing: No
app-simple.js:2601    - Current Audio URL: No
app-simple.js:2605    - Memory Usage: 7MB / 8MB
app-simple.js:2608    - Question: 1/10
app-simple.js:726 🎙️ Starting recording...
audio-recorder.js:96 Initializing audio recorder...
audio-recorder.js:69 Audio recorder initialized successfully
audio-recorder.js:115 Creating MediaRecorder with options: {mimeType: 'audio/webm;codecs=opus', audioBitsPerSecond: 128000}
audio-recorder.js:140 Recording started successfully
app-simple.js:741 ✅ Recording started successfully
audio-recorder.js:123 Audio chunk received, size: 1128
audio-recorder.js:123 Audio chunk received, size: 1932
audio-recorder.js:123 Audio chunk received, size: 1932
audio-recorder.js:123 Audio chunk received, size: 1932
audio-recorder.js:123 Audio chunk received, size: 1932
audio-recorder.js:123 Audio chunk received, size: 1932
audio-recorder.js:123 Audio chunk received, size: 1932
audio-recorder.js:123 Audio chunk received, size: 1932
audio-recorder.js:123 Audio chunk received, size: 1932
audio-recorder.js:123 Audio chunk received, size: 1932
audio-recorder.js:123 Audio chunk received, size: 1932
audio-recorder.js:123 Audio chunk received, size: 1932
audio-recorder.js:123 Audio chunk received, size: 1932
audio-recorder.js:123 Audio chunk received, size: 1932
audio-recorder.js:123 Audio chunk received, size: 1932
audio-recorder.js:123 Audio chunk received, size: 1932
audio-recorder.js:123 Audio chunk received, size: 1932
app-simple.js:758 ⏹️ Stopping recording...
audio-recorder.js:123 Audio chunk received, size: 965
audio-recorder.js:186 Recording completed successfully, blob size: 33005
app-simple.js:770 ✅ Recording stopped successfully
app-simple.js:884 🔄 processRecording() started for question: 0
app-simple.js:896 Creating AudioProcessor instance for processing...
app-simple.js:902 Initializing AudioProcessor for processing...
audio-processor.js:20 🎵 Initializing AudioProcessor...
audio-processor.js:25 ✅ AudioContext created with sample rate: 48000
audio-processor.js:29 🎵 Loading Superpowered SDK...
audio-processor.js:31 ✅ Superpowered SDK loaded
Superpowered.js:434 WASM memory 874534804112: 512 kb stack, 883 kb heap, 2 mb total.
audio-processor.js:38 ✅ Superpowered WebAssembly initialized
audio-processor.js:45 ✅ Superpowered WebAudio manager created
audio-processor.js:48 🎵 Creating AudioWorklet with corrected API...
Superpowered.js:434 WASM memory 1361694113990: 512 kb stack, 883 kb heap, 2 mb total.
voice-processor-worklet.js:16 🔍 Superpowered diagnostic: {available: true, version: 'version unknown', sampleRate: 48000}
voice-processor-worklet.js:37 ✅ Superpowered AudioWorklet initialized successfully
audio-processor.js:75 📨 Worklet message received: {event: 'ready'}
audio-processor.js:78 🎵 VoiceProcessor worklet ready
audio-processor.js:63 ✅ AudioWorklet created (not connected to destination for offline processing)
audio-processor.js:65 ✅ AudioProcessor initialized successfully with Superpowered 2.7.x
app-simple.js:905 AudioProcessor initialized with AudioWorklet
app-simple.js:918 Using AudioWorklet processing
audio-processor.js:102 🎵 Processing audio with Superpowered AudioWorklet
voice-processor-worklet.js:128 🔍 Original input energy: 5462.819686
voice-processor-worklet.js:133 🔧 Raw version created: {length: 97920, energy: '5462.819686', isIdenticalToInput: true}
voice-processor-worklet.js:144 🔍 Raw version check: {rawEnergy: '5462.819686', originalEnergy: '5462.819686', energyMatch: true, isIdentical: true, rawLength: 97920, …}
voice-processor-worklet.js:160 🔧 Skipping raw processing - keeping pristine copy
voice-processor-worklet.js:165 [light] params: {"hpFreq":300,"lpFreq":1200,"shelfLow":{"freq":500,"gain":3,"q":1},"shelfHigh":{"freq":2000,"gain":-3,"q":1},"pitchCents":-200,"formant":1,"comp":{"ratio":1.5,"threshold":-12,"knee":3},"notch":null,"vibro":null}
voice-processor-worklet.js:177 [light] energy ▶ input: 5462.819686
voice-processor-worklet.js:52 Worklet error: TypeError: ps.enable is not a function
    at VoiceProcessor._makeVersions (voice-processor-worklet.js:188:10)
    at VoiceProcessor.onMessageFromMainScope (voice-processor-worklet.js:46:31)
    at SuperpoweredAudioWorkletProcessor.port.onmessage (Superpowered.js:687:29)
onMessageFromMainScope @ voice-processor-worklet.js:52
SuperpoweredAudioWorkletProcessor.port.onmessage @ Superpowered.js:687
audio-processor.js:75 📨 Worklet message received: {requestId: 1754263438683.73, error: 'ps.enable is not a function'}
app-simple.js:963 Processing error: Error: ps.enable is not a function
    at AudioProcessor.handleWorkletMessage (audio-processor.js:88:16)
    at audio-processor.js:54:16
    at node.port.onmessage (Superpowered.js:664:24)
processRecording @ app-simple.js:963
await in processRecording
stopRecording @ app-simple.js:773
await in stopRecording
toggleRecording @ app-simple.js:700
(anonymous) @ app-simple.js:417
app-simple.js:2136 App Error: Failed to process audio. Please try recording again.
showError @ app-simple.js:2136
processRecording @ app-simple.js:964
await in processRecording
stopRecording @ app-simple.js:773
await in stopRecording
toggleRecording @ app-simple.js:700
(anonymous) @ app-simple.js:417
app-simple.js:968 🔄 processRecording() completed for question: 0
            });
            
            const response = {
                userEmail: this.currentUser.email,
                sessionId: this.sessionId,
                questionId: questionId,
                selectedChoice: selectedChoice,         // 'left' or 'right'
                trialType: trialType,                   // 🔧 FIXED: Now contains actual processing type (raw, light, medium, deep)
                isCatch: isCatch,                       // Whether this was a catch trial
                responseTime: responseTime,             // Time to make decision
                feedback: feedback,                     // Tags and text feedback
                timestamp: new Date().toISOString()
            };

            this.responses.push(response);

            // Update stored session data
            const sessions = JSON.parse(localStorage.getItem('voiceQuiz_sessions') || '{}');
            if (sessions[this.sessionId]) {
                sessions[this.sessionId].responses = this.responses;
                localStorage.setItem('voiceQuiz_sessions', JSON.stringify(sessions));
            }

            console.log('✅ Response recorded with correct actual processing type:', response);
            return response;

        } catch (error) {
            console.error('Failed to record response:', error);
            throw error;
        }
    }

    async deleteVoiceData() {
        try {
            // Delete any temporary voice recordings from memory/storage
            // This ensures compliance with privacy requirements
            
            // Clear any audio blobs from memory
            if (window.currentRecordings) {
                window.currentRecordings = null;
            }
            
            if (window.processedVersions) {
                window.processedVersions = null;
            }

            // Force garbage collection if available
            if (window.gc) {
                window.gc();
            }

            console.log('Voice data deleted for session:', this.sessionId);

        } catch (error) {
            console.error('Error deleting voice data:', error);
        }
    }

    getAnalytics() {
        // Generate analytics from responses
        const preferenceCounts = { light: 0, medium: 0, deep: 0 };
        const catchTrials = { passed: 0, failed: 0 };
        const feedbackCounts = {};

        this.responses.forEach(response => {
            if (response.isCatch) {
                // For catch trials, 'right' choice means they failed (raw vs raw)
                if (response.selectedChoice === 'right') {
                    catchTrials.failed++;
                } else {
                    catchTrials.passed++;
                }
            } else {
                // For real trials, 'right' choice means they preferred the processed version
                if (response.selectedChoice === 'right') {
                    preferenceCounts[response.trialType]++;
                }
            }

            // Count feedback tags
            if (response.feedback.tags) {
                response.feedback.tags.forEach(tag => {
                    feedbackCounts[tag] = (feedbackCounts[tag] || 0) + 1;
                });
            }
        });

        // Find most preferred variant
        const mostPreferred = Object.keys(preferenceCounts).reduce((a, b) => 
            preferenceCounts[a] > preferenceCounts[b] ? a : b
        );

        // Find top feedback reasons
        const topReasons = Object.entries(feedbackCounts)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 3)
            .map(([tag]) => tag);

        return {
            mostPreferred,
            preferenceCounts,
            catchTrials,
            topReasons,
            totalResponses: this.responses.length,
            averageResponseTime: this.responses.reduce((sum, r) => sum + r.responseTime, 0) / this.responses.length
        };
    }

    exportResults() {
        // Export user results for download
        const analytics = this.getAnalytics();
        
        const exportData = {
            user: {
                name: `${this.currentUser.firstName} ${this.currentUser.lastName}`,
                email: this.currentUser.email,
                completedAt: new Date().toISOString()
            },
            results: {
                preferredVoiceSetting: analytics.mostPreferred,
                versionBreakdown: analytics.versionCounts,
                topReasons: analytics.topReasons,
                averageDecisionTime: `${analytics.averageResponseTime.toFixed(1)} seconds`
            },
            deviceInfo: this.deviceInfo,
            sessionId: this.sessionId
        };

        return exportData;
    }

    // Data deletion endpoint (GDPR compliance)
    async deleteAllUserData(email) {
        try {
            const sessions = JSON.parse(localStorage.getItem('voiceQuiz_sessions') || '{}');
            
            // Find and delete all sessions for this email
            for (const sessionId in sessions) {
                const session = sessions[sessionId];
                if (session.user && session.user.email === email.toLowerCase()) {
                    delete sessions[sessionId];
                }
            }

            localStorage.setItem('voiceQuiz_sessions', JSON.stringify(sessions));
            
            console.log('All data deleted for user:', email);
            return { success: true, message: "All your data has been deleted." };

        } catch (error) {
            console.error('Failed to delete user data:', error);
            return { success: false, message: "Failed to delete data." };
        }
    }

    // Session cleanup (auto-expire old sessions)
    cleanupExpiredSessions() {
        try {
            const sessions = JSON.parse(localStorage.getItem('voiceQuiz_sessions') || '{}');
            const now = Date.now();
            const SESSION_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours

            let cleaned = false;
            for (const sessionId in sessions) {
                const session = sessions[sessionId];
                const sessionTime = new Date(session.startedAt).getTime();
                
                if (now - sessionTime > SESSION_EXPIRY && !session.completed) {
                    delete sessions[sessionId];
                    cleaned = true;
                }
            }

            if (cleaned) {
                localStorage.setItem('voiceQuiz_sessions', JSON.stringify(sessions));
                console.log('Expired sessions cleaned up');
            }

        } catch (error) {
            console.error('Error cleaning up sessions:', error);
        }
    }

    getAllResponses() {
        return this.responses.map((response, index) => ({
            questionId: index,
            questionText: window.voiceQuizApp?.questions?.[index]?.text || `Question ${index + 1}`,
            selectedVersion: response.selectedVersion, // A, B, C, or D
            actualProcessingType: response.trialType, // 🔧 FIXED: Use trialType which now contains the actual processing type
            selectionLatency: response.selectionLatency || 0, // Time between audio end and selection
            playbackTimes: response.playbackTimes || { A: 0, B: 0, C: 0, D: 0 }, // Duration each version was played
            replayCounts: response.replayCounts || { A: 0, B: 0, C: 0, D: 0 }, // How many times each was replayed
            feedbackTags: response.feedback?.tags || [], // Array of selected feedback tags
            feedbackText: response.feedback?.text || "", // Free text feedback
            responseTime: response.responseTime || 0 // Total time spent on this question
        }));
    }

    showSuccessMessage(message) {
        // Show user-friendly success message
        const messageElement = document.createElement('div');
        messageElement.className = 'success-message';
        messageElement.textContent = message;
        messageElement.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #10b981;
            color: white;
            padding: 15px;
            border-radius: 8px;
            z-index: 1000;
            max-width: 300px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            font-family: Inter, sans-serif;
            font-size: 14px;
            line-height: 1.4;
        `;
        
        document.body.appendChild(messageElement);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (messageElement.parentNode) {
                messageElement.remove();
            }
        }, 5000);
    }

    showMessage(message, type = 'info') {
        // Generic message display
        console.log(`${type.toUpperCase()}: ${message}`);
        
        const messageElement = document.createElement('div');
        messageElement.className = `message-${type}`;
        messageElement.textContent = message;
        
        const colors = {
            info: '#3b82f6',
            warning: '#f59e0b',
            error: '#ef4444',
            success: '#10b981'
        };
        
        messageElement.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${colors[type] || colors.info};
            color: white;
            padding: 15px;
            border-radius: 8px;
            z-index: 1000;
            max-width: 300px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            font-family: Inter, sans-serif;
            font-size: 14px;
            line-height: 1.4;
        `;
        
        document.body.appendChild(messageElement);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (messageElement.parentNode) {
                messageElement.remove();
            }
        }, 5000);
    }

    validateSubmissionData(payload) {
        // Validate required fields
        const required = ['sessionId', 'userEmail', 'responses'];
        for (const field of required) {
            if (!payload[field]) {
                throw new Error(`Missing required field: ${field}`);
            }
        }
        
        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(payload.userEmail)) {
            throw new Error('Invalid email format');
        }
        
        // Validate responses array
        if (!Array.isArray(payload.responses) || payload.responses.length === 0) {
            throw new Error('No responses recorded');
        }
        
        // Validate each response has required fields
        for (const response of payload.responses) {
            if (!response.selectedVersion || !response.questionText) {
                throw new Error('Incomplete response data');
            }
            
            // Validate selectedVersion is A, B, C, or D
            if (!['A', 'B', 'C', 'D'].includes(response.selectedVersion)) {
                throw new Error(`Invalid selected version: ${response.selectedVersion}`);
            }
        }
        
        // Validate session ID format
        if (!payload.sessionId.startsWith('session_')) {
            throw new Error('Invalid session ID format');
        }
        
        // Validate completion time is reasonable (not more than 2 hours)
        if (payload.completionTimeSeconds > 7200) {
            console.warn('Unusually long completion time detected:', payload.completionTimeSeconds);
        }
        
        console.log('Data validation passed');
        return true;
    }
}

// Initialize user manager
window.userManager = new UserManager();

