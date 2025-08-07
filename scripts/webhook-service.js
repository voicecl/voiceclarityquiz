// Webhook Service for Make.com Integration
class WebhookService {
    constructor() {
        this.webhookUrl = 'https://hook.us2.make.com/8195dd9mtinajkwaamf9soyjb7wipvxs';
        this.sentSessions = new Set(); // Track sent sessions to prevent duplicates
    }

    async sendSessionData(sessionData) {
        try {
            // Check if we've already sent this session
            if (this.sentSessions.has(sessionData.sessionId)) {
                console.log('Session already sent to webhook:', sessionData.sessionId);
                return { success: true, message: 'Session already sent' };
            }

            // Validate session data
            if (!this.validateSessionData(sessionData)) {
                throw new Error('Invalid session data');
            }

            // Prepare the webhook payload
            const payload = this.prepareWebhookPayload(sessionData);

            // Send the webhook
            const response = await fetch(this.webhookUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error(`Webhook failed with status: ${response.status}`);
            }

            // Mark session as sent
            this.sentSessions.add(sessionData.sessionId);
            
            console.log('Webhook sent successfully:', sessionData.sessionId);
            return { success: true, message: 'Webhook sent successfully' };

        } catch (error) {
            console.error('Webhook error:', error);
            return { success: false, error: error.message };
        }
    }

    validateSessionData(sessionData) {
        const required = ['sessionId', 'userEmail', 'firstName', 'lastName', 'responses'];
        
        for (const field of required) {
            if (!sessionData[field]) {
                console.error(`Missing required field: ${field}`);
                return false;
            }
        }

        if (!Array.isArray(sessionData.responses) || sessionData.responses.length === 0) {
            console.error('No responses found in session data');
            return false;
        }

        return true;
    }

    prepareWebhookPayload(sessionData) {
        // Calculate session metadata
        const startTime = new Date(sessionData.startTime || Date.now() - (sessionData.totalDuration || 0));
        const completedAt = new Date();
        const totalDuration = sessionData.totalDuration || (completedAt - startTime) / 1000;

        // Analyze preferences
        const preferenceAnalysis = this.analyzePreferences(sessionData.responses);

        // Prepare responses array
        const responses = sessionData.responses.map((response, index) => ({
            questionId: index + 1,
            selectedVersion: response.selectedVersion || response.selectedChoice,
            actualProcessing: response.actualProcessingType || response.trialType,
            trialType: response.trialType || 'unknown',
            selectionLatency: response.selectionLatency || 0,
            playbackTimes: response.playbackTimes || {},
            isCatch: response.isCatch || false,
            feedbackReasons: response.feedbackTags || [],
            responseTime: response.responseTime || 0
        }));
        
        // 🔧 ENHANCED: Debug webhook payload
        this.debugWebhookPayload(sessionData, responses);

        // ✅ Add voice preference summary
        const summary = this.getVoicePreferenceSummary(sessionData.responses);

        return {
            // Session metadata
            sessionId: sessionData.sessionId,
            userEmail: sessionData.userEmail,
            firstName: sessionData.firstName,
            lastName: sessionData.lastName,
            startTime: startTime.toISOString(),
            completedAt: completedAt.toISOString(),
            totalDuration: Math.round(totalDuration),
            deviceInfo: sessionData.deviceInfo || {},
            versionOrder: sessionData.versionOrder || {},

            // All responses
            responses: responses,

            // Preference analysis summary
            preferenceAnalysis: preferenceAnalysis,

            // Voice preference summary
            raw_count: summary.rawCount,
            modified_count: summary.modifiedCount,
            voice_preference: summary.preference,
            readable_message: summary.message
        };
    }

    analyzePreferences(responses) {
        const processingCounts = {
            raw: 0,
            light: 0,
            medium: 0,
            deep: 0
        };

        const totalResponses = responses.length;

        // Count selections for each processing type
        responses.forEach(response => {
            const processingType = response.actualProcessingType || response.trialType;
            if (processingCounts.hasOwnProperty(processingType)) {
                processingCounts[processingType]++;
            }
        });

        // Calculate percentages
        const percentages = {};
        Object.keys(processingCounts).forEach(type => {
            percentages[type] = totalResponses > 0 ? 
                Math.round((processingCounts[type] / totalResponses) * 100) : 0;
        });

        // Find most and least preferred
        const sortedTypes = Object.entries(processingCounts)
            .sort(([,a], [,b]) => b - a);

        return {
            totalResponses: totalResponses,
            processingCounts: processingCounts,
            percentages: percentages,
            mostPreferred: sortedTypes[0] ? sortedTypes[0][0] : null,
            leastPreferred: sortedTypes[sortedTypes.length - 1] ? sortedTypes[sortedTypes.length - 1][0] : null,
            preferenceRanking: sortedTypes.map(([type, count]) => ({ type, count }))
        };
    }

    // Method to check if webhook was already sent for a session
    isSessionSent(sessionId) {
        return this.sentSessions.has(sessionId);
    }

    // Method to clear sent sessions (useful for testing)
    clearSentSessions() {
        this.sentSessions.clear();
    }

    getVoicePreferenceSummary(responses) {
        // ✅ Only count the 9 real trials (exclude the guaranteed raw catch trial)
        const realQuestions = responses.filter(r => !r.isCatch && r.selectedVersion);

        let rawCount = 0;
        for (const q of realQuestions) {
            if (q.selectedVersion === 'raw') rawCount++;
        }

        const modifiedCount = realQuestions.length - rawCount;
        const preference = rawCount >= 5 ? "raw" : "enhanced"; // 5+ out of 9 = raw preference

        const message = preference === "raw"
            ? "You chose your regular recorded voice more often. That suggests you're more comfortable with how your voice naturally sounds in recordings — which is uncommon, and really valuable insight for us."
            : "You chose enhanced versions of your voice more often. That means you may prefer how your voice feels on the inside — closer to how you naturally hear yourself in your head.";

        return {
            rawCount,
            modifiedCount,
            preference,
            message
        };
    }
    
    // 🔧 ENHANCED: Debug webhook payload
    debugWebhookPayload(sessionData, responses) {
        const payload = {
            sessionId: sessionData.sessionId,
            userEmail: sessionData.userEmail,
            responses: responses,
            analytics: sessionData.analytics,
            timestamp: new Date().toISOString()
        };
        
        const payloadString = JSON.stringify(payload);
        const payloadSize = new Blob([payloadString]).size;
        
        console.log('🔍 WEBHOOK PAYLOAD DEBUG:');
        console.log('📏 Payload size:', payloadSize, 'bytes');
        console.log('📊 Responses count:', responses ? responses.length : 0);
        console.log('📱 Has analytics:', !!sessionData.analytics);
        
        if (payloadSize < 1024) {
            console.warn('⚠️ Payload seems small - possible data loss');
            console.log('💾 Full payload:', payload);
        }
        
        return payload;
    }
}

// Initialize webhook service globally
window.webhookService = new WebhookService(); 