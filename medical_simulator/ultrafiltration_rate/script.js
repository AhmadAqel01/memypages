// Plasma Refill Rate Mismatch Visualizer Logic
// Physiological Model: 70kg Male (Isotonic Crystalloid)
//
// Compartment Volumes:
//   Plasma (Intravascular):  ~3.5 L
//   Interstitial:            ~10.5 L
//   Total ECF:               ~14 L
//
// Crystalloid Distribution:
//   Equilibrium ratio = 1:3 (Plasma:Interstitial)
//   After 1L NS bolus → ~250 mL stays intravascular, ~750 mL → interstitial
//   Redistribution t½ ≈ 20-30 min (Hahn, Drobin et al. Volume Kinetics)
//   Plasma refill rate max ≈ 15-25 mL/min (capillary refill in hypovolemia)
//
// Visualization speed is controlled by the time multiplier in the animation
// loop (dt * simSpeed), NOT by altering physiological constants.

const CONFIG = {
    normBloodVol: 3500,        // mL (70kg male)
    normInterstitialVol: 10500, // mL (70kg male)
    hypotensionThreshold: 0.8,  // 80% of normal → hypotension risk
    criticalThreshold: 0.7,     // 70% of normal → hemodynamic crash
    maxTankVisual: 3.0,         // Visual cap for tank height

    // Physiological Kinetic Constants (do not change for speed — use simSpeed instead)
    redistHalfLifeMin: 25,      // t½ for crystalloid redistribution (literature: 20-30 min)
    maxRefillRate: 20,          // mL/min maximum capillary refill (literature: 15-25 mL/min)

    // Visualization
    simSpeed: 450,              // Time multiplier: ~1 min real ≈ 7.5 hr sim time
};

// Preset Scenarios
const SCENARIOS = {
    stable: { ufr: 500, refillFactor: 15, label: "Stable: Refill matches Removal" },
    high_ufr: { ufr: 1200, refillFactor: 10, label: "Risk: High UFR (1.2 L/hr)" },
    sepsis: { ufr: 500, refillFactor: 2, label: "Critical: Low Refill (Sepsis/Leak)" },
    overload: { ufr: 200, refillFactor: 20, label: "Fluid Overload: High Reserve" }
};

class Simulation {
    constructor() {
        // Current Volumes (mL)
        this.bloodVol = CONFIG.normBloodVol;
        this.interstitialVol = CONFIG.normInterstitialVol;

        // "Excess" volumes: independently tracked bolus-added fluid.
        // Decays during redistribution/UFR for accurate visual coloring.
        this.bloodExcess = 0;
        this.interstitialExcess = 0;

        this.bolusVolume = 500; // mL (adjustable, up to 10000)
        this.ufr = 0; // mL/hr (User set)
        this.refillFactor = 10; // Factor

        this.ufrActualMin = 0; // mL/min
        this.netFlowMin = 0;   // mL/min (Refill - UFR)
        this.refillRateMin = 0; // mL/min

        this.isRunning = true;
        this.time = 0;

        this.history = {
            labels: [],
            bloodVolPct: [],
            threshold: []
        };
    }

