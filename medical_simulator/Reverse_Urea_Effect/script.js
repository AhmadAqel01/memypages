// Reverse Urea Effect — 4-Compartment Simulation
// Layout: Dialysate | Plasma | [Brain (top) / ICF (bottom)] — parallel, not serial
// Phases: Dialysis → Equilibration (post-dialysis rebound)

window.simulationSpeedMultiplier = 1;

const CONFIG = {
    plasmaVol: 3000, isfVol: 11000, icfVol: 25000, brainVol: 1400,
    ureaToOsm: 1 / 6, baseOsm: 285,
    cellMembranePerm: 0.012, // ICF-plasma urea equilibration rate
    icfHydraulicCond: 0.35, brainHydraulicCond: 0.18,
    volumeDisplayAmp: 3.0,
    baseSimSpeed: 8, maxTime: 360, // 6h to show equilibration
    fixedDt: 1 / 60, // Fixed physical physics timestep (fraction of a minute)
};

const SCENARIOS = {
    first_hd: { bun: 150, clearance: 250, bbbPerm: 3, label: "First HD in acute uremia — very high BUN, aggressive clearance, high DDS risk" },
    maintenance: { bun: 70, clearance: 180, bbbPerm: 8, label: "Routine maintenance HD — moderate BUN, standard clearance" },
    sled: { bun: 120, clearance: 80, bbbPerm: 5, label: "Gentle / SLED — high BUN, slow clearance to minimize disequilibrium" },
    pediatric: { bun: 100, clearance: 200, bbbPerm: 2, label: "Pediatric — low BBB permeability, higher DDS susceptibility" },
};

class Simulation {
    constructor() { this.reset(); }
    reset() {
        this.initialBUN = 100; this.clearance = 180; this.bbbPermeability = 5;
        this.plasmaUrea = this.initialBUN; this.icfUrea = this.initialBUN;
        this.brainUrea = this.initialBUN; this.dialysateUrea = 0;
        this.plasmaVol = CONFIG.plasmaVol; this.icfVol = CONFIG.icfVol; this.brainVol = CONFIG.brainVol;
        this.icfGradient = 0; this.brainGradient = 0;
        this.icfWaterShiftRate = 0; this.brainWaterShiftRate = 0;
        this.time = 0; this.isRunning = false; this.isFinished = false;
        this.dialysisActive = true; // false = equilibration phase
        this.dialysisStopTime = null;
        this.history = { time: [], plasmaUrea: [], icfUrea: [], brainUrea: [], brainVolPct: [], plasmaVolPct: [], icfVolPct: [] };
        this.accumulator = 0;
        this.historyTimer = 0;
        this.logHistory();
    }
    get actualBBBPerm() { return this.bbbPermeability * 0.001; }
    get plasmaOsm() { return (CONFIG.baseOsm * CONFIG.plasmaVol / this.plasmaVol) + this.plasmaUrea * CONFIG.ureaToOsm; }
    get icfOsm() { return (CONFIG.baseOsm * CONFIG.icfVol / this.icfVol) + this.icfUrea * CONFIG.ureaToOsm; }
    get brainOsm() { return (CONFIG.baseOsm * CONFIG.brainVol / this.brainVol) + this.brainUrea * CONFIG.ureaToOsm; }

    update(dtReal) {
        if (!this.isRunning || this.isFinished) return;

        // Accumulate time based on real frametime * multiplier
        this.accumulator = (this.accumulator || 0) + dtReal * (CONFIG.baseSimSpeed * window.simulationSpeedMultiplier);

        // Fixed-timestep integration (sub-stepping)
        while (this.accumulator >= CONFIG.fixedDt) {
            this.stepPhysics(CONFIG.fixedDt);
            this.accumulator -= CONFIG.fixedDt;
        }

        if (this.time >= CONFIG.maxTime) { this.isFinished = true; this.isRunning = false; }
    }

