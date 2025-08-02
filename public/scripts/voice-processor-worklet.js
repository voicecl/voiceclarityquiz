// public/scripts/voice-processor-worklet.js
import { SuperpoweredWebAudio } 
  from "https://cdn.jsdelivr.net/npm/@superpoweredsdk/web@2.7.2";

// Helper: convert cents to ratio
function centsToRatio(cents) {
  return Math.pow(2, cents / 1200);
}

class VoiceProcessor extends SuperpoweredWebAudio.AudioWorkletProcessor {
  onReady() {
    const sr = this.samplerate;
    const S = this.Superpowered;
    
    // Store Superpowered reference for use in processing
    this.S = S;
    this.sampleRate = sr;
    this.chunkSize = 1024;
    
    // Allocate buffers
    this.bufIn = new S.Float32Buffer(this.chunkSize);
    this.bufOut = new S.Float32Buffer(this.chunkSize);
    
    // Notify main thread we're ready
    this.sendMessageToMainScope({ event: "ready" });
  }

  onMessageFromMainScope(msg) {
    if (msg.command === "processVoice") {
      try {
        const versions = this._makeVersions(msg.audioData);
        this.sendMessageToMainScope({
          requestId: msg.requestId,
          versions
        });
      } catch (e) {
        console.error('Worklet error:', e);
        this.sendMessageToMainScope({
          requestId: msg.requestId,
          error: e.message
        });
      }
    } else if (msg.command === "cleanup") {
      this._cleanup();
    }
  }

  _makeVersions(inputBuffer) {
    const S = this.S;
    
    // "More recent" specs
    const specs = {
      raw: null, // Pass-through
      light: {
        pitchCents: -60,
        formant: 0.9,
        hpFreq: 300, lpFreq: 1200,
        shelfLow:  { freq: 500,  gain:  3 },
        shelfHigh: { freq: 2000, gain: -3 },
        comp:      null,
        notch:     null,
        vibro:     null
      },
      medium: {
        pitchCents: -120,
        formant:    1.0,
        hpFreq:     250, lpFreq: 1300,
        shelfLow:   { freq: 450,  gain:  4 },
        shelfHigh:  { freq: 2200, gain: -4 },
        comp:       { ratio: 2, threshold: -18, knee: 6 },  // gentle-knee
        notch:      null,
        vibro:      null
      },
      deep: {
        pitchCents: -120,
        formant:    1.0,
        hpFreq:     200, lpFreq: 1400,
        shelfLow:   { freq: 400,  gain:  5 },
        shelfHigh:  { freq: 2500, gain: -5 },
        comp:       { ratio: 3, threshold: -20 },
        notch:      { freq: 3000, q: 1.0 },
        vibro:      { freq:  60, gain:  6, q: 1.0 }
      }
    };

    const results = {};
    
    // Process raw version (pass-through)
    results.raw = new Float32Array(inputBuffer);
    
    // Process other versions
    for (const [ver, p] of Object.entries(specs)) {
      if (ver === 'raw') continue; // Already handled
      
      // 1) Param dump
      console.log(`[${ver}] params:`, JSON.stringify(p));

      // Helper to compute energy
      const energyOf = buffer => {
        let sum = 0;
        for (let i = 0; i < buffer.length; i++) sum += Math.abs(buffer[i]);
        return sum;
      };

      // 2) Start with raw copy
      let buf = new Float32Array(inputBuffer);
      console.log(`[${ver}] energy ▶ input:`, energyOf(buf).toFixed(6));

      // Create processors
      const ps = new S.AutomaticVocalPitchCorrection(this.sampleRate, 1.0);
      const hp = new S.Filter(S.FilterType?.Resonant_Highpass ?? S.Filter_Resonant_Highpass, this.sampleRate);
      const lp = new S.Filter(S.FilterType?.Resonant_Lowpass ?? S.Filter_Resonant_Lowpass, this.sampleRate);
      const eq = new S.ThreeBandEQ(this.sampleRate);
      
      let comp = null;
      if (p.comp) {
        comp = new S.Compressor2(this.sampleRate);
      }
      
      let notch = null;
      if (p.notch) {
        notch = new S.Filter(S.FilterType?.Notch ?? S.Filter_Notch, this.sampleRate);
      }
      
      let vibro = null;
      if (p.vibro) {
        vibro = new S.Filter(S.FilterType?.Peaking ?? S.Filter_Peaking, this.sampleRate);
      }

      // 3) Pitch shift
      ps.pitchShift = centsToRatio(p.pitchCents);
      ps.formantCorrection = p.formant;
      ps.process(buf, buf);
      console.log(`[${ver}] energy ▶ pitch-shift:`, energyOf(buf).toFixed(6));

      // 4) High-/Low-pass
      hp.frequency = p.hpFreq;
      hp.process(buf, buf);
      console.log(`[${ver}] energy ▶ high-pass:`, energyOf(buf).toFixed(6));
      
      lp.frequency = p.lpFreq;
      lp.process(buf, buf);
      console.log(`[${ver}] energy ▶ low-pass:`, energyOf(buf).toFixed(6));

      // 5) Shelving/EQ
      eq.lowGain = p.shelfLow.gain;
      eq.highGain = p.shelfHigh.gain;
      eq.process(buf, buf);
      console.log(`[${ver}] energy ▶ EQ:`, energyOf(buf).toFixed(6));

      // 6) Notch (D only)
      if (p.notch) {
        notch.frequency = p.notch.freq;
        notch.q = p.notch.q;
        notch.process(buf, buf);
        console.log(`[${ver}] energy ▶ notch:`, energyOf(buf).toFixed(6));
      }

      // 7) Vibro-boost (D only)
      if (p.vibro) {
        vibro.frequency = p.vibro.freq;
        vibro.gain = p.vibro.gain;
        vibro.q = p.vibro.q;
        vibro.process(buf, buf);
        console.log(`[${ver}] energy ▶ vibro:`, energyOf(buf).toFixed(6));
      }

      // 8) Compression (C & D)
      if (p.comp) {
        comp.ratio = p.comp.ratio;
        comp.threshold = p.comp.threshold;
        if (p.comp.knee) comp.knee = p.comp.knee;
        comp.attack = 0.003;
        comp.release = 0.1;
        comp.process(buf, buf);
        console.log(`[${ver}] energy ▶ compression:`, energyOf(buf).toFixed(6));
      }

      // 9) Final
      console.log(`[${ver}] energy ▶ FINAL:`, energyOf(buf).toFixed(6));
      results[ver] = buf;
      
      // Clean up processors
      [ps, hp, lp, eq, comp, notch, vibro].forEach(p => p?.destruct?.());
    }
    
    console.log('Processing complete. Output versions:', Object.keys(results));
    return results;
  }

  _cleanup() {
    [this.bufIn, this.bufOut].forEach(b => b?.free?.());
  }

  onDestruct() {
    this._cleanup();
  }
}

registerProcessor("VoiceProcessor", VoiceProcessor);