    update(dt) {
        if (!this.isRunning) return;

        // Conversion: mL/hr -> mL/min -> per step
        // Frame dt is in seconds (approx)
        const dtMin = dt / 60;

        // 1. Calculate UFR (mL/min)
        this.ufrActualMin = this.ufr / 60;

        // 2. Calculate Physiological Shift (Starling / Diffusion)
        // Rate proportional to deviation from equilibrium ratio (1:3) and Refill Factor
        // If Blood is HIGH and Interstitial LOW -> Filtration (Blood -> Interstitial)
        // If Blood is LOW (UFR) -> Refill (Interstitial -> Blood)

        // Target Equilibrium based on total available fluid
        const totalECF = this.bloodVol + this.interstitialVol;
        const targetBlood = totalECF * (1 / 4); // 3.5 / 14 ratio
        // const targetInter = totalECF * (3/4);

        const deviation = targetBlood - this.bloodVol; // Positive if Blood is Low (Need refill)

        // Refill Rate Physics
        // If deviation > 0 (Refill): Limited by Refill Factor (Capillary Perm/Oncotic) and Max Cap
        // If deviation < 0 (Filtration): Redistribution kinetic decay

        let shiftRate = 0;

        if (deviation > 0) {
            // REFILL (Interstitial → Blood)
            // Driven by Starling forces: oncotic pressure gradient pulls fluid
            // from interstitial into plasma. Rate proportional to deficit.
            // refillFactor models capillary permeability/oncotic pressure:
            //   Normal: 10, Sepsis/leak: 2-5, Healthy young: 15-20
            const rawRate = (this.refillFactor / 10) * (deviation / 100);

            // Physiological cap: even in severe shock, capillary refill
            // cannot exceed ~15-25 mL/min (Starling equilibrium limit)
            shiftRate = Math.min(rawRate, CONFIG.maxRefillRate);

        } else {
            // REDISTRIBUTION (Blood → Interstitial)
            // Modeled as first-order kinetics (Hahn Volume Kinetics model):
            //   Rate = k × excess, where k = ln(2) / t½
            //   t½ ≈ 25 min for isotonic crystalloid
            // This means ~50% of excess redistributes every 25 min,
            // reaching ~90% equilibrium in ~80 min (3.3 half-lives)
            const k = Math.log(2) / CONFIG.redistHalfLifeMin;

            // Deviation is negative (blood has excess), shiftRate becomes negative
            shiftRate = deviation * k;
        }

        this.refillRateMin = shiftRate; // Can be negative (Filtration)

        // 3. Apply Changes
        const fluidShiftAmount = shiftRate * dtMin;
        const ufrRemovalAmount = this.ufrActualMin * dtMin;

        // Update Totals
        this.bloodVol += fluidShiftAmount - ufrRemovalAmount;
        this.interstitialVol -= fluidShiftAmount; // Conservation of mass (except UFR)

        // --- Dynamic Excess Tracking ---
        // Excess moves FIRST during fluid shifts. Base (dark) volume stays stable
        // unless UFR depletes all excess and eats into base.

        if (fluidShiftAmount > 0) {
            // Refill: interstitial → blood. Move interstitial excess first.
            const excessShifted = Math.min(fluidShiftAmount, this.interstitialExcess);
            this.interstitialExcess -= excessShifted;
            this.bloodExcess += excessShifted;
        } else if (fluidShiftAmount < 0) {
            // Redistribution: blood → interstitial. Move blood excess first.
            const absShift = Math.abs(fluidShiftAmount);
            const excessShifted = Math.min(absShift, this.bloodExcess);
            this.bloodExcess -= excessShifted;
            this.interstitialExcess += excessShifted;
        }

        // UFR removes excess from blood first, then base
        if (ufrRemovalAmount > 0) {
            const excessRemoved = Math.min(ufrRemovalAmount, this.bloodExcess);
            this.bloodExcess -= excessRemoved;
        }

        // Clamp excess to never exceed total or go negative
        this.bloodExcess = Math.max(0, Math.min(this.bloodExcess, this.bloodVol));
        this.interstitialExcess = Math.max(0, Math.min(this.interstitialExcess, this.interstitialVol));

        // Clamping totals
        if (this.bloodVol < 0) this.bloodVol = 0;
        if (this.interstitialVol < 0) this.interstitialVol = 0;

        // 4. History Logging
        this.time += dt;
        if (this.time % 2 < dt) { // Log every ~2 sec sim time
            this.logHistory();
        }
    }

    logHistory() {
        if (this.history.labels.length > 50) this.history.labels.shift();
        if (this.history.bloodVolPct.length > 50) this.history.bloodVolPct.shift();
        if (this.history.threshold.length > 50) this.history.threshold.shift();

        const pct = (this.bloodVol / CONFIG.normBloodVol) * 100;

        this.history.labels.push('');
        this.history.bloodVolPct.push(pct);
        this.history.threshold.push(CONFIG.hypotensionThreshold * 100);
    }

