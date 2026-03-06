// ============================================================
//  HackManager — Participant Page JavaScript
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
    initParticles();
    loadHackathonSettings();
    loadSubmittedTeams();
    initEventListeners();
});

// ==================== STATE ====================
let hackathonSettings = null;
let countdownInterval = null;

// ==================== PARTICLES ====================
function initParticles() {
    const container = document.getElementById('particles');
    if (!container) return;
    for (let i = 0; i < 30; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        particle.style.left = Math.random() * 100 + '%';
        particle.style.animationDuration = (15 + Math.random() * 25) + 's';
        particle.style.animationDelay = (Math.random() * 20) + 's';
        particle.style.width = (2 + Math.random() * 3) + 'px';
        particle.style.height = particle.style.width;
        container.appendChild(particle);
    }
}

// ==================== TOAST ====================
function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const icons = { success: 'bi-check-circle-fill', error: 'bi-x-circle-fill', info: 'bi-info-circle-fill' };
    const colors = { success: '#10b981', error: '#ef4444', info: '#06b6d4' };
    const toast = document.createElement('div');
    toast.className = `custom-toast ${type}`;
    toast.innerHTML = `
      <i class="bi ${icons[type]}" style="color:${colors[type]};font-size:1.2rem"></i>
      <span style="font-size:0.9rem">${message}</span>
    `;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.transition = 'all 0.3s ease';
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ==================== COUNTDOWN TIMER ====================
async function loadHackathonSettings() {
    try {
        const res = await fetch('/api/hackathon');
        hackathonSettings = await res.json();
        document.getElementById('hackathonName').textContent = hackathonSettings.name || 'Hackathon 2026';
        startCountdown();
    } catch (err) {
        console.error('Failed to load settings:', err);
    }
}

function startCountdown() {
    if (countdownInterval) clearInterval(countdownInterval);

    function update() {
        if (!hackathonSettings || !hackathonSettings.end_time) return;
        const now = Date.now();
        const end = new Date(hackathonSettings.end_time).getTime();
        const diff = end - now;

        const section = document.getElementById('countdownSection');

        if (diff <= 0) {
            document.getElementById('countDays').textContent = '00';
            document.getElementById('countHours').textContent = '00';
            document.getElementById('countMinutes').textContent = '00';
            document.getElementById('countSeconds').textContent = '00';
            section.className = 'countdown-section countdown-finished';
            return;
        }

        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);

        document.getElementById('countDays').textContent = String(days).padStart(2, '0');
        document.getElementById('countHours').textContent = String(hours).padStart(2, '0');
        document.getElementById('countMinutes').textContent = String(minutes).padStart(2, '0');
        document.getElementById('countSeconds').textContent = String(seconds).padStart(2, '0');

        const totalHours = diff / (1000 * 60 * 60);
        let colorClass = 'countdown-green';
        if (totalHours < 1) colorClass = 'countdown-red';
        else if (totalHours < 6) colorClass = 'countdown-yellow';

        section.className = 'countdown-section ' + colorClass;
    }

    update();
    countdownInterval = setInterval(update, 1000);
}

// ==================== TEAMS LIST (READ-ONLY) ====================
async function loadSubmittedTeams() {
    try {
        const res = await fetch('/api/submissions?sort=submitted_at&order=desc');
        const submissions = await res.json();
        renderTeamsList(submissions);
    } catch (err) {
        console.error('Failed to load teams:', err);
    }
}

function renderTeamsList(submissions) {
    const container = document.getElementById('teamsList');
    const empty = document.getElementById('emptyTeams');

    if (submissions.length === 0) {
        container.innerHTML = '';
        container.appendChild(empty);
        empty.style.display = 'block';
        return;
    }

    empty.style.display = 'none';
    container.innerHTML = submissions.map(s => `
      <div class="team-card">
        <div class="team-card-info">
          <div class="team-card-name">${escapeHtml(s.team_name)}</div>
          <div class="team-card-project">${escapeHtml(s.project_title)}</div>
          <div class="team-card-members"><i class="bi bi-people"></i> ${escapeHtml(s.members)}</div>
        </div>
        <span class="badge-status badge-${s.status}">${s.status}</span>
      </div>
    `).join('');
}

// ==================== CAPTCHA ====================
function refreshCaptcha() {
    const img = document.getElementById('captchaImage');
    if (img) {
        img.src = '/api/captcha?' + Date.now();
    }
}

// ==================== EVENT LISTENERS ====================
function initEventListeners() {
    // Submission form
    document.getElementById('submissionForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const btn = document.getElementById('submitBtn');
        btn.disabled = true;
        btn.innerHTML = '<i class="bi bi-hourglass-split"></i> Mengirim...';

        try {
            const res = await fetch('/api/submissions', {
                method: 'POST',
                body: formData
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error);
            }
            showToast('Proyek berhasil disubmit! 🎉', 'success');
            e.target.reset();
            resetFileUpload();
            refreshCaptcha();
            loadSubmittedTeams();
        } catch (err) {
            showToast(err.message || 'Gagal submit proyek', 'error');
            refreshCaptcha();
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="bi bi-send-fill"></i> Submit Proyek';
        }
    });

    // Refresh captcha
    document.getElementById('refreshCaptcha').addEventListener('click', refreshCaptcha);

    // File upload interaction
    const fileInput = document.getElementById('fileUpload');
    const uploadArea = document.getElementById('fileUploadArea');
    const uploadContent = document.getElementById('fileUploadContent');
    const uploadPreview = document.getElementById('fileUploadPreview');

    fileInput.addEventListener('change', () => {
        if (fileInput.files.length > 0) {
            const file = fileInput.files[0];
            document.getElementById('fileName').textContent = file.name;
            document.getElementById('fileSize').textContent = formatFileSize(file.size);
            uploadContent.style.display = 'none';
            uploadPreview.style.display = 'flex';
        } else {
            resetFileUpload();
        }
    });

    ['dragover', 'dragenter'].forEach(evt => {
        uploadArea.addEventListener(evt, (e) => { e.preventDefault(); uploadArea.classList.add('drag-over'); });
    });
    ['dragleave', 'drop'].forEach(evt => {
        uploadArea.addEventListener(evt, () => { uploadArea.classList.remove('drag-over'); });
    });

    document.getElementById('clearFile').addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        fileInput.value = '';
        resetFileUpload();
    });
}

function resetFileUpload() {
    document.getElementById('fileUploadContent').style.display = 'flex';
    document.getElementById('fileUploadPreview').style.display = 'none';
}

function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

// ==================== UTILITIES ====================
function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}
