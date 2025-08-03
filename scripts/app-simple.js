// Main Application Controller with User Registration and Data Protection
// Guarantee session store exists before any processing
window.voiceQuizApp = window.voiceQuizApp || {};
window.voiceQuizApp.session = window.voiceQuizApp.session || {
  questions: [],
  add(q) { this.questions.push(q); }
};

// Helper function for array shuffling
function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    let j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

// Safe range computation function that won't overflow the call stack
function computeRange(buffer) {
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < buffer.length; i++) {
    const v = buffer[i];
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  return `${lo} to ${hi}`;
}

// Fixed WAV helper function that handles Float32Array data from fallback processing
function audioBufferToWavBlob(audioData, sampleRate = 44100, numChannels = 1) {
  // Handle both AudioBuffer objects and Float32Array data
  let channelData;
  let actualSampleRate;
  let actualChannels;
  
  if (audioData instanceof AudioBuffer) {
    // Standard AudioBuffer object
    channelData = audioData.getChannelData(0);
    actualSampleRate = audioData.sampleRate;
    actualChannels = audioData.numberOfChannels;
  } else if (audioData instanceof Float32Array) {
    // Float32Array from fallback processing
    channelData = audioData;
    actualSampleRate = sampleRate;
    actualChannels = numChannels;
  } else {
    console.error('Invalid audio data type:', typeof audioData);
    throw new Error('Audio data must be AudioBuffer or Float32Array');
  }
  
  const length = channelData.length * actualChannels * 2; // 16-bit samples
  const arrayBuffer = new ArrayBuffer(44 + length);
  const view = new DataView(arrayBuffer);

  // Helper function to write string to DataView
  const writeString = (offset, string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  // WAV header
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + length, true); // File size
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // Format chunk size
  view.setUint16(20, 1, true);  // PCM format
  view.setUint16(22, actualChannels, true); // Number of channels
  view.setUint32(24, actualSampleRate, true); // Sample rate
  view.setUint32(28, actualSampleRate * actualChannels * 2, true); // Byte rate
  view.setUint16(32, actualChannels * 2, true); // Block align
  view.setUint16(34, 16, true); // Bits per sample
  writeString(36, 'data');
  view.setUint32(40, length, true); // Data chunk size

  // Convert Float32 samples to 16-bit PCM
  let offset = 44;
  for (let i = 0; i < channelData.length; i++) {
    // Clamp sample to [-1, 1] range and convert to 16-bit integer
    const sample = Math.max(-1, Math.min(1, channelData[i]));
    const intSample = Math.round(sample * 0x7FFF);
    view.setInt16(offset, intSample, true);
    offset += 2;
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' });
}



function buildVersionURLs() {
  const urls = {};
  for (const [v, buf] of Object.entries(window.voiceQuizApp.processedVersions)) {
    // Use the correct sample rate from the audio context (typically 48000 Hz)
    const sampleRate = window.voiceQuizApp.audioContext ? window.voiceQuizApp.audioContext.sampleRate : 48000;
    const wavBlob = audioBufferToWavBlob(buf, sampleRate, 1);
    urls[v] = URL.createObjectURL(wavBlob);
  }
  window.voiceQuizApp.versionURLs = urls;
}

function handleQuestionProcessed(questionIndex, processedMap) {
  // Prevent recursive calls to handleQuestionProcessed
  if (window.voiceQuizApp && window.voiceQuizApp.isHandlingQuestion) {
    console.log('🔄 handleQuestionProcessed() called while already handling - ignoring');
    return;
  }
  
  if (window.voiceQuizApp) {
    window.voiceQuizApp.isHandlingQuestion = true;
  }
  
  // Ensure session and questions array exist
  if (!window.voiceQuizApp.session) {
    console.error('Session not initialized');
    return;
  }
  
  if (!window.voiceQuizApp.session.questions) {
    console.error('Questions array not initialized');
    window.voiceQuizApp.session.questions = [];
  }
  
  // DEBUG: Log what we're receiving
  console.log('🔍 handleQuestionProcessed received:', {
    questionIndex,
    processedMapKeys: Object.keys(processedMap || {}),
    processedMapType: typeof processedMap,
    isArray: Array.isArray(processedMap)
  });
  
  // DEBUG: Deep inspection of each version
  console.log('🔍 Detailed version inspection:');
  for (const v of Object.keys(processedMap || {})) {
    const buffer = processedMap[v];
    console.log(`— version ${v} →`, {
      type: typeof buffer,
      isFloat32Array: buffer instanceof Float32Array,
      isAudioBuffer: buffer instanceof AudioBuffer,
      length: buffer?.length,
      firstSample: buffer?.[0],
      lastSample: buffer?.[buffer?.length - 1],
      hasData: buffer?.length > 0
    });
  }
  
  // Clean up existing URLs for this question if re-recording
  const existingQuestionData = window.voiceQuizApp.session.questions[questionIndex];
  if (existingQuestionData && existingQuestionData.urls) {
    for (const url of Object.values(existingQuestionData.urls)) {
      URL.revokeObjectURL(url);
    }
  }
  
  const urls = {};
  for (const [label, buf] of Object.entries(processedMap)) {
    if (!(buf instanceof Float32Array)) {
      console.error(`Expected Float32Array for version ${label}, got:`, buf);
      continue;
    }
    
    // DEBUG: Check buffer content before creating blob
    console.log(`💡 Version ${label} buffer:`, {
      length: buf.length,
      firstSample: buf[0],
      lastSample: buf[buf.length - 1],
      hasData: buf.length > 0,
      sampleRange: buf.length > 0 ? computeRange(buf) : 'N/A'
    });
    
    // Use the correct sample rate from the audio context (typically 48000 Hz)
    const sampleRate = window.voiceQuizApp.audioContext ? window.voiceQuizApp.audioContext.sampleRate : 48000;
    const wavBlob = audioBufferToWavBlob(buf, sampleRate, 1);
    urls[label] = URL.createObjectURL(wavBlob);
    console.log(`✅ Created URL for version ${label}:`, urls[label]);
  }

  // Overwrite or add question data
  if (existingQuestionData) {
    // 🔧 FIX: Preserve randomizedVersions if it already exists
    const preservedMapping = existingQuestionData.randomizedVersions;
    
    // Update existing question data
    existingQuestionData.urls = urls;
    existingQuestionData.processed = processedMap;
    existingQuestionData.selectedVersion = null; // Reset selection
    existingQuestionData.reasons = []; // Reset reasons
    
    // 🔧 FIX: Only reset mapping if it wasn't already set
    if (!preservedMapping) {
      existingQuestionData.randomizedVersions = null;
    } else {
      existingQuestionData.randomizedVersions = preservedMapping; // Preserve existing mapping
      console.log('🎯 Preserved existing randomizedVersions mapping:', preservedMapping);
    }
  } else {
    // Add new question data
    window.voiceQuizApp.session.add({
      index: questionIndex,
      urls,                 // {left, right}
      processed: processedMap,
      selectedVersion: null,
      reasons: [],
      randomizedVersions: null // Will be set by applyVersionRandomization
    });
  }
  
  // Reset the handling flag
  if (window.voiceQuizApp) {
    window.voiceQuizApp.isHandlingQuestion = false;
  }
}

class VoiceQuizApp {
    constructor() {
        // Use the global session object to avoid dual session management
        this.session = window.voiceQuizApp.session;
        
        this.currentQuestion = 0;
        this.isProcessing = false; // Add processing flag to prevent recursion
        this.isMovingToNext = false; // Add flag to prevent multiple nextQuestion calls
        this.isHandlingQuestion = false; // Add flag to prevent handleQuestionProcessed recursion
        
        // New trial structure for two-choice system
        this.trials = this.generateTrials();
        
        this.currentRecording = null;
        this.processedVersions = null;
        this.selectedVersion = null;
        this.startTime = null;
        this.isRegistered = false;
        
        // Audio playback tracking
        this.currentlyPlayingAudio = null;
        this.currentlyPlayingVersion = null;
        this.currentAudioUrl = null;
        
        // Memory management tracking
        this.audioUrls = new Set(); // Track all created URLs for cleanup
        this.audioBlobs = new Set(); // Track all audio blobs for cleanup
        
        // Advanced analytics tracking
        this.selectionBehaviorData = {
            playbackTimes: {},           // Track how long each version was played
            selectionLatency: {},        // Time between play and selection
            replayCount: {},             // How many times each version was replayed
            rapidSelections: [],         // Track suspiciously fast selections
            interactionTimestamps: []    // All user interactions with timestamps
        };
        
        this.initializeApp();
    }

    generateTrials() {
        console.log('🎯 Generating counter-balanced trial set...');
        
        // 1) Build nine real trials: 3× each processing mode
        const modes = ['light', 'medium', 'deep']
            .flatMap(type => Array(3).fill(type));
        
        // 2) Shuffle processing mode order
        const shuffledModes = shuffle([...modes]);
        
        // 3) Build a side-assignment mask so raw appears on right (B) at least 5/9 times
        // This means processed version appears on left 4/9 times and right 5/9 times
        const sideMask = Array(4).fill('procLeft')
            .concat(Array(5).fill('procRight'));
        const shuffledSideMask = shuffle([...sideMask]);
        
        // 4) Nine diverse prompts for the real trials
        const prompts = [
            "What's your favorite food and why do you love it?",
            "Describe your ideal weekend morning and what you'd do.",
            "What always cheers you up when you're having a bad day?", 
            "Tell me about a place that makes you feel peaceful and why.",
            "What's your favorite way to spend a day off and what makes it special?",
            "What's the best advice someone has ever given you and why?",
            "How do you like to unwind after a long day?",
            "What made you smile today and what happened?",
            "What's your favorite season of the year and what do you enjoy about it?"
        ];
        
        // 5) Build the 9 test trials with proper integration
        const testTrials = shuffledModes.map((mode, i) => {
            const leftIsProc = shuffledSideMask[i] === 'procLeft';
            
            return {
                type: mode,
                isCatch: false,
                question: prompts[i],
                hint: "Take your time and speak naturally",
                comparisonSetup: {
                    leftVersion: leftIsProc ? mode : 'raw',
                    rightVersion: leftIsProc ? 'raw' : mode,
                    correctAnswer: leftIsProc ? 'left' : 'right' // For analysis
                }
            };
        });
        
        // 6) One catch trial (raw vs raw) 
        const catchTrial = {
            type: 'raw',
            isCatch: true,
            question: "Tell me about a skill you're proud of and how you developed it.",
            hint: "This is a validation question - listen carefully",
            comparisonSetup: {
                leftVersion: 'raw',
                rightVersion: 'raw', 
                correctAnswer: 'either' // Both should sound identical
            }
        };
        
        // 7) Insert the catch at a random position (avoid first/last for subtlety)
        const allTrials = [...testTrials];
        const catchPosition = 2 + Math.floor(Math.random() * (allTrials.length - 3)); // Positions 2-7
        allTrials.splice(catchPosition, 0, catchTrial);
        
        console.log('✅ Generated trial set:', {
            totalTrials: allTrials.length,
            realTrials: testTrials.length,
            catchTrials: 1,
            catchPosition: catchPosition + 1,
            processingModes: shuffledModes,
            sideDistribution: {
                processedOnLeft: shuffledSideMask.filter(s => s === 'procLeft').length,
                processedOnRight: shuffledSideMask.filter(s => s === 'procRight').length,
                rawOnRight: shuffledSideMask.filter(s => s === 'procRight').length, // Raw appears on right (B) 5/9 times
                rawOnLeft: shuffledSideMask.filter(s => s === 'procLeft').length   // Raw appears on left (A) 4/9 times
            }
        });
        
        return allTrials;
    }

    async initializeApp() {
        try {
            // Ensure userManager has the correct versionOrder for counter-balanced trials
            if (window.userManager && !window.userManager.versionOrder) {
                window.userManager.versionOrder = {
                    A: 'raw',     // Raw version is always A
                    B: 'light',   // Light processing is B
                    C: 'medium',  // Medium processing is C
                    D: 'deep'     // Deep processing is D
                };
                console.log('Counter-balanced versionOrder initialized:', window.userManager.versionOrder);
            }
            
            // Check AudioWorklet support
            const hasAudioWorklet = typeof AudioWorkletNode !== 'undefined';
            const hasWebAssembly = typeof WebAssembly !== 'undefined';
            
            console.log('AudioWorklet support:', hasAudioWorklet);
            console.log('WebAssembly support:', hasWebAssembly);
            
            // Check microphone permissions first
            if (window.audioRecorder) {
                const permissionCheck = await window.audioRecorder.checkMicrophonePermission();
                console.log('Microphone permission check:', permissionCheck);
                
                if (!permissionCheck.supported) {
                    this.showError('Microphone access is not supported in this browser. Please use a modern browser like Chrome, Firefox, or Safari.');
                    return;
                }
                
                if (!permissionCheck.permitted) {
                    this.showError('Microphone access is required for this study. Please allow microphone permissions and refresh the page.');
                    return;
                }
            }
            
            // AudioProcessor will be initialized lazily when needed for processing
            // This prevents automatic Worklet loading on page load
            if (window.AudioProcessor) {
                // Don't create instance immediately - create it only when needed
                console.log('AudioProcessor available (will create instance when needed)');
            }
            
            // Set up event listeners
            this.setupEventListeners();
            
            // Initialize UI controller
            if (window.uiController) {
                window.uiController.initialize();
            }
            
            console.log('Voice Quiz App initialized successfully');
            
        } catch (error) {
            console.error('Failed to initialize app:', error);
            this.showError(`Failed to initialize the application: ${error.message}. Please refresh and try again.`);
        }
    }

    setupEventListeners() {
        // Landing page
        const startBtn = document.getElementById('start-quiz-btn');
        if (startBtn) {
            startBtn.addEventListener('click', () => this.showRegistration());
        }

        // Microphone test button
        const testMicBtn = document.getElementById('test-microphone-btn');
        if (testMicBtn) {
            testMicBtn.addEventListener('click', () => this.testMicrophone());
        }

        // Registration form
        const registrationForm = document.getElementById('registration-form');
        if (registrationForm) {
            registrationForm.addEventListener('submit', (e) => this.handleRegistration(e));
        }

        // Recording controls
        const recordBtn = document.getElementById('record-btn');
        if (recordBtn) {
            recordBtn.addEventListener('click', () => this.toggleRecording());
        }

        const playBtn = document.getElementById('play-recording-btn');
        if (playBtn) {
            playBtn.addEventListener('click', () => this.playRecording());
        }

        const reRecordBtn = document.getElementById('re-record-btn');
        if (reRecordBtn) {
            reRecordBtn.addEventListener('click', () => this.reRecord());
        }

        const continueBtn = document.getElementById('continue-btn');
        if (continueBtn) {
            continueBtn.addEventListener('click', () => {
                console.log('🔄 Continue button clicked - calling processRecording()');
                // Prevent multiple rapid clicks
                if (this.isProcessing) {
                    console.log('🔄 Ignoring continue button click - already processing');
                    return;
                }
                this.processRecording();
            });
        }

        // Keyboard shortcuts for choice selection - DISABLED
        // document.addEventListener('keydown', (e) => {
        //     const comparisonPage = document.getElementById('comparison-page');
        //     if (comparisonPage && comparisonPage.classList.contains('active')) {
        //         if (e.key.toLowerCase() === 'l') {
        //             e.preventDefault();
        //             this.selectChoice('left');
        //         } else if (e.key.toLowerCase() === 'r') {
        //             e.preventDefault();
        //             this.selectChoice('right');
        //         }
        //     }
        // });

        const comparisonContinueBtn = document.getElementById('comparison-continue-btn');
        if (comparisonContinueBtn) {
            comparisonContinueBtn.addEventListener('click', () => {
                console.log('🔄 Comparison continue button clicked - calling nextQuestion()');
                // Prevent multiple rapid clicks
                if (this.isProcessing || this.isMovingToNext) {
                    console.log('🔄 Ignoring comparison continue button click - currently processing or moving');
                    return;
                }
                // Add a small delay to prevent rapid clicks
                setTimeout(() => {
                    this.nextQuestion();
                }, 100);
            });
        }

        // Feedback tags
        const feedbackTags = document.querySelectorAll('.feedback-tag');
        feedbackTags.forEach(tag => {
            tag.addEventListener('click', () => this.toggleFeedbackTag(tag));
        });

        // Results actions
        const downloadBtn = document.getElementById('download-results-btn');
        if (downloadBtn) {
            downloadBtn.addEventListener('click', () => this.downloadResults());
        }

        const newQuizBtn = document.getElementById('start-new-quiz-btn');
        if (newQuizBtn) {
            newQuizBtn.addEventListener('click', () => this.startNewQuiz());
        }
    }

    async testMicrophone() {
        const statusDiv = document.getElementById('microphone-status');
        const testBtn = document.getElementById('test-microphone-btn');
        
        if (!statusDiv || !testBtn) return;
        
        try {
            testBtn.disabled = true;
            testBtn.textContent = 'Testing...';
            statusDiv.textContent = 'Checking microphone access...';
            
            if (!window.audioRecorder) {
                statusDiv.textContent = '❌ Audio recorder not available';
                return;
            }
            
            const permissionCheck = await window.audioRecorder.checkMicrophonePermission();
            
            if (!permissionCheck.supported) {
                statusDiv.textContent = '❌ Microphone not supported in this browser';
            } else if (!permissionCheck.permitted) {
                statusDiv.textContent = '❌ Microphone permission denied. Please allow access.';
            } else {
                statusDiv.textContent = '✅ Microphone access confirmed!';
                
                // Try a quick recording test
                try {
                    await window.audioRecorder.initialize();
                    statusDiv.textContent = '✅ Microphone ready for recording!';
                } catch (error) {
                    statusDiv.textContent = `⚠️ Microphone access confirmed but recording test failed: ${error.message}`;
                }
            }
            
        } catch (error) {
            console.error('Microphone test failed:', error);
            statusDiv.textContent = `❌ Microphone test failed: ${error.message}`;
        } finally {
            testBtn.disabled = false;
            testBtn.textContent = 'Test Microphone';
        }
    }

    showRegistration() {
        this.hideAllScreens();
        const registrationPage = document.getElementById('registration-page');
        if (registrationPage) {
            registrationPage.classList.add('active');
        } else {
            console.error('registration-page element not found');
        }
    }

    async handleRegistration(event) {
        event.preventDefault();
        
        const submitBtn = document.getElementById('register-btn');
        if (!submitBtn) {
            console.error('register-btn element not found');
            return;
        }
        
        const originalText = submitBtn.textContent;
        
        try {
            // Show loading state
            submitBtn.classList.add('loading');
            submitBtn.disabled = true;
            submitBtn.textContent = 'Registering...';

            // Get form data
            const formData = new FormData(event.target);
            const userData = {
                firstName: formData.get('firstName'),
                lastName: formData.get('lastName'),
                email: formData.get('email'),
                consent: formData.get('consent') === 'on'
            };

            // Register user
            const result = await window.userManager.registerUser(userData);

            if (result.success) {
                this.isRegistered = true;
                console.log('User registered successfully');
                this.startQuiz();
            } else if (result.blocked) {
                // Show already participated message
                const registrationForm = document.getElementById('registration-form');
                const alreadyParticipated = document.getElementById('already-participated');
                if (registrationForm) registrationForm.style.display = 'none';
                if (alreadyParticipated) alreadyParticipated.classList.remove('hidden');
            } else {
                throw new Error(result.message || 'Registration failed');
            }

        } catch (error) {
            console.error('Registration error:', error);
            this.showRegistrationError(error.message);
        } finally {
            // Reset button state
            if (submitBtn) {
                submitBtn.classList.remove('loading');
                submitBtn.disabled = false;
                submitBtn.textContent = originalText;
            }
        }
    }

    showRegistrationError(message) {
        // Remove any existing error messages
        const existingError = document.querySelector('.error-message');
        if (existingError) {
            existingError.remove();
        }

        // Create and show error message
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.textContent = message;
        
        const form = document.getElementById('registration-form');
        if (form) {
            form.appendChild(errorDiv);
        } else {
            console.error('registration-form element not found');
        }

        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (errorDiv.parentNode) {
                errorDiv.remove();
            }
        }, 5000);
    }

    startQuiz() {
        if (!this.isRegistered) {
            this.showRegistration();
            return;
        }

        this.currentQuestion = 0;
        this.showRecordingPage();
        this.updateQuestionDisplay();
    }

    showRecordingPage() {
        console.log('📝 showRecordingPage() called for question:', this.currentQuestion);
        
        // CRITICAL: Stop all audio when moving to recording page
        this.stopAllAudio();
        
        // Log memory status at start of new question
        this.logMemoryStatus('Start of Question');
        
        this.hideAllScreens();
        const recordingPage = document.getElementById('recording-page');
        if (recordingPage) {
            recordingPage.classList.add('active');
        } else {
            console.error('recording-page element not found');
        }
        
        // Reset recording UI
        this.resetRecordingUI();
    }

    updateQuestionDisplay() {
        const question = this.trials[this.currentQuestion];
        
        // Update question text and hint
        const questionText = document.getElementById('question-text');
        const questionHint = document.getElementById('question-hint');
        const questionCounter = document.getElementById('question-counter');
        
        if (questionText) questionText.textContent = question.question;
        if (questionHint) questionHint.textContent = question.hint;
        if (questionCounter) {
            questionCounter.textContent = `Question ${this.currentQuestion + 1} of ${this.trials.length}`;
        }
        
        // Update progress dots
        this.updateProgressDots();
    }

    updateProgressDots() {
        const dots = document.querySelectorAll('.progress-dot');
        dots.forEach((dot, index) => {
            if (dot) {
                dot.classList.remove('active', 'completed');
                if (index < this.currentQuestion) {
                    dot.classList.add('completed');
                } else if (index === this.currentQuestion) {
                    dot.classList.add('active');
                }
            }
        });
    }

    async toggleRecording() {
        if (!window.audioRecorder) {
            console.error('Audio recorder not available');
            this.showError('Audio recorder not available. Please refresh the page and try again.');
            return;
        }

        try {
            if (window.audioRecorder.isRecording) {
                await this.stopRecording();
            } else {
                await this.startRecording();
            }
        } catch (error) {
            console.error('Recording error:', error);
            
            // Provide specific error messages based on error type
            let userMessage = 'Recording failed. Please try again.';
            
            if (error.message.includes('permission denied')) {
                userMessage = 'Microphone permission denied. Please allow microphone access in your browser settings and try again.';
            } else if (error.message.includes('not found')) {
                userMessage = 'No microphone found. Please connect a microphone and try again.';
            } else if (error.message.includes('not supported')) {
                userMessage = 'Microphone not supported in this browser. Please try Chrome, Firefox, or Safari.';
            } else if (error.message.includes('getUserMedia')) {
                userMessage = 'Microphone access failed. Please check your browser permissions and try again.';
            }
            
            this.showError(userMessage);
        }
    }

    async startRecording() {
        try {
            console.log('🎙️ Starting recording...');
            
            // Update recording button state
            const recordBtn = document.getElementById('record-btn');
            if (recordBtn) {
                recordBtn.classList.add('recording');
                recordBtn.textContent = '⏹️ Stop Recording';
            }
            
            this.startTime = Date.now();
            await window.audioRecorder.startRecording();
            
            // Start timer
            this.startTimer();
            
            console.log('✅ Recording started successfully');
            
        } catch (error) {
            console.error('❌ Failed to start recording:', error);
            this.showError('Failed to start recording. Please check your microphone permissions.');
            
            // Reset button state on error
            const recordBtn = document.getElementById('record-btn');
            if (recordBtn) {
                recordBtn.classList.remove('recording');
                recordBtn.textContent = '🎙️ Start Recording';
            }
        }
    }

    async stopRecording() {
        try {
            console.log('⏹️ Stopping recording...');
            
            // Update recording button state
            const recordBtn = document.getElementById('record-btn');
            if (recordBtn) {
                recordBtn.classList.remove('recording');
                recordBtn.textContent = '🎙️ Start Recording';
            }
            
            this.currentRecording = await window.audioRecorder.stopRecording();
            this.stopTimer();
            
            console.log('✅ Recording stopped successfully');
            
            // Process the recording
            await this.processRecording();
            
        } catch (error) {
            console.error('❌ Failed to stop recording:', error);
            this.showError('Failed to stop recording. Please try again.');
            
            // Reset button state on error
            const recordBtn = document.getElementById('record-btn');
            if (recordBtn) {
                recordBtn.classList.remove('recording');
                recordBtn.textContent = '🎙️ Start Recording';
            }
        }
    }

    async deleteTemporaryAudio() {
        // Delete any previous recordings from memory for privacy compliance
        if (this.processedVersions) {
            this.processedVersions = null;
        }
        
        // Force garbage collection if available
        if (window.gc) {
            window.gc();
        }
    }

    startTimer() {
        this.timerInterval = setInterval(() => {
            const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
            const minutes = Math.floor(elapsed / 60);
            const seconds = elapsed % 60;
            const timer = document.getElementById('timer');
            if (timer) {
                timer.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            }
        }, 1000);
    }

    stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }

    playRecording() {
        if (this.currentRecording) {
            // CRITICAL: Stop all audio before playing recording
            this.stopAllAudio();
            
            // Create audio with tracked URL management
            const audioUrl = this.createTrackedAudioUrl(this.currentRecording);
            const audio = new Audio(audioUrl);
            
            // Store reference for cleanup
            this.currentlyPlayingAudio = audio;
            this.currentAudioUrl = audioUrl;
            
            // Start playing
            audio.play().catch(error => {
                console.error('Failed to play recording:', error);
                this.stopAllAudio();
            });
            
            // Clean up URL and state when audio ends
            audio.addEventListener('ended', () => {
                if (this.currentAudioUrl) {
                    this.revokeTrackedAudioUrl(this.currentAudioUrl);
                    this.currentAudioUrl = null;
                }
                this.currentlyPlayingAudio = null;
            });
            
            // Handle audio pause/stop
            audio.addEventListener('pause', () => {
                if (this.currentAudioUrl) {
                    this.revokeTrackedAudioUrl(this.currentAudioUrl);
                    this.currentAudioUrl = null;
                }
                this.currentlyPlayingAudio = null;
            });
        }
    }

    reRecord() {
        this.resetRecordingUI();
        this.currentRecording = null;
    }

    resetRecordingUI() {
        const recordIcon = document.getElementById('record-icon');
        if (recordIcon) recordIcon.textContent = '🎙️';
        const statusText = document.getElementById('status-text');
        if (statusText) statusText.textContent = 'Tap to start';
        const timer = document.getElementById('timer');
        if (timer) timer.classList.add('hidden');
        const playbackControls = document.getElementById('playback-controls');
        if (playbackControls) playbackControls.classList.add('hidden');
        const recordingProgress = document.getElementById('recording-progress');
        if (recordingProgress) recordingProgress.style.width = '0%';
    }

    async processRecording() {
        // Prevent recursive processing
        if (this.isProcessing) {
            console.log('🔄 processRecording() called while already processing - ignoring');
            return;
        }
        
        this.isProcessing = true;
        console.log('🔄 processRecording() started for question:', this.currentQuestion);
        
        try {
            this.showProcessingPage();
            
            // Convert blob to AudioBuffer for processing
            const arrayBuffer = await this.currentRecording.arrayBuffer();
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
            
            // Create AudioProcessor instance lazily when needed for processing
            if (!window.audioProcessor) {
                console.log('Creating AudioProcessor instance for processing...');
                window.audioProcessor = new AudioProcessor();
            }
            
            // Initialize AudioProcessor if not already initialized
            if (!window.audioProcessor.isInitialized) {
                console.log('Initializing AudioProcessor for processing...');
                try {
                    await window.audioProcessor.initialize();
                    console.log('AudioProcessor initialized with AudioWorklet');
                } catch (error) {
                    console.warn('AudioWorklet initialization failed, using fallback:', error);
                    window.audioProcessor.useFallback = true;
                }
            }
            
            // Process audio with all versions using the AudioProcessor
            let processedVersions;
            if (window.audioProcessor.useFallback) {
                console.log('Using fallback processing');
                processedVersions = await window.audioProcessor.processRecordingFallback(audioBuffer);
            } else {
                console.log('Using AudioWorklet processing');
                processedVersions = await window.audioProcessor.processRecording(audioBuffer);
            }
            
            // (1) Replace Map conversion with direct assignment
            // this.processedVersions = new Map(Object.entries(processedVersions));
            this.processedVersions = processedVersions;
            
            // Get version order with fallback
            const versionOrder = window.userManager?.versionOrder || {
                A: 'deep',    // full restoration
                B: 'raw',     // unprocessed
                C: 'light',   // partial
                D: 'medium'   // thought-style
            };
            console.log('Version order at processRecording:', versionOrder);
            
            // Apply version randomization for anti-gaming
            const randomizedVersions = this.applyVersionRandomization(this.processedVersions, versionOrder);
            this.processedVersions = randomizedVersions;
            
            // CRITICAL FIX: Assign the randomized versions to the global app object
            window.voiceQuizApp.processedVersions = randomizedVersions;
            
            // DEBUG: Log what we're passing to handleQuestionProcessed
            console.log('🔍 Passing to handleQuestionProcessed:', {
                questionIndex: this.currentQuestion,
                randomizedVersionsKeys: Object.keys(randomizedVersions || {}),
                randomizedVersionsType: typeof randomizedVersions,
                isArray: Array.isArray(randomizedVersions)
            });
            
            // Handle question processing with session management
            handleQuestionProcessed(this.currentQuestion, randomizedVersions);
            
            // Show comparison page - let user interact before moving to next question
            this.showComparisonPage();
            
            // CRITICAL: Don't automatically progress to next question
            // Let the user click "Next" button to move forward
            
            // CRITICAL: Delete original recording immediately after processing for privacy
            await this.deleteOriginalRecording();
            
        } catch (error) {
            console.error('Processing error:', error);
            this.showError('Failed to process audio. Please try recording again.');
        } finally {
            // Always reset processing flag
            this.isProcessing = false;
            console.log('🔄 processRecording() completed for question:', this.currentQuestion);
        }
    }

    applyVersionRandomization(versions, versionOrder) {
        // Add null checks to prevent crashes
        if (!versions) {
            console.error('applyVersionRandomization: versions parameter is null');
            return {};
        }
        
        if (!versionOrder) {
            console.error('applyVersionRandomization: versionOrder parameter is null');
            return versions; // Return original versions if no randomization available
        }
        
        // Get current trial to determine the comparison setup
        const currentTrial = this.trials[this.currentQuestion];
        
        if (!currentTrial || !currentTrial.comparisonSetup) {
            console.error('applyVersionRandomization: No comparison setup found for trial', this.currentQuestion);
            return versions;
        }
        
        const { leftVersion, rightVersion } = currentTrial.comparisonSetup;
        
        // 🔍 DEBUG: Check if raw version is truly unprocessed
        console.log('🔍 DEBUG: Checking raw version integrity...');
        if (versions.raw) {
            const rawEnergy = this._computeEnergy(versions.raw);
            console.log('🔍 Raw version check:', {
                type: typeof versions.raw,
                isFloat32Array: versions.raw instanceof Float32Array,
                length: versions.raw?.length,
                energy: rawEnergy.toFixed(6),
                hasData: versions.raw && versions.raw.length > 0
            });
            
            // Compare with other versions to see if raw is actually processed
            for (const [ver, data] of Object.entries(versions)) {
                if (ver === 'raw') continue;
                const verEnergy = this._computeEnergy(data);
                const energyDiff = Math.abs(rawEnergy - verEnergy);
                const isSameAsRaw = this._arraysEqual(data, versions.raw);
                
                console.log(`🔍 Raw vs ${ver}:`, {
                    energyDiff: energyDiff.toFixed(6),
                    isSameAsRaw,
                    rawIsActuallyProcessed: isSameAsRaw && ver !== 'raw'
                });
                
                if (isSameAsRaw && ver !== 'raw') {
                    console.error(`❌ CRITICAL BUG: Raw version is identical to ${ver} - raw is being processed!`);
                }
            }
        } else {
            console.error('❌ CRITICAL BUG: No raw version found in versions object!');
        }
        
        // 🔍 DEBUG: Let's see exactly what we're working with
        console.log('🔍 Raw versions object:', versions);
        console.log('🔍 Version keys:', Object.keys(versions));
        console.log('🔍 Looking for:', leftVersion, rightVersion);
        console.log('🔍 Direct version mapping:', {
            leftVersion,
            rightVersion,
            availableVersions: Object.keys(versions),
            leftExists: leftVersion in versions,
            rightExists: rightVersion in versions,
            leftValue: versions[leftVersion],
            rightValue: versions[rightVersion]
        });
        
        // The audio processor returns versions with keys ['raw', 'light', 'medium', 'deep']
        // So we can access them directly by version name
        const randomized = {
            left: versions[leftVersion],
            right: versions[rightVersion]
        };
        
        // 🔍 Verify we got actual audio data
        console.log('🔍 Randomized version check:', {
            leftType: typeof randomized.left,
            rightType: typeof randomized.right,
            leftIsFloat32: randomized.left instanceof Float32Array,
            rightIsFloat32: randomized.right instanceof Float32Array,
            leftLength: randomized.left?.length,
            rightLength: randomized.right?.length
        });
        
        // CRITICAL: Store the final mapping in the session for later translation
        // Ensure question data exists before storing mapping
        if (!window.voiceQuizApp.session.questions[this.currentQuestion]) {
            window.voiceQuizApp.session.add({
                index: this.currentQuestion,
                urls: {},
                processed: {},
                selectedVersion: null,
                reasons: [],
                randomizedVersions: null
            });
        }
        const currentQuestionData = window.voiceQuizApp.session.questions[this.currentQuestion];
        if (currentQuestionData) {
            currentQuestionData.randomizedVersions = {
                left: leftVersion,
                right: rightVersion
            };
            
            // Also store trial info for context
            currentQuestionData.trialType = currentTrial.type;
            currentQuestionData.isCatch = currentTrial.isCatch;
            currentQuestionData.comparisonSetup = currentTrial.comparisonSetup;
            
            console.log(`🎯 Question ${this.currentQuestion + 1} mapping stored:`, {
                left: leftVersion,
                right: rightVersion,
                trialType: currentTrial.type,
                isCatch: currentTrial.isCatch,
                comparisonSetup: currentTrial.comparisonSetup
            });
        } else {
            console.error('⚠️ No currentQuestionData found for question', this.currentQuestion);
        }
        
        // DEBUG: Log the clean randomized object
        console.log('🎲 Counter-balanced randomization applied:', {
            questionIndex: this.currentQuestion,
            trialType: currentTrial.type,
            isCatch: currentTrial.isCatch,
            leftVersion: leftVersion,
            rightVersion: rightVersion,
            randomizedKeys: Object.keys(randomized),
            availableVersions: Object.keys(versions)
        });
        
        // Return clean randomized object with left/right keys mapping to Float32Arrays
        return randomized;
    }

    // Helper methods for debugging
    _computeEnergy(buffer) {
        if (!buffer || !buffer.length) return 0;
        let sum = 0;
        for (let i = 0; i < buffer.length; i++) {
            sum += Math.abs(buffer[i]);
        }
        return sum;
    }

    _arraysEqual(a, b) {
        if (!a || !b) return false;
        if (a.length !== b.length) return false;
        for (let i = 0; i < a.length; i++) {
            if (Math.abs(a[i] - b[i]) > 0.000001) return false;
        }
        return true;
    }

    async deleteOriginalRecording() {
        // CRITICAL: Delete original recording for privacy compliance
        this.currentRecording = null;
        
        // Force garbage collection
        if (window.gc) {
            window.gc();
        }
        
        console.log('Original recording deleted for privacy compliance');
    }

    showProcessingPage() {
        this.hideAllScreens();
        const processingPage = document.getElementById('processing-page');
        if (processingPage) {
            processingPage.classList.add('active');
        } else {
            console.error('processing-page element not found');
        }
        
        // Update processing status
        const processingStatus = document.getElementById('processing-status');
        if (processingStatus) {
            processingStatus.textContent = `Processing question ${this.currentQuestion + 1} of ${this.trials.length}`;
        }
        
        // Animate progress bar
        this.animateProcessingProgress();
    }

    animateProcessingProgress() {
        const progressBar = document.getElementById('processing-progress');
        if (!progressBar) {
            console.error('processing-progress element not found');
            return;
        }
        
        let width = 0;
        
        const interval = setInterval(() => {
            width += 2;
            progressBar.style.width = width + '%';
            
            if (width >= 100) {
                clearInterval(interval);
            }
        }, 50);
    }

    showComparisonPage() {
        console.log(`🎯 Setting up comparison page for question ${this.currentQuestion + 1}`);
        
        // CRITICAL: Stop all audio and clean up previous question
        this.stopAllAudio();
        
        // Clean up old keyboard handler
        if (this.keyboardHandler) {
            document.removeEventListener('keydown', this.keyboardHandler);
            this.keyboardHandler = null;
        }
        
        this.hideAllScreens();
        const comparisonPage = document.getElementById('comparison-page');
        if (comparisonPage) {
            comparisonPage.classList.add('active');
        } else {
            console.error('comparison-page element not found');
        }
        
        // Update question counter
        const comparisonQuestionCounter = document.getElementById('comparison-question-counter');
        if (comparisonQuestionCounter) {
            comparisonQuestionCounter.textContent = `Question ${this.currentQuestion + 1} of ${this.trials.length}`;
        }
        
        // Store current trial info for later use
        this.currentTrial = this.trials[this.currentQuestion];
        
        // Show attention check notice if this is a catch trial
        const attentionCheckNotice = document.getElementById('attention-check-notice');
        if (attentionCheckNotice) {
            if (this.currentTrial.isCatch) {
                attentionCheckNotice.style.display = 'block';
                console.log('⚠️ Showing attention check notice for catch trial');
            } else {
                attentionCheckNotice.style.display = 'none';
            }
        }
        
        // Reset comparison UI completely
        this.resetComparisonUI();
        
        // Wire up ALL event listeners fresh for this question
        this.wireComparisonEventListeners();
        
        // Wire up submit feedback button
        const submitBtn = document.getElementById('submit-feedback');
        if (submitBtn) {
            submitBtn.onclick = () => this.handleSubmitFeedback();
        }
        
        console.log(`✅ Comparison page ready for question ${this.currentQuestion + 1}`);
    }

    resetComparisonUI() {
        console.log('🧹 Resetting comparison UI completely');
        
        // Reset choice cards using IDs
        const cardLeft = document.getElementById('card-left');
        const cardRight = document.getElementById('card-right');
        if (cardLeft) {
            cardLeft.classList.remove('selected');
            cardLeft.style.opacity = '1';
            cardLeft.style.cursor = 'pointer';
        }
        if (cardRight) {
            cardRight.classList.remove('selected');
            cardRight.style.opacity = '1';
            cardRight.style.cursor = 'pointer';
        }
        
        // Reset play buttons
        const playButtons = document.querySelectorAll('.play-button');
        playButtons.forEach(btn => {
            btn.disabled = false;
            btn.style.opacity = '1';
            btn.style.cursor = 'pointer';
            btn.textContent = '▶️';
            btn.classList.remove('playing');
        });
        
        // Reset select buttons
        const selectButtons = document.querySelectorAll('.select-button');
        selectButtons.forEach(btn => {
            btn.disabled = false;
            btn.style.opacity = '1';
            btn.style.cursor = 'pointer';
            btn.classList.remove('hidden');
        });
        
        // Hide checkmarks
        const checkmarks = document.querySelectorAll('.checkmark');
        checkmarks.forEach(checkmark => {
                if (checkmark) {
                    checkmark.classList.add('hidden');
            }
        });
        
        // Hide version labels for all questions during reset
        const labelLeft = document.getElementById('label-left');
        const labelRight = document.getElementById('label-right');
        if (labelLeft) labelLeft.textContent = '\u00A0';
        if (labelRight) labelRight.textContent = '\u00A0';
        
        // Show selection instructions - DISABLED
        // const instructions = document.getElementById('selection-instructions');
        // if (instructions) {
        //     instructions.style.display = 'block';
        // }
        
        // Reset feedback section
        const feedbackSection = document.getElementById('feedback-section');
        if (feedbackSection) {
            feedbackSection.classList.add('opacity-50');
            feedbackSection.querySelectorAll('input, textarea, button').forEach(el => {
                el.disabled = true;
            });
        }
        
        // Reset feedback checkboxes
        const feedbackCheckboxes = document.querySelectorAll('input[name="reason"]');
        feedbackCheckboxes.forEach(cb => {
            cb.checked = false;
        });
        
        // Reset all feedback tag selections
        document.querySelectorAll('.feedback-tag').forEach(tag => tag.classList.remove('selected'));
        
        // Clear feedback text
        const feedbackComment = document.getElementById('feedback-comment');
        if (feedbackComment) {
            feedbackComment.value = '';
        }
        
        // Reset submit button
        const submitBtn = document.getElementById('submit-feedback');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Submit Feedback & Continue';
        }
        
        // Reset playing info
        const playingInfo = document.getElementById('playing-info');
        if (playingInfo) {
            playingInfo.innerHTML = '<span class="text-aura-secondary">No audio playing</span>';
        }
        
        // Clear canvas
        const canvas = document.getElementById('waveform-canvas');
        if (canvas) {
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = 'rgb(31, 41, 55)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
        
        // Reset all state flags
        this.selectedChoice = null;
        this.choiceMade = false;
        this.submitted = false;
        this.currentlyPlayingAudio = null;
        this.currentlyPlayingVersion = null;
        this.currentAudioUrl = null;
        
        console.log('✅ Comparison UI reset complete');
    }

    selectChoice(choice) {
        // Prevent double-clicks
        if (this.choiceMade) {
            console.log('🔄 Ignoring selectChoice call - choice already made');
            return;
        }
        
        const selectionTime = Date.now();
        
        // ANALYTICS: Track selection behavior
        this.trackSelectionBehavior(choice, selectionTime);
        
        this.selectedChoice = choice;
        this.choiceMade = choice;
        
        // Stop any currently playing audio
        this.stopAllAudio();
        
        // Update UI - remove previous selections
        const choiceCards = document.querySelectorAll('.choice-card');
        choiceCards.forEach(card => {
            if (card) {
                card.classList.remove('selected');
                const checkmark = card.querySelector('.checkmark');
                const selectButton = card.querySelector('.select-button');
                
                if (checkmark) {
                    checkmark.classList.add('hidden');
                }
                if (selectButton) {
                    selectButton.classList.add('hidden');
                }
            }
        });
        
        // Highlight selected choice using ID
        const selectedCard = document.getElementById(`card-${choice}`);
        if (selectedCard) {
            selectedCard.classList.add('selected');
            const checkmark = selectedCard.querySelector('.checkmark');
            if (checkmark) {
                checkmark.classList.remove('hidden');
            }
        }
        
        // Hide selection instructions - DISABLED
        // const instructions = document.getElementById('selection-instructions');
        // if (instructions) {
        //     instructions.style.display = 'none';
        // }
        
        // CRITICAL: NEVER reveal variant labels during the quiz - maintain blind comparison
        // this.revealVariantLabels(); // REMOVED - labels must stay hidden for research integrity
        
        // Enable the feedback section
        const feedbackSection = document.getElementById('feedback-section');
        if (feedbackSection) {
            feedbackSection.classList.remove('opacity-50');
            feedbackSection.querySelectorAll('input, textarea, button').forEach(el => {
                el.disabled = false;
            });
        }
        
        // CRITICAL: Store selection in session with actual version name
        const currentQuestionData = window.voiceQuizApp.session.questions[this.currentQuestion];
        const currentTrial = this.trials[this.currentQuestion];
        
        // 🕵️ DEBUG: Full diagnostic before accessing randomizedVersions
        console.log('🔍 === FULL DIAGNOSTIC START ===');
        console.log('🔍 Current question index:', this.currentQuestion);
        console.log('🔍 Session questions array length:', window.voiceQuizApp.session.questions.length);
        console.log('🔍 currentQuestionData exists:', !!currentQuestionData);
        console.log('🔍 currentQuestionData full object:', currentQuestionData);
        console.log('🔍 All session questions:', window.voiceQuizApp.session.questions);
        
        if (currentQuestionData) {
            console.log('🔍 randomizedVersions exists:', !!currentQuestionData.randomizedVersions);
            console.log('🔍 randomizedVersions value:', currentQuestionData.randomizedVersions);
            console.log('🔍 randomizedVersions type:', typeof currentQuestionData.randomizedVersions);
            console.log('🔍 Other properties:');
            console.log('   - urls:', !!currentQuestionData.urls);
            console.log('   - processed:', !!currentQuestionData.processed);
            console.log('   - selectedVersion:', currentQuestionData.selectedVersion);
            console.log('   - trialType:', currentQuestionData.trialType);
            console.log('   - isCatch:', currentQuestionData.isCatch);
            console.log('   - comparisonSetup:', currentQuestionData.comparisonSetup);
        }
        console.log('🔍 === FULL DIAGNOSTIC END ===');
        
        if (currentQuestionData) {
            currentQuestionData.selectedChoice = choice; // Store the UI choice (left/right)
            currentQuestionData.trialType = currentTrial.type;
            currentQuestionData.isCatch = currentTrial.isCatch;
            
            // CRITICAL: Translate left/right choice to actual version name
            console.log('🔍 selectChoice debug:', {
                questionIndex: this.currentQuestion,
                hasRandomizedVersions: !!currentQuestionData.randomizedVersions,
                randomizedVersions: currentQuestionData.randomizedVersions,
                choice: choice
            });
            
            if (currentQuestionData.randomizedVersions) {
                const actualVersion = currentQuestionData.randomizedVersions[choice];
                currentQuestionData.selectedVersion = actualVersion;
                
                // Enhanced analytics for counter-balanced trials
                if (currentTrial.comparisonSetup) {
                    const { leftVersion, rightVersion, correctAnswer } = currentTrial.comparisonSetup;
                    const selectedProcessing = choice === 'left' ? leftVersion : rightVersion;
                    const isCorrectSide = (choice === 'left' && correctAnswer === 'left') || 
                                         (choice === 'right' && correctAnswer === 'right');
                    
                    console.log(`🎯 Counter-balanced trial result:`, {
                        question: this.currentQuestion + 1,
                        processingMode: currentTrial.type,
                        selectedSide: choice,
                        selectedProcessing: selectedProcessing,
                        comparison: `${leftVersion} vs ${rightVersion}`,
                        preferredProcessed: selectedProcessing !== 'raw',
                        isCatch: currentTrial.isCatch,
                        correctAnswer: correctAnswer,
                        isCorrectSide: currentTrial.isCatch ? 'N/A' : isCorrectSide
                    });
                }
                
                console.log(`✅ Question ${this.currentQuestion + 1} choice recorded:`, {
                    uiChoice: choice,
                    actualVersion: actualVersion,
                    trialType: currentQuestionData.trialType,
                    isCatch: currentQuestionData.isCatch,
                    mapping: currentQuestionData.randomizedVersions
                });
            } else {
                console.error('⚠️ No randomizedVersions mapping found for question', this.currentQuestion);
                console.error('⚠️ This means the version mapping was not properly stored during randomization');
                currentQuestionData.selectedVersion = choice; // Fallback to left/right
            }
        } else {
            console.error('⚠️ No currentQuestionData found for question', this.currentQuestion);
        }
        
        console.log(`✅ Choice selected: ${choice} for trial type: ${currentTrial.type}`);
    }

    playChoice(choice) {
        // Prevent playing after choice is made
        if (this.choiceMade) {
            console.log('🔄 Ignoring playChoice call - choice already made');
            return;
        }
        
        // Stop any currently playing audio
            this.stopAllAudio();
            
        const currentQuestionData = window.voiceQuizApp.session.questions[this.currentQuestion];
        if (!currentQuestionData || !currentQuestionData.urls) {
            console.error('No audio URLs available for this question');
            return;
        }
        
        const audioUrl = currentQuestionData.urls[choice];
        if (!audioUrl) {
            console.error(`No audio URL found for choice: ${choice}`);
            return;
        }
        
        // Create new audio element
        const audio = new Audio(audioUrl);
        audio.preload = 'auto';
        
        // Track this audio for cleanup
            this.currentlyPlayingAudio = audio;
        this.currentlyPlayingVersion = choice;
        this.currentAudioUrl = audioUrl;
        
        // Add to tracking sets
        this.audioUrls.add(audioUrl);
        
        // Set up audio visualization
        this.setupAudioVisualization(audio);
        
        // Set up event listeners
        audio.addEventListener('ended', () => {
            console.log(`🎵 Audio ended for choice: ${choice}`);
            this.currentlyPlayingAudio = null;
            this.currentlyPlayingVersion = null;
            this.stopAudioVisualization();
        });
        
        audio.addEventListener('error', (e) => {
            console.error(`❌ Audio error for choice ${choice}:`, e);
            this.currentlyPlayingAudio = null;
            this.currentlyPlayingVersion = null;
            this.stopAudioVisualization();
        });
        
        // Start playback
        audio.play().then(() => {
            console.log(`🎵 Playing choice: ${choice}`);
            
            // Update UI to show which choice is playing
            const playingInfo = document.getElementById('playing-info');
            if (playingInfo) {
                const choiceLabel = choice === 'left' ? 'Left Audio' : 'Right Audio';
                playingInfo.innerHTML = `<span class="text-blue-400">🎵 Playing: ${choiceLabel}</span>`;
            }
            
            // Update current version tracking
            this.currentlyPlayingVersion = choice;
            
            // Track playback time
            const playTime = Date.now();
            if (!this.selectionBehaviorData.playbackTimes[choice]) {
                this.selectionBehaviorData.playbackTimes[choice] = [];
            }
            this.selectionBehaviorData.playbackTimes[choice].push(playTime);
            
        }).catch(error => {
            console.error(`❌ Failed to play choice ${choice}:`, error);
            this.currentlyPlayingAudio = null;
            this.currentlyPlayingVersion = null;
            this.stopAudioVisualization();
        });
    }

    setupAudioVisualization(audio) {
        try {
            const canvas = document.getElementById('waveform-canvas');
            if (!canvas) {
                console.warn('Waveform canvas not found');
                return;
            }
            
            const ctx = canvas.getContext('2d');
            
            // Use the same AudioContext that Superpowered is using to avoid conflicts
            const audioCtx = window.audioProcessor?.audioContext || window.voiceQuizApp?.audioContext || new (window.AudioContext || window.webkitAudioContext)();
            
            // Resume audio context if suspended (required by modern browsers)
            if (audioCtx.state === 'suspended') {
                audioCtx.resume().then(() => {
                    console.log('✅ AudioContext resumed for visualization');
                }).catch(error => {
                    console.error('❌ Failed to resume AudioContext:', error);
                });
            }
            
            const source = audioCtx.createMediaElementSource(audio);
            const analyser = audioCtx.createAnalyser();
            
            // Configure analyser for better visualization
            analyser.fftSize = 2048; // Higher resolution for smoother waveform
            const bufferLength = analyser.frequencyBinCount;
            
            source.connect(analyser);
            analyser.connect(audioCtx.destination);
            
            // Store for cleanup
            this.visualizationData = {
                canvas,
                ctx,
                analyser,
                audioCtx,
                source,
                bufferLength,
                rafId: null
            };
            
                    // Start drawing
        this.drawWaveform();
        
        // Start the animation loop for continuous updates
        this.startWaveformAnimation();
            
        } catch (error) {
            console.error('Failed to setup audio visualization:', error);
        }
    }

    drawWaveform() {
        if (!this.visualizationData) return;
        
        const { canvas, ctx, analyser, bufferLength } = this.visualizationData;
        
        const dataArray = new Uint8Array(bufferLength);
        analyser.getByteTimeDomainData(dataArray);
        
        // Clear canvas
        ctx.fillStyle = 'rgb(31, 41, 55)'; // Dark background
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        

        
        // Draw waveform with gradient
        const gradient = ctx.createLinearGradient(0, 0, canvas.width, 0);
        gradient.addColorStop(0, 'rgb(66, 153, 225)'); // Blue
        gradient.addColorStop(0.5, 'rgb(147, 197, 253)'); // Light blue
        gradient.addColorStop(1, 'rgb(59, 130, 246)'); // Dark blue
        
        ctx.lineWidth = 3;
        ctx.strokeStyle = gradient;
        ctx.lineCap = 'round';
        ctx.beginPath();
        
        const sliceWidth = canvas.width * 1.0 / bufferLength;
        let x = 0;
        
        for (let i = 0; i < bufferLength; i++) {
            const v = dataArray[i] / 128.0;
            const y = (v * canvas.height / 2) + (canvas.height / 2);
            
            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
            
            x += sliceWidth;
        }
        
        ctx.stroke();
        
        // Draw center line
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, canvas.height / 2);
        ctx.lineTo(canvas.width, canvas.height / 2);
        ctx.stroke();
        
        // Continue animation
        this.visualizationData.rafId = requestAnimationFrame(() => this.drawWaveform());
    }
    


    stopAudioVisualization() {
        if (this.visualizationData) {
            if (this.visualizationData.rafId) {
                cancelAnimationFrame(this.visualizationData.rafId);
                this.visualizationData.rafId = null;
            }
            
            // Disconnect audio nodes
            if (this.visualizationData.analyser) {
                this.visualizationData.analyser.disconnect();
            }
            if (this.visualizationData.source) {
                this.visualizationData.source.disconnect();
            }
            
            // Clear canvas
            const { canvas, ctx } = this.visualizationData;
            if (canvas && ctx) {
                ctx.fillStyle = 'rgb(31, 41, 55)';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
            }
            
            this.visualizationData = null;
        }
        

    }

    stopAllAudio() {
        console.log('🔇 Stopping all audio playback...');
        
        // Stop any HTML Audio elements
        document.querySelectorAll('audio').forEach(audio => {
            if (!audio.paused) {
                console.log('🔇 Stopping HTML audio element');
                audio.pause();
                audio.currentTime = 0;
            }
        });
        
        // Stop app's audio references
        if (this.currentlyPlayingAudio) {
            console.log('🔇 Stopping currently playing audio');
            this.currentlyPlayingAudio.pause();
            this.currentlyPlayingAudio.currentTime = 0;
            this.currentlyPlayingAudio = null;
        }
        
        // Clear current audio URL reference (but don't revoke - URLs are managed per question)
        if (this.currentAudioUrl) {
            console.log('🔇 Clearing current audio URL reference');
            this.currentAudioUrl = null;
        }
        
        // Reset all play button states
        document.querySelectorAll('.play-button').forEach(btn => {
            btn.textContent = '▶️';
            btn.classList.remove('playing');
        });
        
        // Clear playing version tracking
        this.currentlyPlayingVersion = null;
        
        // Stop audio visualization
        this.stopAudioVisualization();
        
        // Reset playing info
        const playingInfo = document.getElementById('playing-info');
        if (playingInfo) {
            playingInfo.innerHTML = '<span class="text-aura-secondary">No audio playing</span>';
        }
        
        // Clear canvas
        const canvas = document.getElementById('waveform-canvas');
        if (canvas) {
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = 'rgb(31, 41, 55)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
        
        // Clean up UI state
        if (window.uiController) {
            // Hide playing state for any version
            ['left', 'right'].forEach(choice => {
                window.uiController.hidePlayingState(choice);
            });
        }
        
        console.log('✅ All audio stopped and UI reset');
    }

    toggleFeedbackTag(tagElement) {
        tagElement.classList.toggle('selected');
    }

    async nextQuestion() {
        console.log('🔄 nextQuestion() called for question:', this.currentQuestion);
        
        // Prevent multiple simultaneous calls
        if (this.isMovingToNext) {
            console.log('🔄 Ignoring nextQuestion call - already moving to next question');
            return;
        }

        this.isMovingToNext = true;
        
        try {
            // Check both local state and session state
            const currentQuestionData = window.voiceQuizApp.session.questions[this.currentQuestion];
            if (!this.selectedChoice || !currentQuestionData || !currentQuestionData.selectedChoice) {
                this.showError('Please select a choice before continuing.');
                this.isMovingToNext = false;
                return;
            }
            
            // Record response time and feedback
            const responseTime = (Date.now() - this.startTime) / 1000;
            const feedback = this.collectFeedback();
            
            // Get trial information
            const currentTrial = this.trials[this.currentQuestion];
            const selectedChoice = this.selectedChoice;
            const isCatch = currentTrial.isCatch;
            
            // 🔧 FIXED: Get the actual processing type that was selected
            let actualProcessingType = currentTrial.type; // Default fallback
            
            // Get the actual version that was selected from the session data
            // Note: currentQuestionData is already declared above, so we reuse it
            if (currentQuestionData && currentQuestionData.selectedVersion) {
                actualProcessingType = currentQuestionData.selectedVersion;
                console.log(`🔧 FIXED: Actual processing type for question ${this.currentQuestion + 1}:`, {
                    uiChoice: selectedChoice,
                    actualVersion: currentQuestionData.selectedVersion,
                    trialType: currentTrial.type,
                    isCatch: isCatch
                });
            } else {
                console.warn(`⚠️ No selectedVersion found for question ${this.currentQuestion + 1}, using trial type as fallback`);
            }
            
            // Record the response with CORRECT actual processing type
            await window.userManager.recordResponse(
                this.currentQuestion,
                selectedChoice,
                actualProcessingType,  // 🔧 FIXED: Use actual processing type, not trial type
                responseTime,
                feedback,
                isCatch
            );

            // DEBUG: Verify version mapping before moving to next question
            console.log(`🔍 Verifying version mapping for question ${this.currentQuestion + 1}:`);
            if (currentQuestionData) {
                console.log('✅ Final question data:', {
                    uiChoice: currentQuestionData.selectedChoice,
                    actualVersion: currentQuestionData.selectedVersion,
                    trialType: currentQuestionData.trialType,
                    isCatch: currentQuestionData.isCatch,
                    versionMapping: currentQuestionData.randomizedVersions
                });
            }

            // Clean up current question
            await this.completeQuestionCleanup();

            // Move to next question
            this.currentQuestion++;
            
            if (this.currentQuestion < this.trials.length) {
                // Show recording page for next question
                this.showRecordingPage();
                this.updateQuestionDisplay();
                
                // The flow will continue when recording is processed:
                // processRecording() -> handleQuestionProcessed() -> showComparisonPage()
                console.log(`✅ Moved to question ${this.currentQuestion + 1}, ready for recording`);
            } else {
                // Quiz completed
                await this.completeQuiz();
            }

        } catch (error) {
            console.error('Error in nextQuestion:', error);
            this.showError('An error occurred while processing your response. Please try again.');
        } finally {
            this.isMovingToNext = false;
        }
    }

    async deleteProcessedVersions() {
        // Delete all processed versions for privacy compliance
        if (this.processedVersions) {
            Object.keys(this.processedVersions).forEach(version => {
                if (this.processedVersions[version]) {
                    URL.revokeObjectURL(this.processedVersions[version]);
                }
            });
            this.processedVersions = null;
        }
        
        // Force garbage collection
        if (window.gc) {
            window.gc();
        }
        
        console.log('Processed versions deleted for privacy compliance');
    }

    collectFeedback() {
        const selectedTags = Array.from(document.querySelectorAll('.feedback-tag.selected'))
            .map(tag => tag.dataset.tag);
        
        const feedbackText = document.getElementById('feedback-text');
        const feedbackTextValue = feedbackText ? feedbackText.value.trim() : '';
        
        return {
            tags: selectedTags,
            text: feedbackTextValue
        };
    }

    async completeQuiz() {
        try {
            // Complete the study
            await window.userManager.completeStudy();
            
            // Send webhook data to Make.com
            await this.sendWebhookData();
            
            // Show results
            this.showResultsPage();
            
        } catch (error) {
            console.error('Error completing quiz:', error);
            this.showError('Failed to complete the quiz. Please try again.');
        }
    }

    async sendWebhookData() {
        try {
            // Get user data
            const userData = window.userManager.getUserData();
            const responses = window.userManager.getAllResponses();
            
            // Add trial type information to responses
            const enhancedResponses = responses.map((response, index) => {
                const trial = this.trials && this.trials[index];
                return {
                    ...response,
                    trialType: trial ? trial.type : 'unknown',
                    isCatch: trial ? trial.isCatch : false
                };
            });
            
            // Prepare session data for webhook
            const sessionData = {
                sessionId: window.userManager.sessionId,
                userEmail: userData.email,
                firstName: userData.firstName,
                lastName: userData.lastName,
                startTime: window.userManager.startTime || Date.now(),
                totalDuration: window.userManager.getStudyProgress()?.totalDuration || 0,
                deviceInfo: window.userManager.deviceInfo,
                versionOrder: window.userManager.versionOrder,
                responses: enhancedResponses
            };

            // Send webhook
            const result = await window.webhookService.sendSessionData(sessionData);
            
            if (result.success) {
                console.log('✅ Webhook sent successfully');
            } else {
                console.warn('⚠️ Webhook failed:', result.error);
            }

        } catch (error) {
            console.error('❌ Error sending webhook:', error);
            // Don't throw error to avoid breaking the completion flow
        }
    }

    showResultsPage() {
        // CRITICAL: Stop all audio when moving to results page
        this.stopAllAudio();
        
        this.hideAllScreens();
        const resultsPage = document.getElementById('results-page');
        if (resultsPage) {
            resultsPage.classList.add('active');
        } else {
            console.error('results-page element not found');
        }
        
        // Export session data
        const results = window.voiceQuizApp.session.questions.map(q => ({
            index: q.index,
            selectedVersion: q.selectedVersion,
            reasons: q.reasons
        }));
        console.log('Export payload →', results);
        
        // Generate and display results
        const analytics = window.userManager.getAnalytics();
        this.displayResults(analytics);
    }

    displayResults(analytics) {
        // Hide all other screens/containers
        this.hideAllScreens();
        // Show the thank-you card
        const thankyou = document.getElementById('thankyou-screen');
        if (thankyou) thankyou.classList.remove('hidden');
    }

    getVersionLabel(versionType) {
        // Find which label (A, B, C, D) corresponds to this version type
        const versionOrder = window.userManager.versionOrder;
        for (const [label, type] of Object.entries(versionOrder)) {
            if (type === versionType) {
                return label;
            }
        }
        return 'A';
    }

    formatFeedbackTag(tag) {
        const tagNames = {
            natural: 'Sounds most natural',
            familiar: 'Feels familiar to me',
            clear: 'Clearest to listen to',
            warm: 'Warm and pleasant',
            confident: 'Makes me sound confident',
            inner: 'Matches my inner voice'
        };
        return tagNames[tag] || tag;
    }

    downloadResults() {
        try {
            // Create CSV content with enhanced headers
            let csvContent = 'Question,UI Choice,Actual Version,Trial Type,Is Catch Trial,Version Mapping,Reasons,Comments\n';
            
            // Add each question's data
            this.session.questions.forEach((question, index) => {
                if (index < this.trials.length) {
                    const trial = this.trials[index];
                    const reasons = question.reasons ? question.reasons.join('; ') : '';
                    const comments = question.comment ? question.comment.replace(/"/g, '""') : ''; // Escape quotes
                    
                    // Get the actual version name (should be 'raw', 'light', 'medium', or 'deep')
                    const actualVersion = question.selectedVersion || question.selectedChoice;
                    
                    // Get the version mapping for debugging
                    const versionMapping = question.randomizedVersions ? 
                        `left:${question.randomizedVersions.left},right:${question.randomizedVersions.right}` : 
                        'No mapping';
                    
                    csvContent += `"${index + 1}","${question.selectedChoice || 'N/A'}","${actualVersion}","${trial.type}","${trial.isCatch}","${versionMapping}","${reasons}","${comments}"\n`;
                    
                    // Log each question's data for verification
                    console.log(`📊 Question ${index + 1} export data:`, {
                        uiChoice: question.selectedChoice,
                        actualVersion: actualVersion,
                        trialType: trial.type,
                        isCatch: trial.isCatch,
                        versionMapping: question.randomizedVersions,
                        reasons: reasons,
                        comments: comments
                    });
                }
            });
            
            // Add summary data
            csvContent += '\nSummary\n';
            csvContent += 'Total Questions,7\n';
            csvContent += 'Completed Questions,' + this.session.questions.length + '\n';
            csvContent += 'Start Time,' + (this.session.startTime || 'Unknown') + '\n';
            csvContent += 'End Time,' + new Date().toISOString() + '\n';
            
            // Create and download the file
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            
            link.setAttribute('href', url);
            link.setAttribute('download', `voice-quiz-results-${Date.now()}.csv`);
            link.style.visibility = 'hidden';
            
            document.body.appendChild(link);
        link.click();
            document.body.removeChild(link);
            
            // Clean up the URL
            URL.revokeObjectURL(url);
            
            console.log('✅ Results downloaded as CSV');
            
        } catch (error) {
            console.error('❌ Failed to download results:', error);
            this.showError('Failed to download results. Please try again.');
        }
    }

    startNewQuiz() {
        // CRITICAL: Stop all audio when starting new quiz
        this.stopAllAudio();
        
        // COMPREHENSIVE MEMORY CLEANUP for new quiz
        this.completeQuestionCleanup();
        
        // Reset application state
        this.currentQuestion = 0;
        this.currentRecording = null;
        this.processedVersions = null;
        this.selectedVersion = null;
        this.isRegistered = false;
        
        // Clear all tracked URLs and blobs
        this.audioUrls.clear();
        this.audioBlobs.clear();
        
        // Reset analytics data
        this.selectionBehaviorData = {
            playbackTimes: {},
            selectionLatency: {},
            replayCount: {},
            rapidSelections: [],
            interactionTimestamps: []
        };
        
        // Show landing page
        this.hideAllScreens();
        const landingPage = document.getElementById('landing-page');
        if (landingPage) {
            landingPage.classList.add('active');
        } else {
            console.error('landing-page element not found');
        }
        
        console.log('🔄 New quiz started with complete memory reset');
    }

    hideAllScreens() {
        const screens = document.querySelectorAll('.screen');
        screens.forEach(screen => {
            if (screen) {
                screen.classList.remove('active');
            }
        });
    }

    showError(message) {
        // Simple error display - could be enhanced with a modal
        console.error('App Error:', message);
        alert(message);
    }

    // DEBUG: Method to verify version mapping is working correctly
    debugVersionMapping() {
        console.log('🔍 DEBUG: Current version mapping state:');
        console.log('Current question:', this.currentQuestion);
        console.log('Total questions:', this.trials.length);
        
        // Show trial structure
        console.log('🎯 Trial structure:');
        this.trials.forEach((trial, index) => {
            console.log(`Trial ${index + 1}:`, {
                type: trial.type,
                isCatch: trial.isCatch,
                question: trial.question,
                comparisonSetup: trial.comparisonSetup
            });
        });
        
        this.session.questions.forEach((question, index) => {
            console.log(`Question ${index + 1}:`, {
                hasData: !!question,
                selectedChoice: question?.selectedChoice,
                selectedVersion: question?.selectedVersion,
                randomizedVersions: question?.randomizedVersions,
                trialType: question?.trialType,
                isCatch: question?.isCatch,
                comparisonSetup: question?.comparisonSetup
            });
        });
        
        // Check current trial
        if (this.currentQuestion < this.trials.length) {
            const currentTrial = this.trials[this.currentQuestion];
            console.log('Current trial:', {
                type: currentTrial.type,
                isCatch: currentTrial.isCatch,
                question: currentTrial.question,
                comparisonSetup: currentTrial.comparisonSetup
            });
        }
    }

    // 🔧 NEW: Comprehensive trial logic verification
    verifyTrialLogic() {
        console.log('🔍 === TRIAL LOGIC VERIFICATION ===');
        
        if (!this.trials || this.trials.length !== 10) {
            console.error('❌ INVALID: Expected exactly 10 trials, got:', this.trials?.length || 0);
            return false;
        }
        
        let verification = {
            totalTrials: this.trials.length,
            catchTrials: 0,
            realTrials: 0,
            processingModes: {},
            rawSideDistribution: { left: 0, right: 0 },
            errors: []
        };
        
        // Analyze each trial
        this.trials.forEach((trial, index) => {
            const { type, isCatch, comparisonSetup } = trial;
            const { leftVersion, rightVersion } = comparisonSetup || {};
            
            console.log(`🔍 Question ${index + 1}:`, {
                type,
                isCatch,
                leftVersion,
                rightVersion
            });
            
            // Count trial types
            if (isCatch) {
                verification.catchTrials++;
            } else {
                verification.realTrials++;
                verification.processingModes[type] = (verification.processingModes[type] || 0) + 1;
            }
            
            // Verify exactly one raw version per trial
            const hasRawLeft = leftVersion === 'raw';
            const hasRawRight = rightVersion === 'raw';
            const rawCount = (hasRawLeft ? 1 : 0) + (hasRawRight ? 1 : 0);
            
            if (rawCount !== 1) {
                verification.errors.push(`Question ${index + 1}: Expected exactly 1 raw version, got ${rawCount}`);
            }
            
            // Track raw side distribution
            if (hasRawLeft) verification.rawSideDistribution.left++;
            if (hasRawRight) verification.rawSideDistribution.right++;
            
            // Verify catch trial is raw vs raw
            if (isCatch && (leftVersion !== 'raw' || rightVersion !== 'raw')) {
                verification.errors.push(`Question ${index + 1}: Catch trial should be raw vs raw, got ${leftVersion} vs ${rightVersion}`);
            }
            
            // Verify non-catch trials have one processed version
            if (!isCatch) {
                const hasProcessed = leftVersion !== 'raw' || rightVersion !== 'raw';
                if (!hasProcessed) {
                    verification.errors.push(`Question ${index + 1}: Non-catch trial should have one processed version`);
                }
            }
        });
        
        // Verify catch trial count
        if (verification.catchTrials !== 1) {
            verification.errors.push(`Expected exactly 1 catch trial, got ${verification.catchTrials}`);
        }
        
        // Verify processing mode distribution
        const expectedModes = { light: 3, medium: 3, deep: 3 };
        for (const [mode, expected] of Object.entries(expectedModes)) {
            const actual = verification.processingModes[mode] || 0;
            if (actual !== expected) {
                verification.errors.push(`Expected ${expected} ${mode} trials, got ${actual}`);
            }
        }
        
        // Verify raw side distribution is balanced
        const totalRealTrials = verification.realTrials;
        const rawOnLeft = verification.rawSideDistribution.left;
        const rawOnRight = verification.rawSideDistribution.right;
        
        console.log('📊 Trial Distribution Analysis:', {
            totalTrials: verification.totalTrials,
            catchTrials: verification.catchTrials,
            realTrials: verification.realTrials,
            processingModes: verification.processingModes,
            rawSideDistribution: verification.rawSideDistribution,
            rawBalance: `${rawOnLeft}/${totalRealTrials} left, ${rawOnRight}/${totalRealTrials} right`
        });
        
        if (verification.errors.length > 0) {
            console.error('❌ TRIAL LOGIC ERRORS FOUND:');
            verification.errors.forEach(error => console.error('  -', error));
            return false;
        } else {
            console.log('✅ TRIAL LOGIC VERIFICATION PASSED');
            return true;
        }
    }

    // 🔧 NEW: Debug all trial mappings
    debugAllTrialMappings() {
        console.log('🔍 === ALL TRIAL MAPPINGS DEBUG ===');
        
        if (!this.trials) {
            console.error('❌ No trials found');
            return;
        }
        
        console.log('📋 Complete Trial Breakdown:');
        this.trials.forEach((trial, index) => {
            const { type, isCatch, comparisonSetup } = trial;
            const { leftVersion, rightVersion, correctAnswer } = comparisonSetup || {};
            
            console.log(`  Question ${index + 1}:`, {
                type,
                isCatch,
                leftVersion,
                rightVersion,
                correctAnswer,
                description: isCatch ? 'CATCH TRIAL (raw vs raw)' : `${type} vs raw`
            });
        });
        
        // Show processing mode distribution
        const modeCounts = {};
        this.trials.forEach(trial => {
            if (!trial.isCatch) {
                modeCounts[trial.type] = (modeCounts[trial.type] || 0) + 1;
            }
        });
        
        console.log('📊 Processing Mode Distribution:', modeCounts);
        
        // Show raw side distribution
        const rawSideCounts = { left: 0, right: 0 };
        this.trials.forEach(trial => {
            if (!trial.isCatch) {
                if (trial.comparisonSetup.leftVersion === 'raw') rawSideCounts.left++;
                if (trial.comparisonSetup.rightVersion === 'raw') rawSideCounts.right++;
            }
        });
        
        console.log('📊 Raw Side Distribution:', rawSideCounts);
        
        console.log('🔍 === END ALL TRIAL MAPPINGS DEBUG ===');
    }

     // ANALYTICS: Track selection behavior and detect gaming patterns
     trackSelectionBehavior(version, selectionTime) {
        // Calculate selection latency (time since last audio play)
        const lastPlayTime = this.getLastPlayTime(version);
        const selectionLatency = lastPlayTime ? selectionTime - lastPlayTime : null;
        
        // Store selection latency
        if (!this.selectionBehaviorData.selectionLatency[version]) {
            this.selectionBehaviorData.selectionLatency[version] = [];
        }
        if (selectionLatency !== null) {
            this.selectionBehaviorData.selectionLatency[version].push(selectionLatency);
        }
        
        // Detect rapid selections (less than 3 seconds)
        if (selectionLatency !== null && selectionLatency < 3000) {
            this.selectionBehaviorData.rapidSelections.push({
                question: this.currentQuestion + 1,
                version: version,
                latency: selectionLatency,
                timestamp: selectionTime,
                suspicious: selectionLatency < 1000 // Very suspicious if less than 1 second
            });
            
            console.warn(`Rapid selection detected: ${selectionLatency}ms for version ${version}`);
        }
        
        // Track the selection interaction
        this.trackInteraction('version_selected', {
            version: version,
            question: this.currentQuestion + 1,
            selectionLatency: selectionLatency,
            timestamp: selectionTime
        });
    }
    
    // Get the last play time for a specific version
    getLastPlayTime(version) {
        const interactions = this.selectionBehaviorData.interactionTimestamps;
        for (let i = interactions.length - 1; i >= 0; i--) {
            if (interactions[i].action === 'audio_play_start' && interactions[i].data.version === version) {
                return interactions[i].data.timestamp;
            }
        }
        return null;
    }
    
    // Track all user interactions with timestamps
    trackInteraction(action, data) {
        this.selectionBehaviorData.interactionTimestamps.push({
            action: action,
            data: data,
            timestamp: Date.now()
        });
        
        // Keep only last 100 interactions to prevent memory bloat
        if (this.selectionBehaviorData.interactionTimestamps.length > 100) {
            this.selectionBehaviorData.interactionTimestamps = 
                this.selectionBehaviorData.interactionTimestamps.slice(-100);
        }
    }
    
    // Generate analytics summary for research purposes
    getAnalyticsSummary() {
        const summary = {
            totalQuestions: this.currentQuestion,
            rapidSelections: this.selectionBehaviorData.rapidSelections.length,
            suspiciousSelections: this.selectionBehaviorData.rapidSelections.filter(s => s.suspicious).length,
            averageSelectionLatency: this.calculateAverageLatency(),
            replayBehavior: this.selectionBehaviorData.replayCount,
            totalInteractions: this.selectionBehaviorData.interactionTimestamps.length,
            completionTime: Date.now() - (this.startTime || Date.now())
        };
        
        console.log('Analytics Summary:', summary);
        return summary;
    }
    
    // Calculate average selection latency across all versions
    calculateAverageLatency() {
        const allLatencies = [];
        Object.values(this.selectionBehaviorData.selectionLatency).forEach(latencies => {
            allLatencies.push(...latencies);
        });
        
        if (allLatencies.length === 0) return 0;
        return allLatencies.reduce((sum, latency) => sum + latency, 0) / allLatencies.length;
    }


    // ADVANCED ANALYTICS: Track detailed user interaction patterns
    trackDetailedAnalytics() {
        return {
            playbackDuration: this.getPlaybackTimes(),
            selectionLatency: this.getSelectionTimes(),
            replayCount: this.getReplayStatistics(),
            deviceInfo: this.getDeviceMetrics(),
            interactionPatterns: this.getInteractionPatterns(),
            engagementMetrics: this.getEngagementMetrics()
        };
    }
    
    // Get detailed playback time statistics
    getPlaybackTimes() {
        const playbackStats = {};
        Object.keys(this.selectionBehaviorData.playbackTimes).forEach(version => {
            const times = this.selectionBehaviorData.playbackTimes[version];
            if (times.length > 0) {
                playbackStats[version] = {
                    totalPlayTime: times.reduce((sum, time) => sum + time, 0),
                    averagePlayTime: times.reduce((sum, time) => sum + time, 0) / times.length,
                    minPlayTime: Math.min(...times),
                    maxPlayTime: Math.max(...times),
                    playCount: times.length
                };
            }
        });
        return playbackStats;
    }
    
    // Get selection time statistics
    getSelectionTimes() {
        const selectionStats = {};
        Object.keys(this.selectionBehaviorData.selectionLatency).forEach(version => {
            const latencies = this.selectionBehaviorData.selectionLatency[version];
            if (latencies.length > 0) {
                selectionStats[version] = {
                    averageLatency: latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length,
                    minLatency: Math.min(...latencies),
                    maxLatency: Math.max(...latencies),
                    selectionCount: latencies.length
                };
            }
        });
        return selectionStats;
    }
    
    // Get replay statistics
    getReplayStatistics() {
        const replayStats = {};
        Object.keys(this.selectionBehaviorData.replayCount).forEach(version => {
            replayStats[version] = {
                totalReplays: this.selectionBehaviorData.replayCount[version],
                replayRate: this.selectionBehaviorData.replayCount[version] / (this.currentQuestion + 1)
            };
        });
        return replayStats;
    }
    
    // Get device and browser metrics
    getDeviceMetrics() {
        return {
            userAgent: navigator.userAgent,
            platform: navigator.platform,
            language: navigator.language,
            screenResolution: `${screen.width}x${screen.height}`,
            viewportSize: `${window.innerWidth}x${window.innerHeight}`,
            devicePixelRatio: window.devicePixelRatio,
            touchSupport: 'ontouchstart' in window,
            audioContextSupport: !!(window.AudioContext || window.webkitAudioContext),
            mediaRecorderSupport: !!window.MediaRecorder,
            connectionType: navigator.connection ? navigator.connection.effectiveType : 'unknown',
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            timestamp: new Date().toISOString()
        };
    }
    
    // Analyze interaction patterns
    getInteractionPatterns() {
        const interactions = this.selectionBehaviorData.interactionTimestamps;
        const patterns = {
            totalInteractions: interactions.length,
            interactionTypes: {},
            sessionDuration: 0,
            averageTimeBetweenInteractions: 0,
            peakActivityPeriods: []
        };
        
        // Count interaction types
        interactions.forEach(interaction => {
            patterns.interactionTypes[interaction.action] = 
                (patterns.interactionTypes[interaction.action] || 0) + 1;
        });
        
        // Calculate session duration
        if (interactions.length > 1) {
            patterns.sessionDuration = interactions[interactions.length - 1].timestamp - interactions[0].timestamp;
        }
        
        // Calculate average time between interactions
        if (interactions.length > 1) {
            const timeDiffs = [];
            for (let i = 1; i < interactions.length; i++) {
                timeDiffs.push(interactions[i].timestamp - interactions[i-1].timestamp);
            }
            patterns.averageTimeBetweenInteractions = 
                timeDiffs.reduce((sum, diff) => sum + diff, 0) / timeDiffs.length;
        }
        
        return patterns;
    }
    
    // Calculate engagement metrics
    getEngagementMetrics() {
        const totalVersions = 4; // A, B, C, D
        const totalQuestions = this.trials.length;
        const completedQuestions = this.currentQuestion;
        
        return {
            completionRate: completedQuestions / totalQuestions,
            averageVersionsListened: this.calculateAverageVersionsListened(),
            engagementScore: this.calculateEngagementScore(),
            dropoffPoint: completedQuestions < totalQuestions ? completedQuestions + 1 : null,
            timePerQuestion: this.calculateAverageTimePerQuestion(),
            interactionDensity: this.calculateInteractionDensity()
        };
    }
    
    // Calculate average number of versions listened to per question
    calculateAverageVersionsListened() {
        const totalPlays = Object.values(this.selectionBehaviorData.replayCount)
            .reduce((sum, count) => sum + count, 0);
        return this.currentQuestion > 0 ? totalPlays / this.currentQuestion : 0;
    }
    
    // Calculate overall engagement score (0-100)
    calculateEngagementScore() {
        const completionWeight = 0.4;
        const listeningWeight = 0.3;
        const interactionWeight = 0.3;
        
        const completionScore = (this.currentQuestion / this.trials.length) * 100;
        const listeningScore = Math.min(this.calculateAverageVersionsListened() / 2, 1) * 100;
        const interactionScore = Math.min(this.selectionBehaviorData.interactionTimestamps.length / 20, 1) * 100;
        
        return (completionScore * completionWeight + 
                listeningScore * listeningWeight + 
                interactionScore * interactionWeight);
    }
    
    // Calculate average time spent per question
    calculateAverageTimePerQuestion() {
        if (this.currentQuestion === 0) return 0;
        
        const sessionDuration = Date.now() - (this.startTime || Date.now());
        return sessionDuration / this.currentQuestion;
    }
    
    // Calculate interaction density (interactions per minute)
    calculateInteractionDensity() {
        const sessionDuration = Date.now() - (this.startTime || Date.now());
        const sessionMinutes = sessionDuration / (1000 * 60);
        
        return sessionMinutes > 0 ? 
            this.selectionBehaviorData.interactionTimestamps.length / sessionMinutes : 0;
    }
    
    // Export comprehensive analytics data for research
    exportAnalyticsData() {
        const analyticsData = {
            sessionId: this.userManager ? this.userManager.sessionId : 'unknown',
            userId: this.userManager ? this.userManager.userData.email : 'anonymous',
            timestamp: new Date().toISOString(),
            basicAnalytics: this.getAnalyticsSummary(),
            detailedAnalytics: this.trackDetailedAnalytics(),
            rawInteractions: this.selectionBehaviorData.interactionTimestamps,
            versionRandomization: this.versionOrder,
            questionResponses: this.responses || []
        };
        
        console.log('Complete Analytics Data:', analyticsData);
        
        // Analytics data is now sent via webhook in completeStudy()
        // No longer storing locally except for backup purposes
        console.log('Analytics data will be submitted via webhook');
        
        return analyticsData;
    }

    // COMPREHENSIVE MEMORY MANAGEMENT METHODS
    async completeQuestionCleanup() {
        console.log('🧹 Starting complete question cleanup...');
        
        // Log memory before cleanup
        this.logMemoryStatus('Before Cleanup');
        
        // 1. Stop all audio playback
        this.stopAllAudio();
        
        // 2. Delete original recording
        await this.deleteOriginalRecording();
        
        // 3. Delete processed versions
        await this.deleteProcessedVersions();
        
        // 4. Clean up version URLs for current question
        const currentQuestionData = window.voiceQuizApp.session.questions[this.currentQuestion];
        if (currentQuestionData && currentQuestionData.urls) {
            for (const url of Object.values(currentQuestionData.urls)) {
                URL.revokeObjectURL(url);
            }
            delete currentQuestionData.urls;  // keep memory low
            delete currentQuestionData.processed;  // if you don't need raw buffers later
            console.log('✅ Version URLs cleaned up for question', this.currentQuestion);
        }
        
        // 5. Clean up all tracked audio URLs
        this.cleanupAllAudioUrls();
        
        // 6. Clean up all tracked audio blobs
        this.cleanupAllAudioBlobs();
        
        // 7. Reset audio state
        this.resetAudioState();
        
        // 8. Force garbage collection
        this.forceGarbageCollection();
        
        // Log memory after cleanup
        this.logMemoryStatus('After Cleanup');
        
        // Verify cleanup was successful
        this.verifyMemoryCleanup();
        
        console.log('✅ Complete question cleanup finished');
    }
    
    cleanupAllAudioUrls() {
        console.log(`🧹 Cleaning up ${this.audioUrls.size} audio URLs...`);
        this.audioUrls.forEach(url => {
            try {
                URL.revokeObjectURL(url);
                console.log('🔗 Revoked audio URL:', url.substring(0, 50) + '...');
            } catch (error) {
                console.warn('⚠️ Failed to revoke URL:', error);
            }
        });
        this.audioUrls.clear();
        console.log('✅ All audio URLs cleaned up');
    }
    
    cleanupAllAudioBlobs() {
        console.log(`🧹 Cleaning up ${this.audioBlobs.size} audio blobs...`);
        this.audioBlobs.forEach(blob => {
            try {
                // Blobs are automatically garbage collected when no references exist
                console.log('🗑️ Marked audio blob for cleanup:', blob.size + ' bytes');
            } catch (error) {
                console.warn('⚠️ Failed to cleanup blob:', error);
            }
        });
        this.audioBlobs.clear();
        console.log('✅ All audio blobs marked for cleanup');
    }
    
    resetAudioState() {
        console.log('🔄 Resetting audio state...');
        
        // Reset all audio-related properties
        this.currentRecording = null;
        this.processedVersions = null;
        this.currentlyPlayingAudio = null;
        this.currentlyPlayingVersion = null;
        this.currentAudioUrl = null;
        this.selectedVersion = null;
        
        // Reset UI state
        this.resetRecordingUI();
        this.resetComparisonUI();
        
        console.log('✅ Audio state reset complete');
    }
    
    forceGarbageCollection() {
        console.log('🗑️ Forcing garbage collection...');
        
        // Try to force garbage collection if available
        if (window.gc) {
            try {
                window.gc();
                console.log('✅ Garbage collection forced');
            } catch (error) {
                console.warn('⚠️ Failed to force garbage collection:', error);
            }
        } else {
            console.log('ℹ️ Garbage collection not available (requires --expose-gc flag)');
        }
        
        // Alternative: Clear any remaining references
        if (window.audioProcessor && window.audioProcessor.audioContext) {
            // Don't close the AudioContext - keep it for reuse
            console.log('ℹ️ Keeping AudioContext for reuse across questions');
        }
    }
    
    // Enhanced URL tracking for memory management
    createTrackedAudioUrl(blob) {
        const url = URL.createObjectURL(blob);
        this.audioUrls.add(url);
        this.audioBlobs.add(blob);
        console.log(`🔗 Created tracked audio URL: ${url.substring(0, 50)}...`);
        return url;
    }
    
    revokeTrackedAudioUrl(url) {
        if (this.audioUrls.has(url)) {
            URL.revokeObjectURL(url);
            this.audioUrls.delete(url);
            console.log(`🔗 Revoked tracked audio URL: ${url.substring(0, 50)}...`);
        }
    }
    
    // MEMORY MONITORING METHODS
    logMemoryStatus(location = 'Unknown') {
        console.log(`📊 Memory Status [${location}]:`);
        console.log(`   - Tracked URLs: ${this.audioUrls.size}`);
        console.log(`   - Tracked Blobs: ${this.audioBlobs.size}`);
        console.log(`   - Current Recording: ${this.currentRecording ? 'Yes' : 'No'}`);
        console.log(`   - Processed Versions: ${this.processedVersions ? Object.keys(this.processedVersions).length : 0}`);
        console.log(`   - Currently Playing: ${this.currentlyPlayingAudio ? 'Yes' : 'No'}`);
        console.log(`   - Current Audio URL: ${this.currentAudioUrl ? 'Yes' : 'No'}`);
        
        // Log memory usage if available
        if (performance.memory) {
            console.log(`   - Memory Usage: ${Math.round(performance.memory.usedJSHeapSize / 1024 / 1024)}MB / ${Math.round(performance.memory.totalJSHeapSize / 1024 / 1024)}MB`);
        }
        
        console.log(`   - Question: ${this.currentQuestion + 1}/${this.trials.length}`);
    }
    
    // Verify memory is clean between questions
    verifyMemoryCleanup() {
        const issues = [];
        
        if (this.audioUrls.size > 0) {
            issues.push(`${this.audioUrls.size} audio URLs still tracked`);
        }
        
        if (this.audioBlobs.size > 0) {
            issues.push(`${this.audioBlobs.size} audio blobs still tracked`);
        }
        
        if (this.currentRecording) {
            issues.push('Original recording still exists');
        }
        
        if (this.processedVersions) {
            issues.push('Processed versions still exist');
        }
        
        if (this.currentlyPlayingAudio) {
            issues.push('Audio still playing');
        }
        
        if (this.currentAudioUrl) {
            issues.push('Current audio URL still exists');
        }
        
        if (issues.length > 0) {
            console.warn('⚠️ Memory cleanup issues detected:', issues);
            return false;
        } else {
            console.log('✅ Memory cleanup verified - all audio resources released');
            return true;
        }
    }

    revealVariantLabels() {
        const labelLeft = document.getElementById('label-left');
        const labelRight = document.getElementById('label-right');
        const currentTrial = this.trials[this.currentQuestion];
        
        if (labelLeft && labelRight) {
            // Left is always raw
            labelLeft.textContent = 'Raw Version';
            
            // Right depends on trial type
            if (currentTrial.isCatch) {
                labelRight.textContent = 'Raw Version (Catch Trial)';
            } else {
                const versionLabels = {
                    'light': 'Light Processing',
                    'medium': 'Medium Processing', 
                    'deep': 'Deep Processing'
                };
                labelRight.textContent = versionLabels[currentTrial.type] || 'Processed Version';
            }
        }
    }

    wireComparisonEventListeners() {
        console.log('🎯 Wiring comparison event listeners for question', this.currentQuestion + 1);
        
        // Always hide labels to maintain blind comparison
        const labelLeft = document.getElementById('label-left');
        const labelRight = document.getElementById('label-right');
        if (labelLeft) labelLeft.textContent = '\u00A0';
        if (labelRight) labelRight.textContent = '\u00A0';
        
        // Get current question data to ensure URLs exist
        const currentQuestionData = window.voiceQuizApp.session.questions[this.currentQuestion];
        if (!currentQuestionData || !currentQuestionData.urls) {
            console.error('No URLs available for question', this.currentQuestion);
            return;
        }
        
        console.log('🔗 Available URLs for this question:', Object.keys(currentQuestionData.urls));
        
        // Wire up play buttons
        const playLeft = document.getElementById('play-left');
        const playRight = document.getElementById('play-right');
        if (playLeft) {
            playLeft.onclick = () => this.playChoice('left');
            console.log('✅ Wired play-left button');
        }
        if (playRight) {
            playRight.onclick = () => this.playChoice('right');
            console.log('✅ Wired play-right button');
        }
        
        // Wire up select buttons
        const selectLeft = document.getElementById('select-left');
        const selectRight = document.getElementById('select-right');
        if (selectLeft) {
            selectLeft.onclick = () => this.selectChoice('left');
            console.log('✅ Wired select-left button');
        }
        if (selectRight) {
            selectRight.onclick = () => this.selectChoice('right');
            console.log('✅ Wired select-right button');
        }
        
        // Add keyboard shortcuts - DISABLED
        // const handleKeyPress = (event) => {
        //     if (event.key.toLowerCase() === 'l') {
        //         event.preventDefault();
        //         this.playChoice('left');
        //     } else if (event.key.toLowerCase() === 'r') {
        //         event.preventDefault();
        //         this.playChoice('right');
        //     } else if (event.key === '1') {
        //         event.preventDefault();
        //         this.selectChoice('left');
        //     } else if (event.key === '2') {
        //         event.preventDefault();
        //         this.selectChoice('right');
        //     }
        // };
        
        // Remove any existing keyboard handler
        // if (this.keyboardHandler) {
        //     document.removeEventListener('keydown', this.keyboardHandler);
        // }
        
        // Add event listener for keyboard shortcuts
        // document.addEventListener('keydown', handleKeyPress);
        
        // Store the handler for cleanup
        // this.keyboardHandler = handleKeyPress;
        
        console.log('🎯 Event listeners wired for comparison page (keyboard shortcuts disabled)');
    }


    
    handleSubmitFeedback() {
        if (this.submitted) {
            console.log('🔄 Ignoring submit feedback call - already submitted');
            return;
        }
        
        this.submitted = true;
        
        // 1) Gather feedback
        const reasons = Array.from(
            document.querySelectorAll('input[name="reason"]:checked')
        ).map(cb => cb.value);
        const comment = document.getElementById('feedback-comment').value.trim();
        
        // 2) Record full response (choice + feedback)
        const currentQuestionData = window.voiceQuizApp.session.questions[this.currentQuestion];
        if (currentQuestionData) {
            currentQuestionData.reasons = reasons;
            currentQuestionData.comment = comment;
        }
        
        // 3) Proceed directly to next question without showing confirmation toast
        
        // 4) Disable submit button immediately to prevent double-submits
        const submitBtn = document.getElementById('submit-feedback');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Submitted ✓';
        }
        
        console.log(`✅ Feedback submitted for choice: ${this.choiceMade}`, {
            reasons,
            comment: comment.substring(0, 50) + (comment.length > 50 ? '...' : '')
        });
        
        // 5) Proceed to next question after a brief delay
        setTimeout(() => {
            this.nextQuestion();
        }, 500); // Small delay to show the "Submitted ✓" state
    }

    startWaveformAnimation() {
        if (!this.visualizationData) return;
        
        const animate = () => {
            if (this.visualizationData && this.visualizationData.rafId) {
                this.drawWaveform();
                this.visualizationData.rafId = requestAnimationFrame(animate);
            }
        };
        
        this.visualizationData.rafId = requestAnimationFrame(animate);
    }
}


// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    window.voiceQuizApp = new VoiceQuizApp();
    
    // Add global debug functions for testing trial logic
    window.debugVersionMapping = () => {
        if (window.voiceQuizApp) {
            window.voiceQuizApp.debugVersionMapping();
        } else {
            console.log('VoiceQuizApp not initialized yet');
        }
    };
    
    window.debugAllTrialMappings = () => {
        if (window.voiceQuizApp) {
            window.voiceQuizApp.debugAllTrialMappings();
        } else {
            console.log('VoiceQuizApp not initialized yet');
        }
    };
    
    window.verifyTrialLogic = () => {
        if (window.voiceQuizApp) {
            return window.voiceQuizApp.verifyTrialLogic();
        } else {
            console.log('VoiceQuizApp not initialized yet');
            return false;
        }
    };
    
    console.log('🎯 Voice Quiz App initialized with trial logic verification support');
    console.log('💡 Available debug functions:');
    console.log('  - window.debugVersionMapping() - Check current version mapping');
    console.log('  - window.debugAllTrialMappings() - Show all trial breakdowns');
    console.log('  - window.verifyTrialLogic() - Verify trial logic compliance');
});