    reset() {
        this.bloodVol = CONFIG.normBloodVol;
        this.interstitialVol = CONFIG.normInterstitialVol;
        this.bloodExcess = 0;
        this.interstitialExcess = 0;
        this.ufr = 0;
        this.history.labels = [];
        this.history.bloodVolPct = [];
        this.history.threshold = [];
    }

    bolus(volume) {
        const vol = volume || this.bolusVolume;
        this.bloodVol += vol;
        this.bloodExcess += vol; // Track as excess for visual distinction
    }

    applyScenario(key) {
        const scen = SCENARIOS[key];
        if (scen) {
            this.ufr = scen.ufr;
            this.refillFactor = scen.refillFactor;
            return true;
        }
        return false;
    }
}

class Renderer {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.width = this.canvas.width;
        this.height = this.canvas.height;
        this.wavePhase = 0;
        this.particles = [];

        // Pipe Particles
        for (let i = 0; i < 15; i++) {
            this.particles.push({ x: 0, y: 0, offset: Math.random() * 100, type: 'shift' });
            this.particles.push({ x: 0, y: 0, offset: Math.random() * 100, type: 'ufr' });
        }
    }

    draw(sim) {
        this.ctx.clearRect(0, 0, this.width, this.height);
        this.wavePhase += 0.05;

        const pad = 50;
        const interTankW = 200;  // Wider — reflects 10.5L
        const bloodTankW = 120;  // Narrower — reflects 3.5L
        const tankHeight = 450;  // Tall enough for large boluses
        const groundY = this.height - pad;

        // Position tanks with comfortable spacing
        const gap = 120; // Space between tanks for pipes & labels
        const totalW = interTankW + gap + bloodTankW;
        const startX = (this.width - totalW) / 2;
        const interX = startX;
        const bloodX = startX + interTankW + gap;

        const pipeY = groundY - 40; // Fixed pipe Y position near bottom of tanks

        // 1. Draw Pipes (behind tanks)
        const shiftRate = sim.refillRateMin;

        this.drawPipe(interX + interTankW - 5, pipeY, bloodX + 5, pipeY, Math.abs(shiftRate / 10),
            shiftRate > 0 ? '#3b82f6' : '#ef4444', 'shift', false, shiftRate);

        // UFR Drain — contained within canvas
        const drainLen = Math.min(60, this.width - (bloodX + bloodTankW) - 10);
        this.drawPipe(bloodX + bloodTankW - 5, pipeY, bloodX + bloodTankW + drainLen, pipeY, sim.ufrActualMin / 10, '#fbbf24', 'ufr', true);

        // 2. Draw Tanks
        this.drawVolumeTank(interX, groundY, interTankW, tankHeight,
            sim.interstitialVol, sim.interstitialExcess, CONFIG.normInterstitialVol,
            '#3b82f6', 'Interstitial Space', '10.5L Norm');

        this.drawVolumeTank(bloodX, groundY, bloodTankW, tankHeight,
            sim.bloodVol, sim.bloodExcess, CONFIG.normBloodVol,
            '#ef4444', 'Intravascular Space', '3.5L Norm');

        // 3. Draw Info Label (between tanks, above pipe)
        this.drawInfo(sim, interX, interTankW, bloodX, bloodTankW, pipeY);
    }

    drawVolumeTank(x, bottomY, w, h, totalVol, excessVol, normVol, color, title, sub) {
        // Dynamic scaling: baseline fills 50% of tank. If total exceeds norm,
        // scale down so everything fits. This keeps base stable and gives
        // excess room to grow up to ~10L without clamping.
        const baselineRatio = 0.5; // norm volume fills 50% of tank at baseline
        const basePxPerVol = (h * baselineRatio) / normVol;
        // If total volume would overflow, scale down to fit
        const neededH = totalVol * basePxPerVol;
        const maxH = h - 4;
        const pxPerVol = neededH > maxH ? maxH / totalVol : basePxPerVol;

        // Base volume = original fluid (dark color). Only shrinks from UFR.
        const baseVol = Math.max(0, totalVol - excessVol);
        const baseH = baseVol * pxPerVol;

        // Excess volume (lighter color) stacks on top
        const excessH = excessVol * pxPerVol;
        const totalH = baseH + excessH;

        const topY = bottomY - h;

        // --- Title Labels (above tank, fixed position) ---
        this.ctx.save();
        this.ctx.textAlign = 'center';
        this.ctx.fillStyle = '#1e293b';
        this.ctx.font = 'bold 14px Inter';
        this.ctx.fillText(title, x + w / 2, topY - 22);
        this.ctx.fillStyle = '#64748b';
        this.ctx.font = '11px Inter';
        this.ctx.fillText(sub, x + w / 2, topY - 7);
        this.ctx.restore();

        // --- Container ---
        const r = 10;
        this.ctx.save();
        this.ctx.beginPath();
        this.ctx.roundRect(x, topY, w, h, r);
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        this.ctx.strokeStyle = '#cbd5e1';
        this.ctx.lineWidth = 2;
        this.ctx.fill();
        this.ctx.stroke();
        this.ctx.restore();

        // --- Threshold Markers (inside tank, left-aligned) ---
        if (title.includes("Intravascular")) {
            const dangerY = bottomY - (normVol * CONFIG.hypotensionThreshold * pxPerVol);
            const critY = bottomY - (normVol * CONFIG.criticalThreshold * pxPerVol);

            // Clamp marker Y to stay inside tank
            const clampedDangerY = Math.max(topY + 5, Math.min(dangerY, bottomY - 5));
            const clampedCritY = Math.max(topY + 5, Math.min(critY, bottomY - 5));

            this.ctx.save();
            // Hypotension line
            this.ctx.beginPath();
            this.ctx.moveTo(x, clampedDangerY);
            this.ctx.lineTo(x + w, clampedDangerY);
            this.ctx.setLineDash([5, 5]);
            this.ctx.strokeStyle = '#f59e0b';
            this.ctx.lineWidth = 1.5;
            this.ctx.stroke();
            this.ctx.setLineDash([]);

            // Label inside tank with background
            this.ctx.font = '9px Inter';
            const dangerLabel = '80%';
            const dlw = this.ctx.measureText(dangerLabel).width + 6;
            this.ctx.fillStyle = 'rgba(255,255,255,0.85)';
            this.ctx.fillRect(x + 3, clampedDangerY - 10, dlw, 12);
            this.ctx.fillStyle = '#f59e0b';
            this.ctx.fillText(dangerLabel, x + 6, clampedDangerY - 1);

            // Critical line
            this.ctx.beginPath();
            this.ctx.moveTo(x, clampedCritY);
            this.ctx.lineTo(x + w, clampedCritY);
            this.ctx.setLineDash([5, 5]);
            this.ctx.strokeStyle = '#ef4444';
            this.ctx.stroke();
            this.ctx.setLineDash([]);

            const critLabel = '70%';
            const clw = this.ctx.measureText(critLabel).width + 6;
            this.ctx.fillStyle = 'rgba(255,255,255,0.85)';
            this.ctx.fillRect(x + 3, clampedCritY - 10, clw, 12);
            this.ctx.fillStyle = '#ef4444';
            this.ctx.fillText(critLabel, x + 6, clampedCritY - 1);

            this.ctx.restore();
        }

        // --- Draw Fluid (clipped to tank) ---
        if (totalH > 0) {
            this.ctx.save();
            this.ctx.beginPath();
            this.ctx.roundRect(x, topY, w, h, r);
            this.ctx.clip();

            const fluidTop = bottomY - totalH;

            // Base Fluid
            this.ctx.fillStyle = color;
            this.ctx.fillRect(x, bottomY - baseH, w, baseH);

            // Excess Fluid (lighter)
            if (excessH > 1) {
                this.ctx.fillStyle = BaseToLight(color);
                this.ctx.fillRect(x, fluidTop, w, excessH);
                this.ctx.fillStyle = 'rgba(255,255,255,0.2)';
                this.ctx.fillRect(x, fluidTop, w, excessH);
            }

            // Wave on top
            this.ctx.beginPath();
            this.ctx.moveTo(x, fluidTop);
            for (let i = 0; i <= w; i += 5) {
                const waveY = fluidTop + Math.sin((i / 20) + this.wavePhase) * 3;
                this.ctx.lineTo(x + i, waveY);
            }
            this.ctx.lineTo(x + w, fluidTop + 10);
            this.ctx.lineTo(x, fluidTop + 10);
            this.ctx.fillStyle = excessH > 1 ? BaseToLight(color) : color;
            this.ctx.fill();

            this.ctx.restore();
        }

        // --- Volume Text (clamped inside tank) ---
        this.ctx.save();
        this.ctx.textAlign = 'center';
        this.ctx.fillStyle = 'white';
        this.ctx.shadowColor = 'rgba(0,0,0,0.5)';
        this.ctx.shadowBlur = 4;

        const pct = Math.round((totalVol / normVol) * 100);
        // Center text in the filled area, but clamp so it stays inside the tank
        const fluidMidY = bottomY - totalH / 2;
        const textY = Math.max(topY + 25, Math.min(fluidMidY, bottomY - 20));

        this.ctx.font = 'bold 16px Inter';
        this.ctx.fillText(`${(totalVol / 1000).toFixed(2)}L`, x + w / 2, textY - 6);
        this.ctx.font = '12px Inter';
        this.ctx.fillText(`${pct}%`, x + w / 2, textY + 10);

        this.ctx.shadowBlur = 0;
        this.ctx.restore();
    }

    drawPipe(x1, y1, x2, y2, speed, color, type, isDrain, flowDirVal = 1) {
        const pipeH = 15;
        const midY = y1;

        this.ctx.fillStyle = '#ecf0f1';
        this.ctx.strokeStyle = '#bdc3c7';
        this.ctx.lineWidth = 1;
        this.ctx.fillRect(x1, midY - pipeH / 2, x2 - x1, pipeH);
        this.ctx.strokeRect(x1, midY - pipeH / 2, x2 - x1, pipeH);

        if (isDrain) {
            this.ctx.fillRect(x2 - 5, midY, 10, 15);
            this.ctx.strokeRect(x2 - 5, midY, 10, 15);
        }

        // Particles
        if (speed > 0.05) {
            this.ctx.fillStyle = color;

            this.particles.forEach(p => {
                if (p.type !== type) return;

                // Move
                if (flowDirVal >= 0) {
                    p.offset += speed * 5;
                } else {
                    p.offset -= speed * 5; // Negative flow (Redistribution)
                }

                const len = x2 - x1;
                // Wrapping
                if (p.offset > len) p.offset = 0;
                if (p.offset < 0) p.offset = len;

                const px = x1 + p.offset;
                const py = midY;

                this.ctx.beginPath();
                this.ctx.arc(px, py, 3, 0, Math.PI * 2);
                this.ctx.fill();
            });
        }
    }

    drawInfo(sim, interX, interW, bloodX, bloodW, pipeY) {
        // Center between the two tanks
        const midX = (interX + interW + bloodX) / 2;

        const rate = sim.refillRateMin;
        let label = "Equilibrium";
        let color = "#64748b";

        if (rate > 1.0) {
            label = `REFILL +${Math.round(rate)} mL/min`;
            color = "#3b82f6";
        } else if (rate < -1.0) {
            label = `REDIST ${Math.round(rate)} mL/min`;
            color = "#8b5cf6";
        }

        // Draw label above pipe, never overlapping
        this.ctx.save();
        this.ctx.textAlign = 'center';
        this.ctx.fillStyle = color;
        this.ctx.font = 'bold 12px Inter';
        this.ctx.fillText(label, midX, pipeY - 28);

        // Arrow
        if (Math.abs(rate) > 1) {
            const arrowDir = rate > 0 ? "→" : "←";
            this.ctx.font = 'bold 20px Inter';
            this.ctx.fillText(arrowDir, midX, pipeY - 12);
        }
        this.ctx.restore();
    }
}

