/**
 * User Manager - Handles user registration, data storage, and session management
 */

class UserManager {
    constructor() {
        this.storageKey = 'voiceQuizUserData';
        this.participantsKey = 'voiceQuizParticipants';
        this.currentUser = null;
        this.sessionId = null;
        this.versionOrder = null;
        
        this.initialize();
    }

    detectDevice() {
        const userAgent = navigator.userAgent;
        const platform = navigator.platform;
        
        let deviceType = 'desktop';
        if (/Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent)) {
            deviceType = 'mobile';
        }
        
        const deviceInfo = {
            userAgent: userAgent,
            platform: platform,
            language: navigator.language,
            screenWidth: window.screen.width,
            screenHeight: window.screen.height,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            type: deviceType
        };
        
        console.log('Device detected:', deviceInfo);
        return deviceInfo;
    }

    generateSessionId() {
        this.sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 10);
        return this.sessionId;
    }

    initializeStorage() {
        if (!localStorage.getItem(this.participantsKey)) {
            localStorage.setItem(this.participantsKey, JSON.stringify([]));
        }
    }

    initialize() {
        this.initializeStorage();
        this.loadUserData();
        this.generateSessionId();
        this.initializeVersionOrder();
        console.log('User Manager initialized');
    }

    async registerUser(userData) {
        try {
            if (!this.validateUserData(userData)) {
                throw new Error('Invalid user data provided');
            }

            // Check if user has already participated
            const participants = this.getParticipants();
            if (participants.includes(userData.email)) {
                return {
                    success: false,
                    blocked: true,
                    message: 'You have already participated in this study.'
                };
            }

            const userId = this.generateUserId();
            const deviceInfo = this.detectDevice();
            
            this.currentUser = {
                id: userId,
                firstName: userData.firstName,
                lastName: userData.lastName,
                email: userData.email,
                consent: userData.consent,
                registrationDate: new Date().toISOString(),
                deviceInfo: deviceInfo,
                studyProgress: {
                    currentQuestion: 1,
                    totalQuestions: 10,
                    responses: [],
                    startTime: new Date().toISOString(),
                    completed: false
                }
            };

            this.saveUserData();
            this.addParticipant(userData.email);
            
            console.log('User registered successfully:', this.currentUser);
            return {
                success: true,
                user: this.currentUser
            };
            
        } catch (error) {
            console.error('User registration failed:', error);
            return {
                success: false,
                blocked: false,
                message: error.message || 'Registration failed'
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
                ...response,
                timestamp: new Date().toISOString()
            };
            
            this.saveUserData();
        }
    }

    async completeStudy() {
        if (this.currentUser) {
            this.currentUser.studyProgress.completed = true;
            this.currentUser.studyProgress.endTime = new Date().toISOString();
            this.saveUserData();
            
            console.log('Study completed for user:', this.currentUser.id);
        }
    }

    cleanupRecordings() {
        // This would be called after data is sent to server
        // For now, we just log that cleanup would happen
        console.log('Recordings would be cleaned up here');
    }

    getUserData() {
        return this.currentUser;
    }

    isUserRegistered() {
        return this.currentUser !== null;
    }

    isStudyCompleted() {
        return this.currentUser && this.currentUser.studyProgress.completed;
    }

    getStudyProgress() {
        return this.currentUser ? this.currentUser.studyProgress : null;
    }

    exportUserData() {
        if (!this.currentUser) {
            return null;
        }

        const exportData = {
            user: {
                id: this.currentUser.id,
                firstName: this.currentUser.firstName,
                lastName: this.currentUser.lastName,
                email: this.currentUser.email,
                registrationDate: this.currentUser.registrationDate,
                deviceInfo: this.currentUser.deviceInfo
            },
            session: {
                sessionId: this.sessionId,
                startTime: this.currentUser.studyProgress.startTime,
                endTime: this.currentUser.studyProgress.endTime,
                completed: this.currentUser.studyProgress.completed
            },
            responses: this.currentUser.studyProgress.responses || []
        };

        return exportData;
    }

    downloadUserData() {
        const data = this.exportUserData();
        if (!data) {
            console.error('No user data to export');
            return;
        }

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `voice-quiz-data-${this.currentUser.id}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    resetUserData() {
        this.currentUser = null;
        localStorage.removeItem(this.storageKey);
        console.log('User data reset');
    }

    getStudyStats() {
        if (!this.currentUser || !this.currentUser.studyProgress.responses) {
            return null;
        }

        const responses = this.currentUser.studyProgress.responses;
        const totalQuestions = responses.length;
        const completedQuestions = responses.filter(r => r !== null).length;
        
        // Calculate processing type preferences
        const processingChoices = responses
            .filter(r => r && r.trialType && r.trialType !== 'raw')
            .map(r => r.trialType);
        
        const choiceCounts = {};
        processingChoices.forEach(choice => {
            choiceCounts[choice] = (choiceCounts[choice] || 0) + 1;
        });

        return {
            totalQuestions,
            completedQuestions,
            completionRate: (completedQuestions / totalQuestions) * 100,
            processingPreferences: choiceCounts,
            averageResponseTime: this.calculateAverageResponseTime(responses)
        };
    }

    calculateAverageResponseTime(responses) {
        const validResponses = responses.filter(r => r && r.responseTime);
        if (validResponses.length === 0) return 0;
        
        const totalTime = validResponses.reduce((sum, r) => sum + r.responseTime, 0);
        return totalTime / validResponses.length;
    }

    async recordResponse(questionId, selectedChoice, trialType, responseTime, feedback = {}, isCatch = false) {
        try {
            // 🔍 DEBUG: Verify we're recording the correct actual processing type
            console.log(`🔍 recordResponse debug for question ${questionId + 1}:`, {
                selectedChoice,
                trialType, // This should now be the actual processing type (raw, light, medium, deep)
                isCatch,
                responseTime
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

            // Store in user's study progress
            this.addResponse(questionId + 1, response);
            
            console.log(`✅ Response recorded with correct actual processing type:`, response);
            
            return response;
            
        } catch (error) {
            console.error('Failed to record response:', error);
            throw error;
        }
    }

    getAllResponses() {
        if (!this.currentUser || !this.currentUser.studyProgress.responses) {
            return [];
        }

        return this.currentUser.studyProgress.responses
            .filter(response => response !== null)
            .map(response => ({
                questionId: response.questionId,
                selectedChoice: response.selectedChoice,
                actualProcessingType: response.trialType, // 🔧 FIXED: Use trialType which now contains the actual processing type
                isCatch: response.isCatch,
                responseTime: response.responseTime,
                feedback: response.feedback,
                timestamp: response.timestamp
            }));
    }
    
    // 🔧 FIXED: Add missing getAnalytics method
    getAnalytics() {
        if (!this.currentUser) {
            console.warn('No current user for analytics');
            return null;
        }
        
        const userResponses = this.getAllResponses();
        
        return {
            userId: this.currentUser.id,
            userEmail: this.currentUser.email,
            totalResponses: userResponses.length,
            responsesSummary: userResponses.map(r => ({
                questionId: r.questionId,
                selectedChoice: r.selectedChoice,
                trialType: r.actualProcessingType,
                isCatch: r.isCatch,
                responseTime: r.responseTime,
                timestamp: r.timestamp
            })),
            deviceInfo: this.getDeviceInfo(),
            sessionStartTime: this.currentUser.registrationDate,
            sessionCompleteTime: new Date().toISOString()
        };
    }
    
    // 🔧 FIXED: Add debug method for analytics
    debugAnalytics() {
        console.log('🔍 User Manager Debug:', {
            hasCurrentUser: !!this.currentUser,
            currentUser: this.currentUser,
            totalResponses: this.getAllResponses().length,
            deviceInfo: this.getDeviceInfo()
        });
        
        return this.getAnalytics();
    }
}

// Export for global use
window.UserManager = UserManager;

// Create global instance
window.userManager = new UserManager();

