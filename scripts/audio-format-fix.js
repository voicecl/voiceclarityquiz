// Fix for Bluetooth Headphone Compatibility and playback issues
// Convert WAV blobs to WebM/Opus format for better Bluetooth compatibility
async function convertWavToWebM(wavBlob) {
    return new Promise((resolve, reject) => {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const arrayBuffer = wavBlob.arrayBuffer();
        arrayBuffer.then(buffer => {
            return audioContext.decodeAudioData(buffer);
        }).then(audioBuffer => {
            const canvas = document.createElement('canvas');
            const canvasStream = canvas.captureStream();
            const source = audioContext.createBufferSource();
            const destination = audioContext.createMediaStreamDestination();
            source.buffer = audioBuffer;
            source.connect(destination);
            const combinedStream = new MediaStream([
                ...destination.stream.getAudioTracks(),
                ...canvasStream.getVideoTracks()
            ]);
            const mediaRecorder = new MediaRecorder(combinedStream, {
                mimeType: 'video/webm;codecs=opus'
            });
            const chunks = [];
            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    chunks.push(event.data);
                }
            };
            mediaRecorder.onstop = () => {
                const webmBlob = new Blob(chunks, { type: 'audio/webm;codecs=opus' });
                resolve(webmBlob);
            };
            mediaRecorder.onerror = (error) => {
                reject(error);
            };
            mediaRecorder.start();
            source.start();
            source.onended = () => {
                setTimeout(() => {
                    mediaRecorder.stop();
                }, 100);
            };
        }).catch(error => {
            reject(error);
        });
    });
}

// Quick fix: Convert your existing processed versions
async function fixProcessedAudioFormats() {
    console.log('🔧 Converting processed audio to Bluetooth-compatible format...');
    const versions = ['A', 'B', 'C', 'D'];
    const convertedVersions = {};
    for (const version of versions) {
        const wavBlob = window.voiceQuizApp.processedVersions[version];
        if (wavBlob) {
            try {
                console.log(`Converting version ${version}...`);
                const webmBlob = await convertWavToWebM(wavBlob);
                convertedVersions[version] = webmBlob;
                console.log(`✅ Version ${version} converted: ${webmBlob.size} bytes, type: ${webmBlob.type}`);
            } catch (error) {
                console.error(`❌ Failed to convert version ${version}:`, error);
                convertedVersions[version] = wavBlob;
            }
        }
    }
    window.voiceQuizApp.processedVersions = convertedVersions;
    console.log('🎵 Audio conversion complete! Try playing the versions now.');
}

// Alternative simpler approach: Use Web Audio API to play WAV directly
function createWebAudioPlayer(wavBlob, version) {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    wavBlob.arrayBuffer().then(buffer => {
        return audioContext.decodeAudioData(buffer);
    }).then(audioBuffer => {
        const source = audioContext.createBufferSource();
        const gainNode = audioContext.createGain();
        source.buffer = audioBuffer;
        gainNode.gain.value = 1.0;
        source.connect(gainNode);
        gainNode.connect(audioContext.destination);
        source.start();
        console.log(`✅ Version ${version} playing via Web Audio API`);
        const playBtn = document.querySelector(`[data-version="${version}"] .play-button`);
        if (playBtn) {
            playBtn.textContent = '⏸️';
            source.onended = () => {
                playBtn.textContent = '▶️';
                console.log(`Version ${version} finished playing`);
            };
        }
    }).catch(error => {
        console.error(`Failed to play version ${version}:`, error);
    });
}

// Override playVersion with Web Audio API approach (immediate fix)
window.voiceQuizApp = window.voiceQuizApp || {};
window.voiceQuizApp.playVersionWebAudio = function(version) {
    console.log(`🎵 Playing version ${version} with Web Audio API`);
    if (this.stopAllAudio) this.stopAllAudio();
    if (this.processedVersions && this.processedVersions[version]) {
        createWebAudioPlayer(this.processedVersions[version], version);
    } else {
        console.warn(`No audio available for version ${version}`);
    }
};

console.log('🎯 Audio format fixes loaded!');
console.log('💡 Try: fixProcessedAudioFormats() - to convert all versions');
console.log('💡 Try: window.voiceQuizApp.playVersionWebAudio("B") - to test Web Audio API playback'); 