function BaseToLight(hex) {
    if (hex === '#ef4444') return '#fca5a5';
    if (hex === '#3b82f6') return '#93c5fd';
    return '#ffffff';
}

// --- Status Manager ---
function updateUI(sim) {
    // Sliders
    document.getElementById('ufr-value').textContent = sim.ufr + ' mL/hr';
    document.getElementById('prr-value').textContent = sim.refillFactor;

    // Status
    const net = sim.refillRateMin - sim.ufrActualMin;
    const netEl = document.getElementById('net-flow-display');
    netEl.textContent = `${net.toFixed(0)} mL / min`;
    netEl.style.color = net < 0 ? '#ef4444' : (net > 0 ? '#22c55e' : '#64748b');

    const statusEl = document.getElementById('status-indicator');
    const alertEl = document.getElementById('mismatch-alert');

    const pct = sim.bloodVol / CONFIG.normBloodVol;

    if (pct < CONFIG.criticalThreshold) {
        statusEl.textContent = "CRITICAL: CRASH";
        statusEl.className = 'status-indicator critical';
        alertEl.classList.remove('hidden');
    } else if (pct < CONFIG.hypotensionThreshold) {
        statusEl.textContent = "WARNING: Hypotension Risk";
        statusEl.className = 'status-indicator warning';
        alertEl.classList.add('hidden');
    } else {
        statusEl.textContent = "Stable";
        statusEl.className = 'status-indicator normal';
        alertEl.classList.add('hidden');
    }
}

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    const sim = new Simulation();
    const renderer = new Renderer('simulationCanvas');

    const ufrSlider = document.getElementById('ufr-slider');
    const prrSlider = document.getElementById('prr-slider');
    const bolusSlider = document.getElementById('bolus-slider');
    const bolusValueEl = document.getElementById('bolus-value');
    const scenario = document.getElementById('scenario-select');

    ufrSlider.max = 3000; ufrSlider.step = 100; ufrSlider.value = 0;
    prrSlider.max = 20; prrSlider.value = 10;

    ufrSlider.addEventListener('input', (e) => { sim.ufr = parseFloat(e.target.value); scenario.value = 'custom'; });
    prrSlider.addEventListener('input', (e) => { sim.refillFactor = parseFloat(e.target.value); scenario.value = 'custom'; });

    // Bolus volume slider
    bolusSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        sim.bolusVolume = val;
        bolusValueEl.textContent = val >= 1000 ? `${(val / 1000).toFixed(1)} L` : `${val} mL`;
    });

    scenario.addEventListener('change', (e) => {
        if (sim.applyScenario(e.target.value)) {
            ufrSlider.value = sim.ufr;
            prrSlider.value = sim.refillFactor;
        }
    });

    document.getElementById('reset-btn').addEventListener('click', () => { sim.reset(); ufrSlider.value = 0; scenario.value = 'custom'; });
    document.getElementById('bolus-btn').addEventListener('click', () => sim.bolus());

    // Chart
    const ctx = document.getElementById('timeGraph').getContext('2d');
    const chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Blood Vol %',
                borderColor: '#ef4444',
                data: [],
                pointRadius: 0,
                tension: 0.2
            },
            {
                label: 'Hypotension',
                borderColor: '#f59e0b',
                borderDash: [5, 5],
                data: [],
                pointRadius: 0
            }]
        },
        options: {
            maintainAspectRatio: false,
            animation: false,
            scales: { y: { min: 50, max: 120 }, x: { display: false } }
        }
    });

    let lastTime = 0;
    function loop(time) {
        const dt = (time - lastTime) / 1000;
        lastTime = time;
        if (dt < 0.5) {
            sim.update(dt * CONFIG.simSpeed); // Accelerated time (physiology preserved)
        }
        renderer.draw(sim);
        updateUI(sim);

        chart.data.labels = sim.history.labels;
        chart.data.datasets[0].data = sim.history.bloodVolPct;
        chart.data.datasets[1].data = sim.history.threshold;
        chart.update('none');

        requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
});
