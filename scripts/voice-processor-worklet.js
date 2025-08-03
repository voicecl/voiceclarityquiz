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
        pitchCents: -100,
        formant:    0.96,
        hpFreq:     200, lpFreq: 1400,
        shelfLow:   { freq: 400,  gain:  4 },
        shelfHigh:  { freq: 2500, gain: -3 },
        comp:       { ratio: 3, threshold: -20 },
        notch:      { freq: 3000, q: 1.0 },
        vibro:      null
      }
    };

    const results = {};
    
    // 🔍 DEBUG: Store original input for comparison
    const originalInput = new Float32Array(inputBuffer);
    console.log('🔍 Original input energy:', this._computeEnergy(originalInput).toFixed(6));
    
    // Process raw version (pass-through) - CRITICAL: This should be truly unprocessed
    results.raw = new Float32Array(inputBuffer);
    
    // 🔍 DEBUG: Verify raw is identical to original
    const rawEnergy = this._computeEnergy(results.raw);
    const originalEnergy = this._computeEnergy(originalInput);
    const isIdentical = this._arraysEqual(results.raw, originalInput);
    
    console.log('🔍 Raw version check:', {
      rawEnergy: rawEnergy.toFixed(6),
      originalEnergy: originalEnergy.toFixed(6),
      energyMatch: Math.abs(rawEnergy - originalEnergy) < 0.000001,
      isIdentical: isIdentical,
      rawLength: results.raw.length,
      originalLength: originalInput.length
    });
    
    if (!isIdentical) {
      console.error('❌ CRITICAL BUG: Raw version is not identical to original input!');
    }
    
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
      const originalBuf = new Float32Array(buf); // Keep a copy for comparison
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

      // 🔧 DEBUG: Check processor state
      console.log('🔧 Processor state check:', { 
        pitchShift: !!ps, 
        filters: !!hp && !!lp, 
        eq: !!eq,
        comp: !!comp,
        notch: !!notch,
        vibro: !!vibro,
        superpoweredReady: !!S, 
        sampleRate: this.sampleRate 
      });

      // 3) Pitch shift
      console.log('🎛️ About to apply pitch shift:', { 
        processorExists: !!ps, 
        bufferLength: buf.length, 
        firstSample: buf[0],
        pitchShift: centsToRatio(p.pitchCents),
        formantCorrection: p.formant
      });
      ps.pitchShift = centsToRatio(p.pitchCents);
      ps.formantCorrection = p.formant;
      ps.process(buf, buf);
      console.log(`[${ver}] energy ▶ pitch-shift:`, energyOf(buf).toFixed(6));

      // 4) High-/Low-pass
      console.log('🎛️ About to apply high-pass filter:', { 
        processorExists: !!hp, 
        frequency: p.hpFreq,
        bufferLength: buf.length 
      });
      hp.frequency = p.hpFreq;
      hp.process(buf, buf);
      console.log(`[${ver}] energy ▶ high-pass:`, energyOf(buf).toFixed(6));
      
      console.log('🎛️ About to apply low-pass filter:', { 
        processorExists: !!lp, 
        frequency: p.lpFreq,
        bufferLength: buf.length 
      });
      lp.frequency = p.lpFreq;
      lp.process(buf, buf);
      console.log(`[${ver}] energy ▶ low-pass:`, energyOf(buf).toFixed(6));

      // 5) Shelving/EQ
      console.log('🎛️ About to apply EQ:', { 
        processorExists: !!eq, 
        lowGain: p.shelfLow.gain,
        highGain: p.shelfHigh.gain,
        bufferLength: buf.length 
      });
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
      
      // 🔍 CRITICAL DEBUG: Check if processing actually changed anything
      const finalEnergy = energyOf(buf);
      const originalEnergy = energyOf(originalBuf);
      const energyChanged = Math.abs(finalEnergy - originalEnergy) > 0.000001;
      const arraysChanged = !this._arraysEqual(buf, originalBuf);
      
      console.log(`🔍 ${ver} processing verification:`, {
        energyChanged,
        arraysChanged,
        originalEnergy: originalEnergy.toFixed(6),
        finalEnergy: finalEnergy.toFixed(6),
        energyDifference: (finalEnergy - originalEnergy).toFixed(6)
      });
      
      if (!energyChanged && !arraysChanged) {
        console.error(`❌ CRITICAL: ${ver} processing had NO EFFECT! Audio unchanged.`);
      }
      
      results[ver] = buf;
      
      // Clean up processors
      [ps, hp, lp, eq, comp, notch, vibro].forEach(p => p?.destruct?.());
    }
    
    // 🔍 DEBUG: Final verification - check if any version matches raw
    console.log('🔍 Final version comparison:');
    for (const [ver, data] of Object.entries(results)) {
      if (ver === 'raw') continue;
      const isSameAsRaw = this._arraysEqual(data, results.raw);
      const energyDiff = Math.abs(this._computeEnergy(data) - this._computeEnergy(results.raw));
      console.log(`  ${ver} vs raw:`, {
        isSameAsRaw,
        energyDiff: energyDiff.toFixed(6),
        hasProcessing: energyDiff > 0.000001
      });
    }
    
    console.log('Processing complete. Output versions:', Object.keys(results));
    return results;
  }

  // Helper methods for debugging
  _computeEnergy(buffer) {
    let sum = 0;
    for (let i = 0; i < buffer.length; i++) {
      sum += Math.abs(buffer[i]);
    }
    return sum;
  }

  _arraysEqual(a, b) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (Math.abs(a[i] - b[i]) > 0.000001) return false;
    }
    return true;
  }

  _cleanup() {
    [this.bufIn, this.bufOut].forEach(b => b?.free?.());
  }

  onDestruct() {
    this._cleanup();
  }
}

registerProcessor("VoiceProcessor", VoiceProcessor);