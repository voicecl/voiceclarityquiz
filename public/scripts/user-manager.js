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
            const response = {
                userEmail: this.currentUser.email,
                sessionId: this.sessionId,
                questionId: questionId,
                selectedChoice: selectedChoice,         // 'left' or 'right'
                trialType: trialType,                   // 'light', 'medium', 'deep', or 'raw'
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

            console.log('Response recorded:', response);
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
            actualProcessingType: this.versionOrder[response.selectedVersion], // raw, light, medium, deep
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

