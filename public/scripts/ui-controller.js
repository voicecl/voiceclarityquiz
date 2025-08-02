// UI Controller Module
class UIController {
    constructor() {
        this.currentAudio = null;
        this.animationFrameId = null;
        this.isTransitioning = false;
    }

    // Screen transition with smooth animations
    async transitionToScreen(fromScreen, toScreen, duration = 500) {
        if (this.isTransitioning) return;
        
        this.isTransitioning = true;
        
        const fromElement = document.getElementById(`${fromScreen}-page`);
        const toElement = document.getElementById(`${toScreen}-page`);
        
        // Fade out current screen
        if (fromElement) {
            fromElement.style.transition = `opacity ${duration}ms ease-in-out`;
            fromElement.style.opacity = '0';
        }
        
        // Wait for fade out
        await new Promise(resolve => setTimeout(resolve, duration / 2));
        
        // Switch screens
        if (fromElement) {
            fromElement.classList.remove('active');
            fromElement.style.opacity = '1';
        }
        
        toElement.classList.add('active');
        toElement.style.opacity = '0';
        toElement.style.transition = `opacity ${duration}ms ease-in-out`;
        
        // Fade in new screen
        requestAnimationFrame(() => {
            toElement.style.opacity = '1';
        });
        
        // Clean up
        setTimeout(() => {
            toElement.style.transition = '';
            this.isTransitioning = false;
        }, duration);
    }

    // Enhanced button interactions
    addButtonEffects() {
        document.querySelectorAll('button').forEach(button => {
            // Add ripple effect
            button.addEventListener('click', (e) => {
                this.createRippleEffect(e, button);
            });
            
            // Add hover sound feedback (optional)
            button.addEventListener('mouseenter', () => {
                this.playHoverSound();
            });
        });
    }

    createRippleEffect(event, element) {
        const ripple = document.createElement('span');
        const rect = element.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height);
        const x = event.clientX - rect.left - size / 2;
        const y = event.clientY - rect.top - size / 2;
        
        ripple.style.cssText = `
            position: absolute;
            width: ${size}px;
            height: ${size}px;
            left: ${x}px;
            top: ${y}px;
            background: rgba(255, 255, 255, 0.3);
            border-radius: 50%;
            transform: scale(0);
            animation: ripple 0.6s ease-out;
            pointer-events: none;
        `;
        
        // Add ripple animation CSS if not exists
        if (!document.getElementById('ripple-styles')) {
            const style = document.createElement('style');
            style.id = 'ripple-styles';
            style.textContent = `
                @keyframes ripple {
                    to {
                        transform: scale(2);
                        opacity: 0;
                    }
                }
                button {
                    position: relative;
                    overflow: hidden;
                }
            `;
            document.head.appendChild(style);
        }
        
        element.appendChild(ripple);
        
