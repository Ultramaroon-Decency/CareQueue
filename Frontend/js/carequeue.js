/* ============================================================
   🏥 CAREQUEUE ENGINE — AI-Assisted Hospital Queue Optimization
   Queue Simulation · Dashboard · Optimizer · Charts · Chatbot
   ============================================================ */

(function () {
  'use strict';

  // ── Wait for the main page data ───────────────────────────
  // `hospitals` is exported to window in index.html
  const hospitals = window.hospitals;
  if (!hospitals) {
    console.warn('CareQueue: hospitals data not found on window');
    return;
  }

  // ══════════════════════════════════════════════════════════
  // 1. QUEUE SIMULATION ENGINE
  // ══════════════════════════════════════════════════════════

  const WARD_TYPES = ['General', 'ICU', 'Emergency', 'Operation'];

  // Base processing rates (patients/hour) per ward type
  const WARD_PROCESSING = {
    General: { baseRate: 3.5, avgServiceMin: 25 },
    ICU: { baseRate: 1.0, avgServiceMin: 90 },
    Emergency: { baseRate: 5.0, avgServiceMin: 18 },
    Operation: { baseRate: 0.7, avgServiceMin: 140 }
  };

  // Hour-of-day demand multipliers (0-23)
  const HOURLY_DEMAND = [
    0.15, 0.10, 0.08, 0.08, 0.10, 0.15, // 0-5 (night)
    0.30, 0.55, 0.85, 0.95, 1.00, 0.90,  // 6-11 (morning rush)
    0.75, 0.70, 0.80, 0.85, 0.75, 0.60,  // 12-17 (afternoon)
    0.50, 0.40, 0.35, 0.30, 0.25, 0.20   // 18-23 (evening)
  ];

  // Generate queue data for one hospital, one ward
  function simulateWardQueue(hospital, wardType, hour) {
    const wardBeds = hospital.wards[wardType] || 0;
    if (wardBeds === 0) return { patientsWaiting: 0, avgWaitMin: 0, processingRate: 0, load: 0 };

    const wp = WARD_PROCESSING[wardType];
    const demandMultiplier = HOURLY_DEMAND[hour];

    // Hospital capacity factor (bigger hospitals = more patients but also more throughput)
    const totalBeds = Object.values(hospital.wards).reduce((a, b) => a + b, 0);
    const capacityFactor = Math.sqrt(totalBeds / 20); // normalized

    // Random variance ±20%
    const variance = 0.8 + Math.random() * 0.4;

    const patientsWaiting = Math.max(0, Math.round(
      wardBeds * demandMultiplier * capacityFactor * variance * 0.8
    ));

    const processingRate = wp.baseRate * (0.85 + Math.random() * 0.3);

    const avgWaitMin = patientsWaiting === 0 ? 0 :
      Math.round(wp.avgServiceMin * (patientsWaiting / (wardBeds * processingRate)) * variance);

    const load = Math.min(100, Math.round((patientsWaiting / Math.max(1, wardBeds)) * 100));

    return { patientsWaiting, avgWaitMin: Math.max(0, avgWaitMin), processingRate: Math.round(processingRate * 10) / 10, load };
  }

  // Generate full queue snapshot for all hospitals
  function generateQueueSnapshot() {
    const now = new Date();
    const currentHour = now.getHours();

    const snapshot = hospitals.map(h => {
      const queue = {};
      let totalWait = 0;
      let totalPatients = 0;

      WARD_TYPES.forEach(ward => {
        queue[ward] = simulateWardQueue(h, ward, currentHour);
        totalWait += queue[ward].avgWaitMin;
        totalPatients += queue[ward].patientsWaiting;
      });

      const avgWait = Math.round(totalWait / WARD_TYPES.length);

      return {
        ...h,
        queue,
        totalPatients,
        avgWait,
        queueStatus: avgWait <= 20 ? 'low' : avgWait <= 45 ? 'medium' : 'high'
      };
    });

    return snapshot;
  }

  // Generate 24-hour forecast for heatmap
  function generate24HourForecast() {
    const forecast = {};
    hospitals.forEach(h => {
      forecast[h.id] = [];
      for (let hour = 0; hour < 24; hour++) {
        let totalLoad = 0;
        WARD_TYPES.forEach(ward => {
          totalLoad += simulateWardQueue(h, ward, hour).load;
        });
        forecast[h.id].push(Math.round(totalLoad / WARD_TYPES.length));
      }
    });
    return forecast;
  }

  // ══════════════════════════════════════════════════════════
  // 2. GLOBAL STATE
  // ══════════════════════════════════════════════════════════

  let currentSnapshot = generateQueueSnapshot();
  let heatmapData = generate24HourForecast();
  let waitTrendChart = null;

  // ══════════════════════════════════════════════════════════
  // 3. STAT OVERVIEW CARDS
  // ══════════════════════════════════════════════════════════

  function updateStatCards() {
    const totalPatients = currentSnapshot.reduce((sum, h) => sum + h.totalPatients, 0);
    const avgWait = Math.round(currentSnapshot.reduce((sum, h) => sum + h.avgWait, 0) / currentSnapshot.length);
    const busyHospitals = currentSnapshot.filter(h => h.queueStatus === 'high').length;
    const optimizedRate = Math.round(100 - (busyHospitals / currentSnapshot.length) * 100);

    animateCounter('cq-total-patients', totalPatients);
    animateCounter('cq-avg-wait', avgWait, ' min');
    animateCounter('cq-busy-hospitals', busyHospitals);
    animateCounter('cq-optimized-rate', optimizedRate, '%');
  }

  function animateCounter(id, targetValue, suffix = '') {
    const el = document.getElementById(id);
    if (!el) return;

    const start = parseInt(el.textContent) || 0;
    const duration = 800;
    const startTime = performance.now();

    function update(currentTime) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic

      const current = Math.round(start + (targetValue - start) * eased);
      el.textContent = current + suffix;

      if (progress < 1) requestAnimationFrame(update);
    }

    requestAnimationFrame(update);
  }

  // ══════════════════════════════════════════════════════════
  // 4. LIVE QUEUE STATUS CARDS
  // ══════════════════════════════════════════════════════════

  function renderQueueCards() {
    const container = document.getElementById('cq-queue-list');
    if (!container) return;

    container.innerHTML = currentSnapshot.map(h => {
      const waitClass = h.queueStatus === 'low' ? 'cq-wait-low' :
        h.queueStatus === 'medium' ? 'cq-wait-medium' : 'cq-wait-high';

      const wardBars = WARD_TYPES.map(ward => {
        const q = h.queue[ward];
        if (h.wards[ward] === 0) return '';

        const percentage = Math.min(100, q.load);
        const barClass = percentage <= 40 ? 'low' : percentage <= 70 ? 'medium' : 'high';

        return `
          <div class="cq-ward-row">
            <span class="cq-ward-label">${ward}</span>
            <div class="cq-progress-track">
              <div class="cq-progress-bar ${barClass}" style="width: ${percentage}%"></div>
            </div>
            <span class="cq-ward-wait-time">${q.avgWaitMin} min</span>
          </div>`;
      }).join('');

      return `
        <div class="cq-queue-card">
          <div class="cq-queue-card-header">
            <span class="cq-queue-hospital-name">${h.name}</span>
            <span class="cq-queue-total-wait ${waitClass}">~${h.avgWait} min avg</span>
          </div>
          <div class="cq-ward-bars">${wardBars}</div>
        </div>`;
    }).join('');
  }

  // ══════════════════════════════════════════════════════════
  // 5. SMART SCHEDULING OPTIMIZER
  // ══════════════════════════════════════════════════════════

  function runOptimizer() {
    const wardSelect = document.getElementById('cq-ward-select');
    const urgencySelect = document.getElementById('cq-urgency-select');
    const resultsContainer = document.getElementById('cq-recommendations');

    if (!wardSelect || !resultsContainer) return;

    const selectedWard = wardSelect.value;
    const urgency = urgencySelect ? urgencySelect.value : 'normal';

    // Score each hospital
    const scored = currentSnapshot
      .filter(h => h.wards[selectedWard] > 0)
      .map(h => {
        const q = h.queue[selectedWard];
        const beds = h.wards[selectedWard];

        // Score: lower wait = better, more beds = better
        let score = 100 - q.avgWaitMin + (beds * 2) - (q.patientsWaiting * 1.5);

        if (urgency === 'urgent') {
          score += (q.processingRate * 10);
        }

        // Find optimal hour (lowest predicted load)
        const hospitalForecast = heatmapData[h.id] || [];
        let bestHour = new Date().getHours();
        let bestLoad = 999;
        for (let hr = Math.max(6, new Date().getHours()); hr < 22; hr++) {
          if (hospitalForecast[hr] < bestLoad) {
            bestLoad = hospitalForecast[hr];
            bestHour = hr;
          }
        }

        return { ...h, score, bestHour, bestLoad, wardQueue: q };
      })
      .sort((a, b) => b.score - a.score);

    // Render recommendation cards
    resultsContainer.innerHTML = scored.map((h, i) => {
      const badgeClass = i === 0 ? 'best' : i < 3 ? 'good' : 'busy';
      const badgeText = i === 0 ? '★ Best Match' : i < 3 ? 'Good Option' : 'Busy';
      const cardClass = i === 0 ? 'best' : '';

      const bestHourStr = `${h.bestHour}:00 – ${h.bestHour + 1}:00`;

      return `
        <div class="cq-rec-card ${cardClass}">
          <span class="cq-rec-badge ${badgeClass}">${badgeText}</span>
          <div class="cq-rec-hospital">${h.name}</div>
          <div class="cq-rec-details">
            <div class="cq-rec-detail">
              <span class="cq-rec-detail-icon">⏱️</span>
              <span>Current wait: <strong>${h.wardQueue.avgWaitMin} min</strong></span>
            </div>
            <div class="cq-rec-detail">
              <span class="cq-rec-detail-icon">👥</span>
              <span>In queue: <strong>${h.wardQueue.patientsWaiting} patients</strong></span>
            </div>
            <div class="cq-rec-detail">
              <span class="cq-rec-detail-icon">🛏️</span>
              <span>${selectedWard} beds: <strong>${h.wards[selectedWard]}</strong></span>
            </div>
            <div class="cq-rec-detail">
              <span class="cq-rec-detail-icon">⚡</span>
              <span>Processing: <strong>${h.wardQueue.processingRate}/hr</strong></span>
            </div>
          </div>
          <div class="cq-rec-optimal-time">
            🕐 Optimal visit window: <strong>${bestHourStr}</strong>
          </div>
        </div>`;
    }).join('');

    if (scored.length === 0) {
      resultsContainer.innerHTML = `
        <div class="cq-empty-state">
          <div class="cq-empty-state-icon">🏥</div>
          <p>No hospitals found with <strong>${selectedWard}</strong> ward availability.</p>
        </div>`;
    }
  }

  // ══════════════════════════════════════════════════════════
  // 6. PEAK HOURS HEATMAP
  // ══════════════════════════════════════════════════════════

  function renderHeatmap() {
    const container = document.getElementById('cq-heatmap');
    if (!container) return;

    // Display hours 6AM - 5PM (12 columns) for readability
    const displayHours = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17];

    // Header row
    let html = '<div class="cq-heatmap-header"></div>'; // empty corner
    displayHours.forEach(h => {
      const label = h < 12 ? `${h}AM` : h === 12 ? '12PM' : `${h - 12}PM`;
      html += `<div class="cq-heatmap-header">${label}</div>`;
    });

    // Data rows
    hospitals.forEach(hosp => {
      const shortName = hosp.name.length > 14 ? hosp.name.substring(0, 14) + '…' : hosp.name;
      html += `<div class="cq-heatmap-row-label" title="${hosp.name}">${shortName}</div>`;

      displayHours.forEach(hour => {
        const load = heatmapData[hosp.id] ? heatmapData[hosp.id][hour] : 0;
        const heatLevel = Math.min(10, Math.max(1, Math.ceil(load / 10)));
        html += `<div class="cq-heatmap-cell cq-heat-${heatLevel}" title="${hosp.name} @ ${hour}:00 — Load: ${load}%">${load}</div>`;
      });
    });

    container.innerHTML = html;
  }

  // ══════════════════════════════════════════════════════════
  // 7. WAIT TIME TREND CHART (Chart.js)
  // ══════════════════════════════════════════════════════════

  function renderWaitTrendChart() {
    const ctx = document.getElementById('cq-wait-trend-chart');
    if (!ctx || typeof Chart === 'undefined') return;

    const hours = Array.from({ length: 24 }, (_, i) => {
      return i < 12 ? `${i === 0 ? 12 : i}AM` : `${i === 12 ? 12 : i - 12}PM`;
    });

    const datasets = WARD_TYPES.map((ward, idx) => {
      const colors = ['#4F46E5', '#06B6D4', '#F59E0B', '#EF4444'];
      const bgColors = ['rgba(79,70,229,0.1)', 'rgba(6,182,212,0.1)', 'rgba(245,158,11,0.1)', 'rgba(239,68,68,0.1)'];

      // Generate trend data
      const data = Array.from({ length: 24 }, (_, hour) => {
        // Average across hospitals
        const avgWait = hospitals.reduce((sum, h) => {
          return sum + simulateWardQueue(h, ward, hour).avgWaitMin;
        }, 0) / hospitals.length;
        return Math.round(avgWait);
      });

      return {
        label: ward,
        data,
        borderColor: colors[idx],
        backgroundColor: bgColors[idx],
        borderWidth: 2.5,
        fill: true,
        tension: 0.4,
        pointRadius: 0,
        pointHoverRadius: 5,
        pointHoverBackgroundColor: colors[idx]
      };
    });

    // Destroy previous chart if exists
    if (waitTrendChart) waitTrendChart.destroy();

    waitTrendChart = new Chart(ctx, {
      type: 'line',
      data: { labels: hours, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false
        },
        plugins: {
          legend: {
            position: 'top',
            labels: {
              usePointStyle: true,
              pointStyle: 'circle',
              padding: 15,
              font: { family: "'Inter', sans-serif", size: 12 }
            }
          },
          tooltip: {
            backgroundColor: '#1E293B',
            titleFont: { family: "'Inter', sans-serif" },
            bodyFont: { family: "'Inter', sans-serif" },
            cornerRadius: 8,
            padding: 12,
            callbacks: {
              label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y} min avg wait`
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: {
              font: { family: "'Inter', sans-serif", size: 11 },
              maxTicksLimit: 12
            }
          },
          y: {
            beginAtZero: true,
            grid: { color: 'rgba(0,0,0,0.04)' },
            ticks: {
              font: { family: "'Inter', sans-serif", size: 11 },
              callback: v => v + ' min'
            }
          }
        }
      }
    });
  }

  // ══════════════════════════════════════════════════════════
  // 8. HOSPITAL CARD WAIT BADGES
  // ══════════════════════════════════════════════════════════

  function injectWaitBadges() {
    const hospitalCards = document.querySelectorAll('#hospital-list .h-card');

    hospitalCards.forEach(card => {
      const hospitalId = card.dataset.id;
      const hData = currentSnapshot.find(h => h.id === hospitalId);
      if (!hData) return;

      // Remove existing badge if any
      const existingBadge = card.querySelector('.cq-wait-badge');
      if (existingBadge) existingBadge.remove();

      const badgeClass = hData.avgWait <= 20 ? 'fast' : hData.avgWait <= 45 ? 'moderate' : 'slow';
      const badge = document.createElement('div');
      badge.className = `cq-wait-badge ${badgeClass}`;
      badge.innerHTML = `⏱ ~${hData.avgWait} min wait`;

      const nameEl = card.querySelector('.h-name');
      if (nameEl) nameEl.after(badge);
    });
  }

  // ══════════════════════════════════════════════════════════
  // 9. CHATBOT QUEUE EXTENSION
  // ══════════════════════════════════════════════════════════

  // Store reference to original botReply if it exists
  const _origBotReply = window._origBotReply || null;

  function handleQueueChatQuery(input) {
    const lower = input.toLowerCase();

    // "shortest wait" / "which hospital has least wait"
    if (lower.includes('shortest wait') || lower.includes('least wait') || lower.includes('fastest queue') || lower.includes('least crowded')) {
      const sorted = [...currentSnapshot].sort((a, b) => a.avgWait - b.avgWait);
      const best = sorted[0];
      return `🏥 **${best.name}** currently has the shortest average wait time of ~${best.avgWait} minutes.\n\nHere's the top 3:\n` +
        sorted.slice(0, 3).map((h, i) => `${i + 1}. ${h.name} — ~${h.avgWait} min`).join('\n');
    }

    // "best time to visit" / "when should I go"
    if (lower.includes('best time') || lower.includes('when should') || lower.includes('optimal time')) {
      const ward = WARD_TYPES.find(w => lower.includes(w.toLowerCase())) || 'General';
      return `📅 For **${ward}** ward, the best visit windows are:\n` +
        `• **6:00 – 7:00 AM** — Lowest patient volume\n` +
        `• **12:00 – 1:00 PM** — Lunch hour dip\n` +
        `• **6:00 – 7:00 PM** — Evening wind-down\n\n` +
        `❌ Avoid **9:00 – 11:00 AM** (peak morning rush).\n\n` +
        `Use the Smart Scheduling Optimizer in the CareQueue dashboard for personalized recommendations!`;
    }

    // "how long is the wait at [hospital]"
    const hospitalMatch = currentSnapshot.find(h =>
      lower.includes(h.name.toLowerCase().split(' ')[0].toLowerCase())
    );
    if (hospitalMatch && (lower.includes('wait') || lower.includes('queue') || lower.includes('crowd'))) {
      const wardDetails = WARD_TYPES
        .filter(w => hospitalMatch.wards[w] > 0)
        .map(w => `• ${w}: ~${hospitalMatch.queue[w].avgWaitMin} min (${hospitalMatch.queue[w].patientsWaiting} in queue)`)
        .join('\n');
      return `🏥 Current queue status at **${hospitalMatch.name}**:\n\n${wardDetails}\n\nAverage wait: ~${hospitalMatch.avgWait} minutes.`;
    }

    // "queue status" / "current waiting"
    if (lower.includes('queue status') || lower.includes('current wait') || lower.includes('queue overview')) {
      const totalPatients = currentSnapshot.reduce((s, h) => s + h.totalPatients, 0);
      const avgWait = Math.round(currentSnapshot.reduce((s, h) => s + h.avgWait, 0) / currentSnapshot.length);
      return `📊 **CareQueue Overview:**\n\n` +
        `• Total patients in queues: ${totalPatients}\n` +
        `• Average wait across hospitals: ~${avgWait} min\n` +
        `• Busiest: ${[...currentSnapshot].sort((a, b) => b.avgWait - a.avgWait)[0].name}\n` +
        `• Least busy: ${[...currentSnapshot].sort((a, b) => a.avgWait - b.avgWait)[0].name}\n\n` +
        `Visit the CareQueue dashboard for detailed breakdowns!`;
    }

    return null; // Not a queue query
  }

  // Expose queue handler globally for the chatbot to use
  window.handleQueueChatQuery = handleQueueChatQuery;

  // ══════════════════════════════════════════════════════════
  // 10. INITIALIZATION & REFRESH LOOP
  // ══════════════════════════════════════════════════════════

  function refreshAll() {
    currentSnapshot = generateQueueSnapshot();
    heatmapData = generate24HourForecast();

    updateStatCards();
    renderQueueCards();
    renderHeatmap();
    renderWaitTrendChart();
    injectWaitBadges();
  }

  // Initialize when DOM is ready
  function init() {
    refreshAll();

    // Wire up optimizer button
    const optimizeBtn = document.getElementById('cq-optimize-btn');
    if (optimizeBtn) {
      optimizeBtn.addEventListener('click', runOptimizer);
    }

    // Wire up ward select change (auto-run optimizer)
    const wardSelect = document.getElementById('cq-ward-select');
    if (wardSelect) {
      wardSelect.addEventListener('change', runOptimizer);
    }

    // Run optimizer with default selection
    runOptimizer();

    // Auto-refresh every 30 seconds
    setInterval(() => {
      currentSnapshot = generateQueueSnapshot();
      updateStatCards();
      renderQueueCards();
      injectWaitBadges();
    }, 30000);

    // Re-inject badges when hospital list is re-rendered (observe mutations)
    const hospitalList = document.getElementById('hospital-list');
    if (hospitalList) {
      const observer = new MutationObserver(() => {
        setTimeout(injectWaitBadges, 100);
      });
      observer.observe(hospitalList, { childList: true });
    }

    console.log('✅ CareQueue Engine initialized');
  }

  // Handle both immediate and deferred loading
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    // Small delay to ensure hospitals data and Chart.js are loaded
    setTimeout(init, 200);
  }

  // Expose for external use
  window.CareQueue = {
    getSnapshot: () => currentSnapshot,
    getHeatmap: () => heatmapData,
    refresh: refreshAll,
    optimize: runOptimizer
  };

})();