    stepPhysics(dt) {
        // 1. Dialyzer clears urea from Extracellular Fluid (Plasma + ISF) 
        // We model immediate mixing between plasma and ISF for simple single-pool ECF rapid mixing
        // Thus effective blood pool = Plasma + ISF = ~14L. Modifying this explicitly removes the `* 10` hack.
        if (this.dialysisActive) {
            const ecfVol = CONFIG.plasmaVol + CONFIG.isfVol;
            const frac = this.clearance / ecfVol;
            this.plasmaUrea -= this.plasmaUrea * frac * dt;
            this.plasmaUrea = Math.max(0, this.plasmaUrea);
        }

        // 2. ICF urea equilibrates with plasma/ECF (bidirectional — cell membranes)
        const icfUreaGrad = this.plasmaUrea - this.icfUrea;
        this.icfUrea += CONFIG.cellMembranePerm * icfUreaGrad * dt;
        this.plasmaUrea -= (CONFIG.cellMembranePerm * icfUreaGrad * dt) * (CONFIG.icfVol / (CONFIG.plasmaVol + CONFIG.isfVol)); // mass balance
        this.icfUrea = Math.max(0, this.icfUrea);
        this.plasmaUrea = Math.max(0, this.plasmaUrea);

        // 3. Brain urea equilibrates with plasma/ECF (bidirectional — BBB, slow)
        const brainUreaGrad = this.plasmaUrea - this.brainUrea;
        this.brainUrea += this.actualBBBPerm * brainUreaGrad * dt;
        this.plasmaUrea -= (this.actualBBBPerm * brainUreaGrad * dt) * (CONFIG.brainVol / (CONFIG.plasmaVol + CONFIG.isfVol)); // mass balance
        this.brainUrea = Math.max(0, this.brainUrea);
        this.plasmaUrea = Math.max(0, this.plasmaUrea);

        // 4. Osmotic gradients & water shifts
        this.icfGradient = this.icfOsm - this.plasmaOsm;
        this.brainGradient = this.brainOsm - this.plasmaOsm;

        this.icfWaterShiftRate = CONFIG.icfHydraulicCond * this.icfGradient;
        this.brainWaterShiftRate = CONFIG.brainHydraulicCond * this.brainGradient;

        const icfShift = this.icfWaterShiftRate * dt;
        const brainShift = this.brainWaterShiftRate * dt;

        const prePlasmaVol = this.plasmaVol;
        const preIcfVol = this.icfVol;
        const preBrainVol = this.brainVol;

        let newIcfVol = this.icfVol + icfShift;
        let newBrainVol = this.brainVol + brainShift;
        let newPlasmaVol = this.plasmaVol - (icfShift + brainShift); // Water is pulled directly from intravascular space

        // Clamp to prevent physical impossibilities
        newIcfVol = Math.max(CONFIG.icfVol * 0.8, Math.min(CONFIG.icfVol * 1.2, newIcfVol));
        newBrainVol = Math.max(CONFIG.brainVol * 0.8, Math.min(CONFIG.brainVol * 1.2, newBrainVol));
        newPlasmaVol = Math.max(CONFIG.plasmaVol * 0.4, Math.min(CONFIG.plasmaVol * 1.3, newPlasmaVol));

        // Adjust urea concentrations due to volume shift (mass is conserved, so C_new = C_old * V_old / V_new)
        // This ensures urea doesn't magically multiply when water leaves a compartment
        this.plasmaUrea *= prePlasmaVol / newPlasmaVol;
        this.icfUrea *= preIcfVol / newIcfVol;
        this.brainUrea *= preBrainVol / newBrainVol;

        this.plasmaVol = newPlasmaVol;
        this.icfVol = newIcfVol;
        this.brainVol = newBrainVol;

        this.time += dt;

        // Only sample history occasionally to optimize since we take tiny physics steps
        this.historyTimer = (this.historyTimer || 0) + dt;
        if (this.historyTimer >= 1.0) { // Log history once every simulation minute 
            this.logHistory();
            this.historyTimer -= 1.0;
        }
    }

    logHistory() {
        const h = this.history;
        h.time.push(Math.round(this.time));
        h.plasmaUrea.push(+this.plasmaUrea.toFixed(1));
        h.icfUrea.push(+this.icfUrea.toFixed(1));
        h.brainUrea.push(+this.brainUrea.toFixed(1));
        h.brainVolPct.push(+this.brainVolPct.toFixed(2));
        h.plasmaVolPct.push(+this.plasmaVolPct.toFixed(2));
        h.icfVolPct.push(+this.icfVolPct.toFixed(2));
        if (h.time.length > 500) for (const k of Object.keys(h)) h[k] = h[k].slice(-500);
    }

    stopDialysis() {
        this.dialysisActive = false;
        this.dialysisStopTime = this.time;
    }

    applyScenario(key) {
        const s = SCENARIOS[key]; if (!s) return;
        this.initialBUN = s.bun; this.clearance = s.clearance; this.bbbPermeability = s.bbbPerm;
        this.plasmaUrea = s.bun; this.icfUrea = s.bun; this.brainUrea = s.bun;
        this.plasmaVol = CONFIG.plasmaVol; this.icfVol = CONFIG.icfVol; this.brainVol = CONFIG.brainVol;
        this.icfGradient = 0; this.brainGradient = 0; this.time = 0;
        this.isRunning = false; this.isFinished = false; this.dialysisActive = true; this.dialysisStopTime = null;
        this.history = { time: [], plasmaUrea: [], icfUrea: [], brainUrea: [], brainVolPct: [], plasmaVolPct: [], icfVolPct: [] };
        this.accumulator = 0;
        this.historyTimer = 0;
        this.logHistory();
    }

    get severity() {
        const s = this.brainVolPct;
        if (s >= 5) return 'dds'; if (s >= 3) return 'critical'; if (s >= 1) return 'warning'; return 'normal';
    }
    get severityLabel() {
        const m = { dds: 'DDS — Dialysis Disequilibrium', critical: 'Critical — Cerebral Edema', warning: 'Caution — Osmotic Shift', normal: 'Normal' };
        return m[this.severity];
    }
    get brainVolPct() { return (this.brainVol / CONFIG.brainVol - 1) * 100; }
    get plasmaVolPct() { return (this.plasmaVol / CONFIG.plasmaVol - 1) * 100; }
    get icfVolPct() { return (this.icfVol / CONFIG.icfVol - 1) * 100; }
    get plasmaDisplayFrac() { return 1 + this.plasmaVolPct / 100 * CONFIG.volumeDisplayAmp; }
    get icfDisplayFrac() { return 1 + this.icfVolPct / 100 * CONFIG.volumeDisplayAmp; }
    get brainDisplayFrac() { return 1 + this.brainVolPct / 100 * CONFIG.volumeDisplayAmp; }
    get phase() { return this.dialysisActive ? 'dialysis' : 'equilibration'; }
}