        setTimeout(() => {
            ripple.remove();
        }, 600);
    }

    playHoverSound() {
        // Optional: Add subtle hover sound
        // This would require audio files
    }

    // Enhanced recording button animations
    animateRecordButton(state) {
        const button = document.getElementById('record-btn');
        const icon = document.getElementById('record-icon');
        
        button.classList.remove('recording', 'completed');
        
        switch (state) {
            case 'idle':
                icon.textContent = '🎙️';
                button.style.transform = 'scale(1)';
                break;
                
            case 'recording':
                icon.textContent = '⏹️';
                button.classList.add('recording');
                this.startPulseAnimation(button);
                break;
                
            case 'completed':
                icon.textContent = '✓';
                button.classList.add('completed');
                this.stopPulseAnimation();
                this.celebrateCompletion(button);
                break;
        }
    }

    startPulseAnimation(element) {
        let scale = 1;
        let growing = true;
        
        const animate = () => {
            if (growing) {
                scale += 0.002;
                if (scale >= 1.05) growing = false;
            } else {
                scale -= 0.002;
                if (scale <= 1) growing = true;
            }
            
            element.style.transform = `scale(${scale})`;
            this.animationFrameId = requestAnimationFrame(animate);
        };
        
        animate();
    }

    stopPulseAnimation() {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    }

    celebrateCompletion(element) {
        // Quick celebration animation
        element.style.transform = 'scale(1.1)';
        setTimeout(() => {
            element.style.transform = 'scale(1)';
        }, 200);
    }

    // Progress visualization
    updateProgressDots(currentQuestion, totalQuestions) {
        document.querySelectorAll('.progress-dot').forEach((dot, index) => {
            dot.classList.remove('active', 'completed');
            
            if (index < currentQuestion) {
                dot.classList.add('completed');
            } else if (index === currentQuestion) {
                dot.classList.add('active');
            }
        });
    }

    animateProgressBar(percentage, duration = 1000) {
        const progressBar = document.getElementById('recording-progress');
        const startWidth = parseFloat(progressBar.style.width) || 0;
        const targetWidth = percentage;
        const startTime = Date.now();
        
        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // Easing function
            const easeOut = 1 - Math.pow(1 - progress, 3);
            const currentWidth = startWidth + (targetWidth - startWidth) * easeOut;
            
            progressBar.style.width = `${currentWidth}%`;
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };
        
        animate();
    }

    // Audio visualization
    createAudioVisualizer(canvas, audioContext, analyser) {
        const ctx = canvas.getContext('2d');
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        
        const draw = () => {
            analyser.getByteFrequencyData(dataArray);
            
            ctx.fillStyle = 'rgba(13, 17, 23, 0.2)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            const barWidth = (canvas.width / bufferLength) * 2.5;
            let barHeight;
            let x = 0;
            
            for (let i = 0; i < bufferLength; i++) {
                barHeight = (dataArray[i] / 255) * canvas.height;
                
                const r = barHeight + 25 * (i / bufferLength);
                const g = 250 * (i / bufferLength);
                const b = 50;
                
                ctx.fillStyle = `rgb(${r},${g},${b})`;
                ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
                
                x += barWidth + 1;
            }
            
            requestAnimationFrame(draw);
        };
        
        draw();
    }

    // Enhanced version card interactions
    enhanceVersionCards() {
        document.querySelectorAll('.version-card').forEach(card => {
            // Add hover effects
            card.addEventListener('mouseenter', () => {
                if (!card.classList.contains('selected')) {
                    card.style.transform = 'scale(1.02) translateY(-2px)';
                    card.style.boxShadow = '0 8px 25px rgba(66, 153, 225, 0.15)';
                }
            });
            
            card.addEventListener('mouseleave', () => {
                if (!card.classList.contains('selected')) {
                    card.style.transform = 'scale(1) translateY(0)';
                    card.style.boxShadow = '';
                }
            });
            
            // Add selection animation
            card.addEventListener('click', () => {
                this.animateCardSelection(card);
            });
        });
    }

    animateCardSelection(selectedCard) {
        // Remove selection from other cards
        document.querySelectorAll('.version-card').forEach(card => {
            if (card !== selectedCard) {
                card.classList.remove('selected');
                card.querySelector('.checkmark').classList.add('hidden');
                card.style.transform = 'scale(1) translateY(0)';
            }
        });
        
        // Animate selected card
        selectedCard.style.transform = 'scale(1.05)';
        setTimeout(() => {
            selectedCard.style.transform = 'scale(1.02) translateY(-2px)';
        }, 150);
        
        // Show checkmark with animation
        const checkmark = selectedCard.querySelector('.checkmark');
        checkmark.classList.remove('hidden');
        checkmark.style.transform = 'scale(0)';
        checkmark.style.transition = 'transform 0.3s ease-out';
        
        requestAnimationFrame(() => {
            checkmark.style.transform = 'scale(1)';
        });
    }

    // Feedback tag animations
    enhanceFeedbackTags() {
        document.querySelectorAll('.feedback-tag').forEach(tag => {
            tag.addEventListener('click', () => {
                this.animateTagToggle(tag);
            });
        });
    }

    animateTagToggle(tag) {
        tag.style.transform = 'scale(0.95)';
        
        setTimeout(() => {
            tag.classList.toggle('selected');
            tag.style.transform = 'scale(1.05)';
            
            setTimeout(() => {
                tag.style.transform = 'scale(1)';
            }, 100);
        }, 100);
    }

    // Loading animations
    createLoadingAnimation(container) {
        const loader = document.createElement('div');
        loader.className = 'loading-spinner';
        loader.innerHTML = `
            <div class="spinner-ring"></div>
            <div class="spinner-ring"></div>
            <div class="spinner-ring"></div>
        `;
        
        // Add spinner styles
        if (!document.getElementById('spinner-styles')) {
            const style = document.createElement('style');
            style.id = 'spinner-styles';
            style.textContent = `
                .loading-spinner {
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    gap: 4px;
                }
                
                .spinner-ring {
                    width: 8px;
                    height: 8px;
                    border-radius: 50%;
                    background: var(--primary-blue);
                    animation: spinner-bounce 1.4s ease-in-out infinite both;
                }
                
                .spinner-ring:nth-child(1) { animation-delay: -0.32s; }
                .spinner-ring:nth-child(2) { animation-delay: -0.16s; }
                
                @keyframes spinner-bounce {
                    0%, 80%, 100% {
                        transform: scale(0);
                    }
                    40% {
                        transform: scale(1);
                    }
                }
            `;
            document.head.appendChild(style);
        }
        
        container.appendChild(loader);
        return loader;
    }

    // Toast notifications
    showToast(message, type = 'info', duration = 3000) {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        
        // Add toast styles
        if (!document.getElementById('toast-styles')) {
            const style = document.createElement('style');
            style.id = 'toast-styles';
            style.textContent = `
                .toast {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    padding: 12px 20px;
                    border-radius: 8px;
                    color: white;
                    font-weight: 500;
                    z-index: 1000;
                    transform: translateX(100%);
                    transition: transform 0.3s ease-out;
                }
                
                .toast-info { background: var(--primary-blue); }
                .toast-success { background: var(--success-green); }
                .toast-error { background: var(--recording-red); }
                
                .toast.show {
                    transform: translateX(0);
                }
            `;
            document.head.appendChild(style);
        }
        
        document.body.appendChild(toast);
        
        // Show toast
        requestAnimationFrame(() => {
            toast.classList.add('show');
        });
        
        // Hide and remove toast
        setTimeout(() => {
            toast.style.transform = 'translateX(100%)';
            setTimeout(() => {
                toast.remove();
            }, 300);
        }, duration);
    }

    // Audio playback with visual feedback and waveform visualization
    async playAudioWithFeedback(audioBlob, button, version = null) {
        if (this.currentAudio) {
            this.currentAudio.pause();
            this.resetPlayButtons();
        }
        
        const audio = new Audio(URL.createObjectURL(audioBlob));
        this.currentAudio = audio;
        
        // Update button state
        button.classList.add('playing');
        button.textContent = '⏸️';
        
        // Add progress indicator
        const progressRing = this.createProgressRing(button);
        
        // Create audio context for analysis
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        
        // Create source from audio element
        const source = audioContext.createMediaElementSource(audio);
        source.connect(analyser);
        source.connect(audioContext.destination);
        
        // Update playing info
        if (version && window.audioProcessor) {
            window.audioProcessor.updatePlayingInfo(version);
        }
        

        
        audio.addEventListener('timeupdate', () => {
            const progress = (audio.currentTime / audio.duration) * 100;
            this.updateProgressRing(progressRing, progress);
        });
        
        audio.addEventListener('ended', () => {
            this.resetPlayButton(button);
            progressRing.remove();
            
            // Reset playing info
            const playingInfo = document.getElementById('current-version');
            if (playingInfo) playingInfo.textContent = 'No audio playing';
        });
        
        try {
            await audio.play();
        } catch (error) {
            console.error('Failed to play audio:', error);
            this.resetPlayButton(button);
            progressRing.remove();
        }
    }

    createProgressRing(button) {
        const ring = document.createElement('div');
        ring.className = 'progress-ring';
        ring.innerHTML = `
            <svg width="44" height="44">
                <circle cx="22" cy="22" r="20" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="2"/>
                <circle cx="22" cy="22" r="20" fill="none" stroke="white" stroke-width="2" 
                        stroke-dasharray="125.6" stroke-dashoffset="125.6" class="progress-circle"/>
            </svg>
        `;
        
        ring.style.cssText = `
            position: absolute;
            top: -2px;
            left: -2px;
            pointer-events: none;
        `;
        
        button.style.position = 'relative';
        button.appendChild(ring);
        
        return ring;
    }

    updateProgressRing(ring, progress) {
        const circle = ring.querySelector('.progress-circle');
        const circumference = 125.6;
        const offset = circumference - (progress / 100) * circumference;
        circle.style.strokeDashoffset = offset;
    }

    resetPlayButton(button) {
        button.classList.remove('playing');
        button.textContent = '▶️';
    }

    resetPlayButtons() {
        document.querySelectorAll('.play-button').forEach(button => {
            this.resetPlayButton(button);
            const ring = button.querySelector('.progress-ring');
            if (ring) ring.remove();
        });
    }

    // Initialize all UI enhancements
    initialize() {
        this.addButtonEffects();
        this.enhanceVersionCards();
        this.enhanceFeedbackTags();
        
        // Also setup feedback tags on page load as fallback
        this.setupFeedbackTagToggles();
        
        console.log('UI Controller initialized');
    }

    // Visual recording feedback methods
    showRecordingIndicator() {
        const recordButton = document.querySelector('.record-button');
        const recordingStatus = document.getElementById('recording-status');
        
        if (recordButton) {
            recordButton.classList.add('recording');
            recordButton.innerHTML = '⏹️'; // Stop icon
        }
        
        if (recordingStatus) {
            recordingStatus.textContent = 'Recording... Tap to stop';
            recordingStatus.style.color = '#ef4444'; // Red color
        }
        
        // Add pulsing animation
        this.startRecordingAnimation();
    }
    
    hideRecordingIndicator() {
        const recordButton = document.querySelector('.record-button');
        const recordingStatus = document.getElementById('recording-status');
        
        if (recordButton) {
            recordButton.classList.remove('recording');
            recordButton.innerHTML = '🎙️'; // Microphone icon
        }
        
        if (recordingStatus) {
            recordingStatus.textContent = 'Tap to start';
            recordingStatus.style.color = '#9ca3af'; // Gray color
        }
        
        // Stop animation
        this.stopRecordingAnimation();
    }
    
    startRecordingAnimation() {
        const recordButton = document.querySelector('.record-button');
        if (!recordButton) return;
        
        let scale = 1;
        let growing = true;
        
        const animate = () => {
            if (growing) {
                scale += 0.02;
                if (scale >= 1.1) growing = false;
            } else {
                scale -= 0.02;
                if (scale <= 1) growing = true;
            }
            
            recordButton.style.transform = `scale(${scale})`;
            
            if (recordButton.classList.contains('recording')) {
                this.animationFrameId = requestAnimationFrame(animate);
            }
        };
        
        this.animationFrameId = requestAnimationFrame(animate);
    }
    
    stopRecordingAnimation() {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
        
        const recordButton = document.querySelector('.record-button');
        if (recordButton) {
            recordButton.style.transform = 'scale(1)';
        }
    }
    
    showRecordingSuccess(duration) {
        const recordingStatus = document.getElementById('recording-status');
        if (recordingStatus) {
            recordingStatus.textContent = `✅ Recorded ${duration}s successfully!`;
            recordingStatus.style.color = '#10b981'; // Green color
            
            // Reset after 2 seconds
            setTimeout(() => {
                recordingStatus.textContent = 'Processing...';
                recordingStatus.style.color = '#3b82f6'; // Blue color
            }, 2000);
        }
    }
    
    showRecordingError(message) {
        const recordingStatus = document.getElementById('recording-status');
        if (recordingStatus) {
            recordingStatus.textContent = `❌ ${message}`;
            recordingStatus.style.color = '#ef4444'; // Red color
            
            // Reset after 3 seconds
            setTimeout(() => {
                recordingStatus.textContent = 'Tap to start';
                recordingStatus.style.color = '#9ca3af'; // Gray color
            }, 3000);
        }
    }

    setupFeedbackTagToggles() {
        console.log('Setting up feedback tag toggles...');
        
        // Wait a bit for DOM to be ready
        setTimeout(() => {
            const feedbackTags = document.querySelectorAll('.feedback-tag');
            console.log('Found feedback tags:', feedbackTags.length);
            
            if (feedbackTags.length === 0) {
                console.warn('No feedback tags found! They might not be in the DOM yet.');
                return;
            }
            
            feedbackTags.forEach((tag, index) => {
                console.log(`Setting up tag ${index + 1}:`, tag.dataset.tag, tag.textContent);
                
                // Remove any existing event listeners to prevent duplicates
                tag.removeEventListener('click', this.handleFeedbackTagClick);
                
                // Add new click event listener
                tag.addEventListener('click', this.handleFeedbackTagClick.bind(this));
                
                // Add some visual indication that it's clickable
                tag.style.cursor = 'pointer';
            });
            
            console.log('Feedback tag toggles setup complete');
        }, 100);
    }

    handleFeedbackTagClick(event) {
        const tag = event.currentTarget;
        console.log('Feedback tag clicked:', tag.dataset.tag, tag.textContent);
        
        // Toggle selected class for visual feedback
        tag.classList.toggle('selected');
        
        console.log('Tag toggled:', tag.dataset.tag, 'Selected:', tag.classList.contains('selected'));
        
        // Add animation effect
        this.animateTagToggle(tag);
    }

    showFeedbackSection() {
        const instructions = document.getElementById('selection-instructions');
        const feedbackSection = document.getElementById('feedback-section');
        
        if (instructions) {
            instructions.classList.add('hidden');
        }
        
        if (feedbackSection) {
            feedbackSection.classList.remove('hidden');
            // Scroll to feedback section on mobile
            if (window.innerWidth < 768) {
                feedbackSection.scrollIntoView({ behavior: 'smooth' });
            }
        }
        // Enable feedback tag toggling
        this.setupFeedbackTagToggles();
    }
}

