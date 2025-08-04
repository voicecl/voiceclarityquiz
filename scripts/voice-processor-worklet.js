// scripts/voice-processor-worklet.js
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
    
    // 🔍 DEBUG: Superpowered license check
    console.log('🔍 Superpowered diagnostic:', {
      available: typeof S !== 'undefined',
      version: S?.version || 'version unknown',
      sampleRate: sr
    });
    
    if (typeof S === 'undefined') {
      console.error('❌ CRITICAL: Superpowered not loaded! Audio processing will fail.');
      this.sendMessageToMainScope({ event: "error", error: "Superpowered not loaded" });
      return;
    }
    
    // Store Superpowered reference for use in processing
    this.S = S;
    this.sampleRate = sr;
    this.chunkSize = 1024;
    
    // Allocate buffers
    this.bufIn = new S.Float32Buffer(this.chunkSize);
    this.bufOut = new S.Float32Buffer(this.chunkSize);
    
    console.log('✅ Superpowered AudioWorklet initialized successfully');
    
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
    
    // 🔧 FIXED: Check if Superpowered is available
    if (typeof S === 'undefined') {
      console.error('❌ CRITICAL: Superpowered not loaded in _makeVersions!');
      // Return empty results with error indication
      return {
        error: 'Superpowered not loaded',
        raw: [new Float32Array(inputBuffer)] // At least provide raw version
      };
    }
    
    // 🔧 FIXED: Corrected processing configurations with proper Hz→cents conversion
    const specs = {
      raw: null, // Pass-through - NEVER process this
      light: {
        // Bandpass: 300-1200 Hz  
        hpFreq: 300,
        lpFreq: 1200,
        
        // EQ: +3dB at 500Hz, -3dB at 2kHz
        shelfLow: { freq: 500, gain: 3, q: 1.0 },
        shelfHigh: { freq: 2000, gain: -3, q: 1.0 },
        
        // FIXED: -60 Hz = ~-200 cents (not -60 cents!)
        pitchCents: -200,
        formant: 1.0,
        
        // ADDED: Missing light compression
        comp: { ratio: 1.5, threshold: -12, knee: 3 },
        notch: null,
        vibro: null
      },
      
      medium: {
        hpFreq: 300,
        lpFreq: 1200,
        shelfLow: { freq: 475, gain: 4, q: 1.2 },
        shelfHigh: { freq: 2200, gain: -4, q: 1.0 },
        
        // FIXED: -105 Hz average = ~-350 cents
        pitchCents: -350,
        formant: 0.95,
        
        comp: { ratio: 2.5, threshold: -15, knee: 4 },
        notch: null,
        vibro: null
      },
      
      deep: {
        // Narrower bandpass: 280-1000 Hz
        hpFreq: 280,  
        lpFreq: 1000,
        
        shelfLow: { freq: 450, gain: 5, q: 1.3 },
        shelfHigh: { freq: 2400, gain: -5.5, q: 0.8 },
        
        // FIXED: -135 Hz average = ~-450 cents  
        pitchCents: -450,
        formant: 0.90,
        
        // Heavy compression for whispered effect
        comp: { ratio: 4.0, threshold: -18, knee: 6 },
        
        // ADDED: Notch filter for spatial softening
        notch: { freq: 3000, q: 2.0, gain: -3 },
        vibro: null
      }
    };

    const results = {};
    
    // 🔧 FIXED: Initialize all version arrays defensively
    results.raw = [];
    results.light = [];
    results.medium = [];
    results.deep = [];
    
    // 🔧 FIXED: Add defensive check before any array assignment
    for (const ver of ['raw', 'light', 'medium', 'deep']) {
      if (!results[ver]) results[ver] = [];
    }
    
    // 🔍 DEBUG: Store original input for comparison
    const originalInput = new Float32Array(inputBuffer);
    console.log('🔍 Original input energy:', this._computeEnergy(originalInput).toFixed(6));
    
    // 🔧 FIXED: Create TRUE raw version FIRST (never process this!)
    results.raw[0] = new Float32Array(inputBuffer); // Pure copy - NEVER process this!
    
    console.log('🔧 Raw version created:', {
      length: results.raw[0].length,
      energy: this._computeEnergy(results.raw[0]).toFixed(6),
      isIdenticalToInput: this._arraysEqual(results.raw[0], originalInput)
    });
    
    // 🔍 DEBUG: Verify raw is identical to original
    const rawEnergy = this._computeEnergy(results.raw[0]);
    const originalEnergy = this._computeEnergy(originalInput);
    const isIdentical = this._arraysEqual(results.raw[0], originalInput);
    
    console.log('🔍 Raw version check:', {
      rawEnergy: rawEnergy.toFixed(6),
      originalEnergy: originalEnergy.toFixed(6),
      energyMatch: Math.abs(rawEnergy - originalEnergy) < 0.000001,
      isIdentical: isIdentical,
      rawLength: results.raw[0].length,
      originalLength: originalInput.length
    });
    
    if (!isIdentical) {
      console.error('❌ CRITICAL BUG: Raw version is not identical to original input!');
    }
    
    // 🔧 FIXED: Process other versions (raw is NEVER processed here)
    for (const [ver, p] of Object.entries(specs)) {
      if (ver === 'raw') {
        console.log('🔧 Skipping raw processing - keeping pristine copy');
        continue; // Already handled - NEVER process raw!
      }
      
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

      // 🔧 FIXED: Create processors with proper enabling
      // Verify Superpowered is loaded
      if (typeof S === 'undefined') {
        console.error('❌ CRITICAL: Superpowered not loaded!');
        return results;
      }

      // Create processors (Superpowered processors are enabled by default)
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
      const beforePitchEnergy = energyOf(buf);
      
      // 🔧 FIXED: Try different approach - use Superpowered buffer
      try {
        const superpoweredBuf = new S.Float32Buffer(buf.length);
        
        // 🔧 FIXED: Add defensive check for Superpowered buffer
        if (!superpoweredBuf || !superpoweredBuf.data) {
          console.warn('⚠️ WARNING: Superpowered buffer creation failed!');
          console.warn('⚠️ superpoweredBuf:', superpoweredBuf);
          console.warn('⚠️ superpoweredBuf.data:', superpoweredBuf?.data);
          throw new Error('Superpowered buffer creation failed');
        }
        
        for (let i = 0; i < buf.length; i++) {
          superpoweredBuf.data[i] = buf[i];
        }
        
        ps.pitchShift = centsToRatio(p.pitchCents);
        ps.formantCorrection = p.formant;
        ps.process(superpoweredBuf, superpoweredBuf);
        
        // Copy back to original buffer
        for (let i = 0; i < buf.length; i++) {
          buf[i] = superpoweredBuf.data[i];
        }
        
        superpoweredBuf.free();
      } catch (error) {
        console.error('❌ Superpowered buffer processing failed, using direct processing:', error);
        // Fallback to direct processing
        ps.pitchShift = centsToRatio(p.pitchCents);
        ps.formantCorrection = p.formant;
        ps.process(buf, buf);
      }
      
      const afterPitchEnergy = energyOf(buf);
      console.log(`[${ver}] energy ▶ pitch-shift:`, afterPitchEnergy.toFixed(6));
      
      // 🔍 VERIFY: Check if pitch shift had effect
      if (Math.abs(afterPitchEnergy - beforePitchEnergy) < 0.000001) {
        console.error(`❌ CRITICAL: Pitch shift had no effect on ${ver}!`);
      }

      // 4) High-/Low-pass
      console.log('🎛️ About to apply high-pass filter:', { 
        processorExists: !!hp, 
        frequency: p.hpFreq,
        bufferLength: buf.length 
      });
      const beforeHpEnergy = energyOf(buf);
      
      // Use Superpowered buffer for high-pass
      try {
        const hpBuf = new S.Float32Buffer(buf.length);
        
                  // 🔧 FIXED: Add defensive check for Superpowered buffer
          if (!hpBuf || !hpBuf.data) {
            console.warn('⚠️ WARNING: High-pass Superpowered buffer creation failed!');
            console.warn('⚠️ hpBuf:', hpBuf);
            console.warn('⚠️ hpBuf.data:', hpBuf?.data);
            throw new Error('High-pass Superpowered buffer creation failed');
          }
        
        for (let i = 0; i < buf.length; i++) {
          hpBuf.data[i] = buf[i];
        }
        
        hp.frequency = p.hpFreq;
        hp.process(hpBuf, hpBuf);
        
        // Copy back to original buffer
        for (let i = 0; i < buf.length; i++) {
          buf[i] = hpBuf.data[i];
        }
        
        hpBuf.free();
      } catch (error) {
        console.error('❌ High-pass Superpowered buffer processing failed, using direct processing:', error);
        // Fallback to direct processing
        hp.frequency = p.hpFreq;
        hp.process(buf, buf);
      }
      
      const afterHpEnergy = energyOf(buf);
      console.log(`[${ver}] energy ▶ high-pass:`, afterHpEnergy.toFixed(6));
      
      // 🔍 VERIFY: Check if high-pass had effect
      if (Math.abs(afterHpEnergy - beforeHpEnergy) < 0.000001) {
        console.error(`❌ CRITICAL: High-pass filter had no effect on ${ver}!`);
      }
      
      console.log('🎛️ About to apply low-pass filter:', { 
        processorExists: !!lp, 
        frequency: p.lpFreq,
        bufferLength: buf.length 
      });
      const beforeLpEnergy = energyOf(buf);
      
      // Use Superpowered buffer for low-pass
      try {
        const lpBuf = new S.Float32Buffer(buf.length);
        
                  // 🔧 FIXED: Add defensive check for Superpowered buffer
          if (!lpBuf || !lpBuf.data) {
            console.warn('⚠️ WARNING: Low-pass Superpowered buffer creation failed!');
            console.warn('⚠️ lpBuf:', lpBuf);
            console.warn('⚠️ lpBuf.data:', lpBuf?.data);
            throw new Error('Low-pass Superpowered buffer creation failed');
          }
        
        for (let i = 0; i < buf.length; i++) {
          lpBuf.data[i] = buf[i];
        }
        
        lp.frequency = p.lpFreq;
        lp.process(lpBuf, lpBuf);
        
        // Copy back to original buffer
        for (let i = 0; i < buf.length; i++) {
          buf[i] = lpBuf.data[i];
        }
        
        lpBuf.free();
      } catch (error) {
        console.error('❌ Low-pass Superpowered buffer processing failed, using direct processing:', error);
        // Fallback to direct processing
        lp.frequency = p.lpFreq;
        lp.process(buf, buf);
      }
      
      const afterLpEnergy = energyOf(buf);
      console.log(`[${ver}] energy ▶ low-pass:`, afterLpEnergy.toFixed(6));
      
      // 🔍 VERIFY: Check if low-pass had effect
      if (Math.abs(afterLpEnergy - beforeLpEnergy) < 0.000001) {
        console.error(`❌ CRITICAL: Low-pass filter had no effect on ${ver}!`);
      }

      // 5) Shelving/EQ
      console.log('🎛️ About to apply EQ:', { 
        processorExists: !!eq, 
        lowGain: p.shelfLow.gain,
        highGain: p.shelfHigh.gain,
        bufferLength: buf.length 
      });
      const beforeEqEnergy = energyOf(buf);
      
      // Use Superpowered buffer for EQ
      try {
        const eqBuf = new S.Float32Buffer(buf.length);
        
                  // 🔧 FIXED: Add defensive check for Superpowered buffer
          if (!eqBuf || !eqBuf.data) {
            console.warn('⚠️ WARNING: EQ Superpowered buffer creation failed!');
            console.warn('⚠️ eqBuf:', eqBuf);
            console.warn('⚠️ eqBuf.data:', eqBuf?.data);
            throw new Error('EQ Superpowered buffer creation failed');
          }
        
        for (let i = 0; i < buf.length; i++) {
          eqBuf.data[i] = buf[i];
        }
        
        eq.lowGain = p.shelfLow.gain;
        eq.highGain = p.shelfHigh.gain;
        eq.process(eqBuf, eqBuf);
        
        // Copy back to original buffer
        for (let i = 0; i < buf.length; i++) {
          buf[i] = eqBuf.data[i];
        }
        
        eqBuf.free();
      } catch (error) {
        console.error('❌ EQ Superpowered buffer processing failed, using direct processing:', error);
        // Fallback to direct processing
        eq.lowGain = p.shelfLow.gain;
        eq.highGain = p.shelfHigh.gain;
        eq.process(buf, buf);
      }
      
      const afterEqEnergy = energyOf(buf);
      console.log(`[${ver}] energy ▶ EQ:`, afterEqEnergy.toFixed(6));
      
      // 🔍 VERIFY: Check if EQ had effect
      if (Math.abs(afterEqEnergy - beforeEqEnergy) < 0.000001) {
        console.error(`❌ CRITICAL: EQ had no effect on ${ver}!`);
      }

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
        console.log('🎛️ About to apply compression:', { 
          processorExists: !!comp, 
          ratio: p.comp.ratio,
          threshold: p.comp.threshold,
          bufferLength: buf.length 
        });
        const beforeCompEnergy = energyOf(buf);
        
        // Use Superpowered buffer for compression
        try {
          const compBuf = new S.Float32Buffer(buf.length);
          
          // 🔧 FIXED: Add defensive check for Superpowered buffer
          if (!compBuf || !compBuf.data) {
            console.warn('⚠️ WARNING: Compression Superpowered buffer creation failed!');
            console.warn('⚠️ compBuf:', compBuf);
            console.warn('⚠️ compBuf.data:', compBuf?.data);
            throw new Error('Compression Superpowered buffer creation failed');
          }
          
          for (let i = 0; i < buf.length; i++) {
            compBuf.data[i] = buf[i];
          }
          
          comp.ratio = p.comp.ratio;
          comp.threshold = p.comp.threshold;
          if (p.comp.knee) comp.knee = p.comp.knee;
          comp.attack = 0.003;
          comp.release = 0.1;
          comp.process(compBuf, compBuf);
          
          // Copy back to original buffer
          for (let i = 0; i < buf.length; i++) {
            buf[i] = compBuf.data[i];
          }
          
          compBuf.free();
        } catch (error) {
          console.error('❌ Compression Superpowered buffer processing failed, using direct processing:', error);
          // Fallback to direct processing
          comp.ratio = p.comp.ratio;
          comp.threshold = p.comp.threshold;
          if (p.comp.knee) comp.knee = p.comp.knee;
          comp.attack = 0.003;
          comp.release = 0.1;
          comp.process(buf, buf);
        }
        
        const afterCompEnergy = energyOf(buf);
        console.log(`[${ver}] energy ▶ compression:`, afterCompEnergy.toFixed(6));
        
        // 🔍 VERIFY: Check if compression had effect
        if (Math.abs(afterCompEnergy - beforeCompEnergy) < 0.000001) {
          console.error(`❌ CRITICAL: Compression had no effect on ${ver}!`);
        }
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
      
      // 🔧 FIXED: Add defensive check before array assignment
      if (!results[ver]) results[ver] = [];
      results[ver][0] = buf;
      
      // Clean up processors
      [ps, hp, lp, eq, comp, notch, vibro].forEach(p => p?.destruct?.());
    }
    
    // 🔍 DEBUG: Final verification - check if any version matches raw
    console.log('🔍 Final version comparison:');
    for (const [ver, data] of Object.entries(results)) {
      if (ver === 'raw') continue;
      const isSameAsRaw = this._arraysEqual(data[0], results.raw[0]);
      const energyDiff = Math.abs(this._computeEnergy(data[0]) - this._computeEnergy(results.raw[0]));
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