// =============================================================================
// Canvas Renderer — Parallel layout: Brain & ICF stacked right of Plasma
// =============================================================================
class Renderer {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.W = this.canvas.width; this.H = this.canvas.height;
        this.particles = []; this.frameCount = 0;
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = this.W * dpr; this.canvas.height = this.H * dpr;
        this.canvas.style.width = this.W + 'px'; this.canvas.style.height = this.H + 'px';
        this.ctx.scale(dpr, dpr);
    }

    draw(sim) {
        const ctx = this.ctx, W = this.W, H = this.H;
        this.frameCount++;
        ctx.clearRect(0, 0, W, H);

        // Layout constants
        const bigW = 190, bigH = 310, smallW = 175, smallH = 140;
        const gapH = 70; // horizontal gap for membranes
        const gapV = 20; // vertical gap between brain & ICF
        const tankY = 145;
        const dialX = (W - bigW * 2 - gapH * 2 - smallW) / 2;
        const plasmaX = dialX + bigW + gapH;
        const rightX = plasmaX + bigW + gapH;
        const brainY = tankY;
        const icfY = brainY + smallH + gapV;

        // Membranes
        this.drawMembrane(ctx, dialX + bigW, tankY, gapH, bigH, 'Dialyzer\nMembrane', sim.dialysisActive && sim.plasmaUrea > 1);
        // Forked membrane to brain
        this.drawForkMembrane(ctx, plasmaX + bigW, tankY, gapH, bigH, rightX, brainY, icfY, smallH,
            sim.brainGradient, sim.icfGradient);

        // Tanks
        this.drawTank(ctx, dialX, tankY, bigW, bigH, {
            label: 'Dialysate', concentration: 0, maxConc: sim.initialBUN,
            color: '#f0a500', colorLight: '#f7c948', fillFraction: 0.85, icon: '🔄',
            inactive: !sim.dialysisActive,
        });
        this.drawTank(ctx, plasmaX, tankY, bigW, bigH, {
            label: 'Plasma (Intravascular)', concentration: sim.plasmaUrea, maxConc: sim.initialBUN,
            color: '#e74c3c', colorLight: '#ff6b6b', fillFraction: sim.plasmaDisplayFrac,
            icon: '💉', volumeChange: sim.plasmaVolPct.toFixed(1), isDepleting: sim.plasmaVolPct < -0.5,
        });
        this.drawTank(ctx, rightX, brainY, smallW, smallH, {
            label: 'Brain', concentration: sim.brainUrea, maxConc: sim.initialBUN,
            color: '#3498db', colorLight: '#5dade2', fillFraction: sim.brainDisplayFrac,
            icon: '🧠', volumeChange: sim.brainVolPct.toFixed(1), isSwelling: sim.brainVolPct > 0.5,
        });
        this.drawTank(ctx, rightX, icfY, smallW, smallH, {
            label: 'Body Cells (ICF)', concentration: sim.icfUrea, maxConc: sim.initialBUN,
            color: '#27ae60', colorLight: '#58d68d', fillFraction: sim.icfDisplayFrac,
            icon: '🧬', volumeChange: sim.icfVolPct.toFixed(1), isSwelling: sim.icfVolPct > 0.3,
        });

        // Flow arrows
        if (sim.isRunning || sim.time > 0) {
            const midPlasmaRight = plasmaX + bigW;
            const midRightLeft = rightX;
            // Urea: Plasma → Dialysate (only during dialysis)
            if (sim.dialysisActive && sim.plasmaUrea > 1 && sim.isRunning) {
                this.drawFlowArrow(ctx, plasmaX - 2, tankY + bigH * 0.35, dialX + bigW + 2, tankY + bigH * 0.35,
                    'Urea\nClearance', '#f7c948', Math.min(sim.plasmaUrea / sim.initialBUN * 3 + 1, 4));
            }
            // Water/Urea to/from Brain
            const bUDiff = sim.brainUrea - sim.plasmaUrea;
            if (Math.abs(bUDiff) > 0.5) {
                const fromX = bUDiff > 0 ? midRightLeft : midPlasmaRight + 2;
                const toX = bUDiff > 0 ? midPlasmaRight + 2 : midRightLeft;
                const ay = brainY + smallH * 0.35;
                this.drawFlowArrow(ctx, fromX, ay, toX, ay,
                    bUDiff > 0 ? 'Slow Urea\nRebound' : 'Slow Urea\n(BBB)', '#8896b0', 1.3);
            }
            if (Math.abs(sim.brainGradient) > 0.3) {
                const waterIn = sim.brainGradient > 0;
                const fromX = waterIn ? midPlasmaRight + 2 : midRightLeft;
                const toX = waterIn ? midRightLeft : midPlasmaRight + 2;
                this.drawFlowArrow(ctx, fromX, brainY + smallH * 0.72, toX, brainY + smallH * 0.72,
                    waterIn ? 'H₂O → Edema' : 'H₂O Return', '#48d6b5',
                    Math.min(Math.abs(sim.brainGradient) / 2.5 + 1, 4.5), true);
            }
            // Water/Urea to/from ICF
            const iUDiff = sim.icfUrea - sim.plasmaUrea;
            if (Math.abs(iUDiff) > 0.5) {
                const fromX = iUDiff > 0 ? midRightLeft : midPlasmaRight + 2;
                const toX = iUDiff > 0 ? midPlasmaRight + 2 : midRightLeft;
                const ay = icfY + smallH * 0.35;
                this.drawFlowArrow(ctx, fromX, ay, toX, ay,
                    iUDiff > 0 ? 'Urea\nRebound' : 'Urea\nEquil.', '#8896b0', 1.3);
            }
            if (Math.abs(sim.icfGradient) > 0.2) {
                const waterIn = sim.icfGradient > 0;
                const fromX = waterIn ? midPlasmaRight + 2 : midRightLeft;
                const toX = waterIn ? midRightLeft : midPlasmaRight + 2;
                this.drawFlowArrow(ctx, fromX, icfY + smallH * 0.72, toX, icfY + smallH * 0.72,
                    waterIn ? 'H₂O → Hypotn' : 'H₂O Return', '#48d6b5',
                    Math.min(Math.abs(sim.icfGradient) / 2 + 1, 4.5), true);
            }
        }

        // Header
        this.drawOsmHeader(ctx, W, sim, plasmaX, rightX, bigW, smallW, tankY, brainY, icfY, smallH);
        // Phase indicator
        this.drawPhaseIndicator(ctx, W, sim);
        // Particles
        this.drawParticles(ctx, sim, dialX, plasmaX, rightX, tankY, bigW, bigH, brainY, icfY, smallW, smallH);
    }

    drawTank(ctx, x, y, w, h, opts) {
        const { label, concentration, maxConc, color, colorLight, fillFraction,
            icon, volumeChange, isSwelling, isDepleting, inactive } = opts;
        const isAlert = isSwelling || isDepleting;
        ctx.save();
        if (isSwelling) { ctx.shadowColor = '#ef4444'; ctx.shadowBlur = 10 + Math.sin(this.frameCount * 0.06) * 5; }
        else if (isDepleting) { ctx.shadowColor = '#f59e0b'; ctx.shadowBlur = 8 + Math.sin(this.frameCount * 0.06) * 4; }
        ctx.fillStyle = inactive ? 'rgba(255,255,255,0.015)' : 'rgba(255,255,255,0.03)';
        ctx.strokeStyle = isSwelling ? 'rgba(239,68,68,0.5)' : isDepleting ? 'rgba(245,158,11,0.4)'
            : inactive ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.12)';
        ctx.lineWidth = isAlert ? 2.5 : 1.5;
        this.roundRect(ctx, x, y, w, h, 10); ctx.fill(); ctx.stroke();
        ctx.restore();

        const clamp = Math.max(0.15, Math.min(fillFraction, 1.0));
        const fillH = h * clamp * 0.88, fillY = y + h - fillH - 4;
        const concFrac = Math.min(concentration / Math.max(maxConc, 1), 1);
        const grad = ctx.createLinearGradient(x, fillY, x, y + h);
        const a = inactive ? 0.12 : 0.25 + concFrac * 0.55;
        grad.addColorStop(0, this.hexToRGBA(colorLight, a * 0.6));
        grad.addColorStop(1, this.hexToRGBA(color, a));
        ctx.fillStyle = grad;
        this.roundRect(ctx, x + 4, fillY, w - 8, fillH, 6); ctx.fill();

        if (fillH > 10) {
            ctx.save(); ctx.beginPath();
            ctx.moveTo(x + 4, fillY);
            for (let wx = 0; wx <= w - 8; wx += 2) {
                ctx.lineTo(x + 4 + wx, fillY + Math.sin((wx + this.frameCount * 1.5) * 0.05) * (2 + concFrac * 2));
            }
            ctx.lineTo(x + w - 4, fillY + 16); ctx.lineTo(x + 4, fillY + 16); ctx.closePath();
            ctx.fillStyle = this.hexToRGBA(colorLight, 0.12); ctx.fill(); ctx.restore();
        }

        ctx.fillStyle = inactive ? 'rgba(255,255,255,0.3)' : '#e8edf5';
        ctx.font = '600 12px Inter,sans-serif'; ctx.textAlign = 'center';
        ctx.fillText(`${icon} ${label}`, x + w / 2, y - 14);
        ctx.fillStyle = inactive ? 'rgba(255,255,255,0.2)' : colorLight;
        ctx.font = '700 18px Inter,sans-serif';
        ctx.fillText(concentration.toFixed(0), x + w / 2, y + h / 2 - 6);
        ctx.font = '400 9px Inter,sans-serif'; ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.fillText('mg/dL urea', x + w / 2, y + h / 2 + 8);

        if (volumeChange !== undefined) {
            const vc = parseFloat(volumeChange);
            let c = '#22c55e';
            if (vc > 2) c = '#ef4444'; else if (vc > 0.5) c = '#f59e0b';
            else if (vc < -3) c = '#ef4444'; else if (vc < -1) c = '#f59e0b';
            ctx.fillStyle = c; ctx.font = '700 10px Inter,sans-serif';
            ctx.fillText(`Vol: ${vc > 0 ? '+' : ''}${volumeChange}%`, x + w / 2, y + h - 10);
        }
    }

    drawMembrane(ctx, x, y, w, h, label, active) {
        ctx.save();
        ctx.setLineDash([5, 4]);
        ctx.strokeStyle = active ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.07)';
        ctx.lineWidth = 1;
        const mx = x + w / 2;
        ctx.beginPath(); ctx.moveTo(mx - 6, y + 16); ctx.lineTo(mx - 6, y + h - 16); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(mx + 6, y + 16); ctx.lineTo(mx + 6, y + h - 16); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.font = '500 8px Inter,sans-serif'; ctx.textAlign = 'center';
        label.split('\n').forEach((l, i) => ctx.fillText(l, mx, y + h + 14 + i * 11));
        ctx.restore();
    }

    drawForkMembrane(ctx, px, py, gap, bigH, rx, brainY, icfY, smallH, brainGrad, icfGrad) {
        ctx.save();
        const startX = px + 10, endX = rx - 10;
        const midX = (startX + endX) / 2;
        const brainMidY = brainY + smallH / 2;
        const icfMidY = icfY + smallH / 2;
        const plasmaMidY = py + bigH / 2;

        ctx.setLineDash([5, 4]);
        ctx.lineWidth = 1;
        // Branch to brain
        ctx.strokeStyle = Math.abs(brainGrad) > 0.3 ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.07)';
        ctx.beginPath(); ctx.moveTo(startX, plasmaMidY - 30); ctx.quadraticCurveTo(midX, plasmaMidY - 30, midX, brainMidY);
        ctx.lineTo(endX, brainMidY); ctx.stroke();
        // Branch to ICF
        ctx.strokeStyle = Math.abs(icfGrad) > 0.2 ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.07)';
        ctx.beginPath(); ctx.moveTo(startX, plasmaMidY + 30); ctx.quadraticCurveTo(midX, plasmaMidY + 30, midX, icfMidY);
        ctx.lineTo(endX, icfMidY); ctx.stroke();
        ctx.setLineDash([]);

        // Labels
        ctx.fillStyle = 'rgba(255,255,255,0.22)'; ctx.font = '500 8px Inter,sans-serif'; ctx.textAlign = 'center';
        ctx.fillText('BBB', midX, brainMidY - 12);
        ctx.fillText('Cell Memb.', midX, icfMidY - 12);
        ctx.restore();
    }

    drawFlowArrow(ctx, x1, y1, x2, y2, label, color, thick, isWater = false) {
        ctx.save();
        const angle = Math.atan2(y2 - y1, x2 - x1);
        const off = isWater ? -(this.frameCount * 2.5) % 30 : -(this.frameCount * 1.8) % 20;
        ctx.strokeStyle = color; ctx.lineWidth = thick;
        ctx.setLineDash(isWater ? [8, 5] : [4, 3]); ctx.lineDashOffset = off;
        ctx.globalAlpha = 0.7 + Math.sin(this.frameCount * 0.04) * 0.15;
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
        ctx.setLineDash([]); ctx.globalAlpha = 0.85; ctx.fillStyle = color;
        ctx.beginPath(); ctx.moveTo(x2, y2);
        ctx.lineTo(x2 - 9 * Math.cos(angle - 0.4), y2 - 9 * Math.sin(angle - 0.4));
        ctx.lineTo(x2 - 9 * Math.cos(angle + 0.4), y2 - 9 * Math.sin(angle + 0.4));
        ctx.closePath(); ctx.fill();
        ctx.globalAlpha = 0.6; ctx.font = `500 ${isWater ? 9 : 8}px Inter,sans-serif`; ctx.textAlign = 'center';
        const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
        label.split('\n').forEach((l, i) => ctx.fillText(l, mx, my - 10 + i * 11));
        ctx.restore();
    }

    drawOsmHeader(ctx, W, sim, plasmaX, rightX, bigW, smallW, tankY, brainY, icfY, smallH) {
        const y = 20;
        ctx.save();
        ctx.fillStyle = '#e8edf5'; ctx.font = '700 12px Inter,sans-serif'; ctx.textAlign = 'center';
        ctx.fillText('Effective Osmolality (mOsm/L)', W / 2, y);
        ctx.font = '600 10px Inter,sans-serif';
        ctx.fillStyle = '#ff6b6b'; ctx.fillText(`Plasma: ${sim.plasmaOsm.toFixed(0)}`, plasmaX + bigW / 2, y + 18);
        ctx.fillStyle = '#5dade2'; ctx.fillText(`Brain: ${sim.brainOsm.toFixed(0)}`, rightX + smallW / 2, y + 18);
        ctx.fillStyle = '#58d68d'; ctx.fillText(`ICF: ${sim.icfOsm.toFixed(0)}`, rightX + smallW / 2, y + 32);

        const gv = sim.brainGradient;
        let gc = '#22c55e';
        if (Math.abs(gv) > 5) gc = '#f59e0b'; if (Math.abs(gv) > 10) gc = '#ef4444'; if (Math.abs(gv) > 15) gc = '#8b5cf6';
        ctx.fillStyle = gc; ctx.font = '700 11px Inter,sans-serif';
        ctx.fillText(`Brain–Plasma Δ: ${gv.toFixed(1)}`, W / 2, y + 50);
        const bw = 160, bx = W / 2 - bw / 2, by = y + 56;
        ctx.fillStyle = 'rgba(255,255,255,0.05)'; this.roundRect(ctx, bx, by, bw, 5, 3); ctx.fill();
        const fw = Math.min(Math.abs(gv) / 20, 1) * bw;
        const gg = ctx.createLinearGradient(bx, 0, bx + fw, 0);
        gg.addColorStop(0, this.hexToRGBA(gc, 0.4)); gg.addColorStop(1, gc);
        ctx.fillStyle = gg; this.roundRect(ctx, bx, by, fw, 5, 3); ctx.fill();
        ctx.restore();
    }

    drawPhaseIndicator(ctx, W, sim) {
        if (sim.time === 0) return;
        const y = this.H - 20;
        ctx.save(); ctx.textAlign = 'center'; ctx.font = '600 11px Inter,sans-serif';
        if (sim.dialysisActive) {
            ctx.fillStyle = 'rgba(26,188,156,0.7)';
            ctx.fillText('⚡ DIALYSIS ACTIVE — Urea being cleared', W / 2, y);
        } else {
            ctx.fillStyle = 'rgba(139,92,246,0.7)';
            ctx.fillText('🔄 POST-DIALYSIS EQUILIBRATION — Urea rebounding, fluids returning', W / 2, y);
        }
        ctx.restore();
    }

    drawParticles(ctx, sim, dialX, plasmaX, rightX, tankY, bigW, bigH, brainY, icfY, smallW, smallH) {
        if (!sim.isRunning && sim.time === 0) return;
        const fc = this.frameCount;
        // Urea to dialysate
        if (sim.isRunning && sim.dialysisActive && sim.plasmaUrea > 2 && fc % 8 === 0)
            this.particles.push({
                x: plasmaX + 15, y: tankY + bigH * 0.3 + Math.random() * bigH * 0.3,
                targetX: dialX + bigW - 15, targetY: tankY + bigH * 0.3 + Math.random() * bigH * 0.3,
                progress: 0, speed: 0.008 + Math.random() * 0.005, color: '#f7c948', size: 2 + Math.random() * 1.5, type: 'urea'
            });
        // Water plasma→brain or brain→plasma
        if (sim.isRunning && Math.abs(sim.brainGradient) > 0.5 && fc % 12 === 0) {
            const toB = sim.brainGradient > 0;
            this.particles.push({
                x: toB ? plasmaX + bigW - 8 : rightX + 15, y: brainY + smallH * 0.5 + Math.random() * smallH * 0.3,
                targetX: toB ? rightX + 15 : plasmaX + bigW - 8, targetY: brainY + smallH * 0.5 + Math.random() * smallH * 0.3,
                progress: 0, speed: 0.005 + Math.random() * 0.003, color: '#48d6b5', size: 3 + Math.random() * 1.5, type: 'water'
            });
        }
        // Water plasma→ICF or ICF→plasma
        if (sim.isRunning && Math.abs(sim.icfGradient) > 0.3 && fc % 10 === 0) {
            const toI = sim.icfGradient > 0;
            this.particles.push({
                x: toI ? plasmaX + bigW - 8 : rightX + 15, y: icfY + smallH * 0.4 + Math.random() * smallH * 0.3,
                targetX: toI ? rightX + 15 : plasmaX + bigW - 8, targetY: icfY + smallH * 0.4 + Math.random() * smallH * 0.3,
                progress: 0, speed: 0.006 + Math.random() * 0.004, color: '#48d6b5', size: 3 + Math.random() * 1.5, type: 'water'
            });
        }
        ctx.save();
        this.particles = this.particles.filter(p => {
            p.progress += p.speed; if (p.progress >= 1) return false;
            const cx = p.x + (p.targetX - p.x) * p.progress;
            const cy = p.y + (p.targetY - p.y) * p.progress + Math.sin(p.progress * Math.PI * 3) * 4;
            const al = p.progress < 0.1 ? p.progress / 0.1 : p.progress > 0.85 ? (1 - p.progress) / 0.15 : 1;
            ctx.globalAlpha = al * 0.8; ctx.fillStyle = p.color; ctx.beginPath();
            if (p.type === 'water') { ctx.moveTo(cx, cy - p.size); ctx.lineTo(cx + p.size * 0.6, cy); ctx.lineTo(cx, cy + p.size); ctx.lineTo(cx - p.size * 0.6, cy); }
            else ctx.arc(cx, cy, p.size, 0, Math.PI * 2);
            ctx.fill(); return true;
        });
        ctx.restore();
    }

    roundRect(ctx, x, y, w, h, r) {
        ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r); ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h); ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r); ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
    }
    hexToRGBA(hex, a) {
        return `rgba(${parseInt(hex.slice(1, 3), 16)},${parseInt(hex.slice(3, 5), 16)},${parseInt(hex.slice(5, 7), 16)},${a})`;
    }
}

// =============================================================================
// UI Controller
// =============================================================================
document.addEventListener('DOMContentLoaded', () => {
    const sim = new Simulation(), renderer = new Renderer('simulationCanvas');
    const $ = id => document.getElementById(id);
    const bunSlider = $('bun-slider'), clrSlider = $('clearance-slider'), bbbSlider = $('bbb-slider');
    const speedBtns = document.querySelectorAll('.speed-btn');

    speedBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            speedBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            window.simulationSpeedMultiplier = parseFloat(btn.dataset.speed);
        });
    });
    const bunVal = $('bun-value'), clrVal = $('clearance-value'), bbbVal = $('bbb-value');
    const scenSel = $('scenario-select'), scenDesc = $('scenario-description');
    const playBtn = $('play-pause-btn'), resetBtn = $('reset-btn'), stopDialBtn = $('stop-dialysis-btn');
    const statInd = $('status-indicator'), statTxt = $('status-text'), timeDsp = $('time-display');
    const pBun = $('plasma-bun-display'), iUrea = $('icf-urea-display'), bUrea = $('brain-urea-display');
    const gradDsp = $('gradient-display'), bVol = $('brain-vol-display'), pVol = $('plasma-vol-display'), iVol = $('icf-vol-display');
    const infoTitle = $('info-title'), infoText = $('info-text'), infoCard = $('info-card');
    const cardIch = $('card-ich'), cardHypo = $('card-hypotension'), cardDds = $('card-dds');

    bunSlider.addEventListener('input', () => {
        scenSel.value = 'custom'; sim.initialBUN = +bunSlider.value; bunVal.textContent = bunSlider.value + ' mg/dL';
        if (!sim.isRunning && sim.time === 0) { sim.plasmaUrea = sim.initialBUN; sim.icfUrea = sim.initialBUN; sim.brainUrea = sim.initialBUN; }
    });
    clrSlider.addEventListener('input', () => { scenSel.value = 'custom'; sim.clearance = +clrSlider.value; clrVal.textContent = clrSlider.value + ' mL/min'; });
    bbbSlider.addEventListener('input', () => {
        scenSel.value = 'custom'; sim.bbbPermeability = +bbbSlider.value; const p = +bbbSlider.value;
        bbbVal.textContent = `${p} (${p <= 3 ? 'Low (Higher DDS Risk)' : p <= 7 ? 'Normal' : p <= 14 ? 'High' : 'Very High'})`;
    });

    scenSel.addEventListener('change', () => {
        const k = scenSel.value;
        if (k === 'custom') { scenDesc.textContent = 'Adjust parameters manually.'; return; }
        const s = SCENARIOS[k]; sim.applyScenario(k); scenDesc.textContent = s.label;
        bunSlider.value = s.bun; bunVal.textContent = s.bun + ' mg/dL';
        clrSlider.value = s.clearance; clrVal.textContent = s.clearance + ' mL/min';
        bbbSlider.value = s.bbbPerm; bbbVal.textContent = `${s.bbbPerm} (${s.bbbPerm <= 3 ? 'Low' : s.bbbPerm <= 7 ? 'Normal' : 'High'})`;
        stopDialBtn.disabled = false; stopDialBtn.textContent = '⏹ Stop Dialysis';
        updateChart(true); renderer.draw(sim); updateUI();
    });

    playBtn.addEventListener('click', () => {
        if (sim.isFinished) {
            sim.reset(); sim.initialBUN = +bunSlider.value; sim.plasmaUrea = sim.initialBUN;
            sim.icfUrea = sim.initialBUN; sim.brainUrea = sim.initialBUN;
            sim.clearance = +clrSlider.value; sim.bbbPermeability = +bbbSlider.value;
            stopDialBtn.disabled = false; stopDialBtn.textContent = '⏹ Stop Dialysis';
            updateChart(true);
        }
        sim.isRunning = !sim.isRunning;
        playBtn.innerHTML = `<span>${sim.isRunning ? '⏸' : '▶'}</span> ${sim.isRunning ? 'Pause' : 'Start'}`;
    });

    stopDialBtn.addEventListener('click', () => {
        if (sim.dialysisActive && sim.time > 0) {
            sim.stopDialysis();
            stopDialBtn.textContent = '✓ Dialysis Stopped';
            stopDialBtn.disabled = true;
            if (!sim.isRunning) { sim.isRunning = true; playBtn.innerHTML = '<span>⏸</span> Pause'; }
        }
    });

    resetBtn.addEventListener('click', () => {
        sim.reset(); sim.initialBUN = +bunSlider.value; sim.plasmaUrea = sim.initialBUN;
        sim.icfUrea = sim.initialBUN; sim.brainUrea = sim.initialBUN;
        sim.clearance = +clrSlider.value; sim.bbbPermeability = +bbbSlider.value;
        playBtn.innerHTML = '<span>▶</span> Start';
        stopDialBtn.disabled = false; stopDialBtn.textContent = '⏹ Stop Dialysis';
        updateChart(true); renderer.draw(sim); updateUI();
    });

    function updateUI() {
        pBun.textContent = sim.plasmaUrea.toFixed(0) + ' mg/dL';
        iUrea.textContent = sim.icfUrea.toFixed(0) + ' mg/dL';
        bUrea.textContent = sim.brainUrea.toFixed(0) + ' mg/dL';
        gradDsp.textContent = sim.brainGradient.toFixed(1) + ' mOsm/L';
        const bp = sim.brainVolPct, pp = sim.plasmaVolPct, ip = sim.icfVolPct;
        bVol.textContent = `${bp > 0 ? '+' : ''}${bp.toFixed(1)}%`;
        pVol.textContent = `${pp > 0 ? '+' : ''}${pp.toFixed(1)}%`;
        iVol.textContent = `${ip > 0 ? '+' : ''}${ip.toFixed(1)}%`;
        bVol.style.color = bp > 3 ? '#ef4444' : bp > 1 ? '#f59e0b' : '#22c55e';
        pVol.style.color = pp < -5 ? '#ef4444' : pp < -2 ? '#f59e0b' : '#22c55e';
        iVol.style.color = ip > 2 ? '#ef4444' : ip > 0.5 ? '#f59e0b' : '#22c55e';
        gradDsp.style.color = sim.brainGradient > 10 ? '#ef4444' : sim.brainGradient > 5 ? '#f59e0b' : '#22c55e';
        statInd.className = 'status-indicator ' + sim.severity;
        statTxt.textContent = sim.severityLabel;
        timeDsp.textContent = `Time: ${Math.floor(sim.time)} min${!sim.dialysisActive ? ' (Equil.)' : ''}`;
        updateInfoPanel();
        cardIch.classList.toggle('highlight', sim.severity !== 'normal');
        cardHypo.classList.toggle('highlight', pp < -2 || ip > 0.5);
        cardDds.classList.toggle('highlight', sim.severity === 'dds');
        infoCard.classList.toggle('active', sim.isRunning);
    }

    function updateInfoPanel() {
        const bp = sim.brainVolPct, pp = sim.plasmaVolPct, ip = sim.icfVolPct;
        if (!sim.isRunning && sim.time === 0) {
            infoTitle.textContent = '💡 Ready to Simulate';
            infoText.innerHTML = 'Press <strong>Start</strong> to begin dialysis. Use <strong>Stop Dialysis</strong> mid-session to observe post-dialysis urea rebound and fluid re-equilibration.';
            return;
        }
        if (sim.isFinished) {
            infoTitle.textContent = '✅ Session Complete';
            infoText.innerHTML = `Plasma BUN: <strong>${sim.plasmaUrea.toFixed(0)}</strong>, ICF: <strong>${sim.icfUrea.toFixed(0)}</strong>, Brain: <strong>${sim.brainUrea.toFixed(0)}</strong> mg/dL. ${!sim.dialysisActive ? 'Post-dialysis equilibration has progressed — urea rebound raised plasma BUN as urea returned from cells.' : ''}`;
            return;
        }
        if (!sim.dialysisActive) {
            infoTitle.textContent = '🔄 Post-Dialysis Equilibration';
            infoText.innerHTML = `Dialysis stopped at ${Math.round(sim.dialysisStopTime)} min. Urea is <strong>rebounding</strong> from ICF/brain back into plasma (plasma BUN rising). Water is shifting <strong>back</strong> into the plasma as osmotic gradients resolve. Brain volume: <strong>${bp > 0 ? '+' : ''}${bp.toFixed(1)}%</strong>, Plasma volume: <strong>${pp > 0 ? '+' : ''}${pp.toFixed(1)}%</strong>.`;
            return;
        }
        if (sim.severity === 'dds') {
            infoTitle.textContent = '⚠️ Dialysis Disequilibrium Syndrome';
            infoText.innerHTML = `Brain +${bp.toFixed(1)}%, ICF +${ip.toFixed(1)}%. Plasma lost <strong>${Math.abs(pp).toFixed(1)}%</strong> volume to osmotic shift alone. Consider stopping dialysis to allow equilibration.`;
        } else if (sim.severity === 'critical') {
            infoTitle.textContent = '🔴 Cerebral Edema + Volume Depletion';
            infoText.innerHTML = `Brain–plasma gradient: <strong>${sim.brainGradient.toFixed(1)} mOsm/L</strong>. Water drawn into cells (ICF +${ip.toFixed(1)}%) and brain (+${bp.toFixed(1)}%). Plasma depleted by ${Math.abs(pp).toFixed(1)}%. Consider slowing or stopping dialysis.`;
        } else if (sim.severity === 'warning') {
            infoTitle.textContent = '🟡 Osmotic Shift Developing';
            infoText.innerHTML = `Plasma urea dropping faster than cellular urea. ICF gradient: ${sim.icfGradient.toFixed(1)}, Brain gradient: ${sim.brainGradient.toFixed(1)} mOsm/L. Water shifting out of plasma: ${pp.toFixed(1)}%.`;
        } else {
            infoTitle.textContent = '🟢 Dialysis in Progress';
            infoText.innerHTML = 'Urea being cleared. ICF equilibrating via cell membranes, brain lagging behind BBB. Gradients modest, volumes stable.';
        }
    }

    // Chart
    const chart = new Chart($('timeGraph').getContext('2d'), {
        type: 'line', data: {
            labels: sim.history.time, datasets: [
                { label: 'Plasma Urea', data: sim.history.plasmaUrea, borderColor: '#ff6b6b', backgroundColor: 'rgba(255,107,107,0.06)', borderWidth: 2.5, pointRadius: 0, tension: 0.3, fill: true, yAxisID: 'y' },
                { label: 'ICF Urea', data: sim.history.icfUrea, borderColor: '#58d68d', backgroundColor: 'rgba(88,214,141,0.06)', borderWidth: 2, pointRadius: 0, tension: 0.3, fill: true, yAxisID: 'y' },
                { label: 'Brain Urea', data: sim.history.brainUrea, borderColor: '#5dade2', backgroundColor: 'rgba(93,173,226,0.06)', borderWidth: 2.5, pointRadius: 0, tension: 0.3, fill: true, yAxisID: 'y' },
                { label: 'Brain Vol Δ%', data: sim.history.brainVolPct, borderColor: '#8b5cf6', borderWidth: 1.5, pointRadius: 0, tension: 0.3, borderDash: [5, 3], fill: false, yAxisID: 'y1' },
                { label: 'Plasma Vol Δ%', data: sim.history.plasmaVolPct, borderColor: '#f59e0b', borderWidth: 1.5, pointRadius: 0, tension: 0.3, borderDash: [5, 3], fill: false, yAxisID: 'y1' },
                { label: 'ICF Vol Δ%', data: sim.history.icfVolPct, borderColor: '#58d68d', borderWidth: 1.5, pointRadius: 0, tension: 0.3, borderDash: [3, 3], fill: false, yAxisID: 'y1' },
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false, animation: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { position: 'top', labels: { color: '#8896b0', font: { family: 'Inter', size: 10 }, boxWidth: 10, padding: 12 } },
                tooltip: { backgroundColor: 'rgba(17,27,46,0.95)', titleColor: '#e8edf5', bodyColor: '#8896b0', borderColor: 'rgba(255,255,255,0.1)', borderWidth: 1, padding: 10, cornerRadius: 8 },
                annotation: {
                    annotations: {
                        currentTime: {
                            type: 'line',
                            xMin: 0,
                            xMax: 0,
                            borderColor: 'rgba(255, 255, 255, 0.4)',
                            borderWidth: 1.5,
                            borderDash: [4, 4],
                            display: true
                        }
                    }
                }
            },
            scales: {
                x: { display: true, title: { display: true, text: 'Time (min)', color: '#5a6a85', font: { family: 'Inter', size: 11 } }, ticks: { color: '#5a6a85', maxTicksLimit: 12, font: { family: 'Inter', size: 10 } }, grid: { color: 'rgba(255,255,255,0.04)' } },
                y: { type: 'linear', position: 'left', title: { display: true, text: 'Urea (mg/dL)', color: '#5a6a85', font: { family: 'Inter', size: 11 } }, ticks: { color: '#5a6a85', font: { family: 'Inter', size: 10 } }, grid: { color: 'rgba(255,255,255,0.04)' }, min: 0 },
                y1: { type: 'linear', position: 'right', title: { display: true, text: 'Volume Δ (%)', color: '#5a6a85', font: { family: 'Inter', size: 11 } }, ticks: { color: '#5a6a85', font: { family: 'Inter', size: 10 } }, grid: { drawOnChartArea: false } },
            },
        },
    });

    function updateChart(full = false) {
        if (full) {
            const d = chart.data; d.labels = sim.history.time;
            [sim.history.plasmaUrea, sim.history.icfUrea, sim.history.brainUrea, sim.history.brainVolPct, sim.history.plasmaVolPct, sim.history.icfVolPct].forEach((v, i) => d.datasets[i].data = v);
        }

        if (chart.options.plugins && chart.options.plugins.annotation) {
            chart.options.plugins.annotation.annotations.currentTime.xMin = sim.time;
            chart.options.plugins.annotation.annotations.currentTime.xMax = sim.time;
        }

        chart.update();
    }

    let lastTime = 0;
    function loop(time) {
        if (lastTime === 0) lastTime = time;
        const dt = Math.min((time - lastTime) / 1000, 0.1); lastTime = time;
        if (sim.isRunning) { sim.update(dt); updateUI(); updateChart(); }
        renderer.draw(sim); requestAnimationFrame(loop);
    }
    renderer.draw(sim); updateUI(); requestAnimationFrame(loop);
});
