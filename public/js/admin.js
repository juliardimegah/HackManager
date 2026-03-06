// ============================================================
//  HackManager — Admin Panel JavaScript
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
    initParticles();
    checkAuth();
});

// ==================== STATE ====================
let hackathonSettings = null;
let countdownInterval = null;
let allSubmissions = [];

// ==================== AUTH ====================
async function checkAuth() {
    try {
        const res = await fetch('/api/auth/check');
        const data = await res.json();
        if (data.isAdmin) {
            showDashboard();
        } else {
            showLoginScreen();
        }
    } catch (err) {
        showLoginScreen();
    }
}

function showLoginScreen() {
    document.getElementById('loginScreen').style.display = 'flex';
    document.getElementById('adminDashboard').style.display = 'none';
    initLoginForm();
}

function showDashboard() {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('adminDashboard').style.display = 'block';
    initTableActions();
    initConfirmModal();
    loadHackathonSettings();
    loadSubmissions();
    loadRandomizerHistory();
    initDashboardEvents();
}

function initLoginForm() {
    const form = document.getElementById('loginForm');
    // Remove old listener by cloning
    const newForm = form.cloneNode(true);
    form.parentNode.replaceChild(newForm, form);

    newForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('loginUsername').value;
        const password = document.getElementById('loginPassword').value;
        const errorDiv = document.getElementById('loginError');
        const btn = document.getElementById('loginBtn');

        btn.disabled = true;
        btn.innerHTML = '<i class="bi bi-hourglass-split"></i> Masuk...';
        errorDiv.style.display = 'none';

        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const data = await res.json();

            if (res.ok) {
                showDashboard();
            } else {
                errorDiv.textContent = data.error || 'Login gagal.';
                errorDiv.style.display = 'block';
            }
        } catch (err) {
            errorDiv.textContent = 'Koneksi error. Coba lagi.';
            errorDiv.style.display = 'block';
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="bi bi-box-arrow-in-right"></i> Masuk';
        }
    });
}

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

        const nameInput = document.getElementById('settingName');
        if (nameInput) nameInput.value = hackathonSettings.name || '';

        if (hackathonSettings.end_time) {
            const d = new Date(hackathonSettings.end_time);
            const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
            const endInput = document.getElementById('settingEndTime');
            if (endInput) endInput.value = local;
        }

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
            ['countDays', 'countHours', 'countMinutes', 'countSeconds'].forEach(id => {
                document.getElementById(id).textContent = '00';
            });
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

// ==================== SUBMISSIONS ====================
async function loadSubmissions() {
    try {
        const sortVal = document.getElementById('sortSelect').value;
        const [sort, order] = sortVal.split(':');
        const search = document.getElementById('searchInput').value;
        const params = new URLSearchParams({ sort, order, search });
        const res = await fetch('/api/submissions?' + params);
        allSubmissions = await res.json();
        renderSubmissions(allSubmissions);
        updateStats(allSubmissions);
    } catch (err) {
        console.error('Failed to load submissions:', err);
    }
}

function renderSubmissions(submissions) {
    const tbody = document.getElementById('submissionsBody');
    const empty = document.getElementById('emptySubmissions');

    if (submissions.length === 0) {
        tbody.innerHTML = '';
        empty.style.display = 'block';
        return;
    }

    empty.style.display = 'none';
    tbody.innerHTML = submissions.map(s => `
    <tr>
      <td><span style="font-family:'JetBrains Mono',monospace;font-size:0.8rem;color:var(--text-muted)">${formatDate(s.submitted_at)}</span></td>
      <td><strong>${escapeHtml(s.team_name)}</strong><div style="font-size:0.75rem;color:var(--text-muted)">${escapeHtml(s.members)}</div></td>
      <td>${escapeHtml(s.project_title)}</td>
      <td><span class="badge-status badge-${s.status}">${s.status}</span></td>
      <td>
        <div class="dropdown">
          <button class="btn btn-outline-glass btn-sm dropdown-toggle" data-bs-toggle="dropdown" aria-expanded="false"><i class="bi bi-three-dots"></i></button>
          <ul class="dropdown-menu dropdown-menu-end">
            <li><a class="dropdown-item action-detail" href="javascript:void(0)" data-id="${s.id}"><i class="bi bi-eye me-2"></i>Detail</a></li>
            <li><hr class="dropdown-divider" style="border-color:var(--border-glass)"></li>
            <li><a class="dropdown-item action-status" href="javascript:void(0)" data-id="${s.id}" data-status="pending"><i class="bi bi-hourglass me-2"></i>Set Pending</a></li>
            <li><a class="dropdown-item action-status" href="javascript:void(0)" data-id="${s.id}" data-status="reviewed"><i class="bi bi-check2 me-2"></i>Set Reviewed</a></li>
            <li><a class="dropdown-item action-status" href="javascript:void(0)" data-id="${s.id}" data-status="presented"><i class="bi bi-person-check me-2"></i>Set Presented</a></li>
            <li><hr class="dropdown-divider" style="border-color:var(--border-glass)"></li>
            <li><a class="dropdown-item text-danger action-delete" href="javascript:void(0)" data-id="${s.id}"><i class="bi bi-trash me-2"></i>Hapus</a></li>
          </ul>
        </div>
      </td>
    </tr>
  `).join('');
}

function initTableActions() {
    const tbody = document.getElementById('submissionsBody');
    tbody.addEventListener('click', (e) => {
        const target = e.target.closest('.dropdown-item');
        if (!target) return;
        e.preventDefault();
        const id = parseInt(target.dataset.id);

        if (target.classList.contains('action-detail')) viewDetail(id);
        else if (target.classList.contains('action-status')) updateStatus(id, target.dataset.status);
        else if (target.classList.contains('action-delete')) deleteSubmission(id);
    });
}

function updateStats(submissions) {
    document.getElementById('statTotal').textContent = submissions.length;
    document.getElementById('statPending').textContent = submissions.filter(s => s.status === 'pending').length;
    document.getElementById('statReviewed').textContent = submissions.filter(s => s.status === 'reviewed').length;
    document.getElementById('statPresented').textContent = submissions.filter(s => s.status === 'presented').length;
}

function viewDetail(id) {
    const s = allSubmissions.find(sub => sub.id === id);
    if (!s) return showToast('Submission tidak ditemukan', 'error');

    const statusLabel = { pending: '⏳ Pending', reviewed: '✅ Reviewed', presented: '🎤 Presented' };
    document.getElementById('detailBody').innerHTML = `
    <div class="detail-grid">
      <div class="mb-3"><strong style="color:var(--text-secondary)"><i class="bi bi-people-fill me-1"></i> Nama Tim</strong><p class="mb-1 fs-5 fw-bold">${escapeHtml(s.team_name)}</p></div>
      <div class="mb-3"><strong style="color:var(--text-secondary)"><i class="bi bi-person-lines-fill me-1"></i> Anggota</strong><p class="mb-1">${escapeHtml(s.members)}</p></div>
      <div class="mb-3"><strong style="color:var(--text-secondary)"><i class="bi bi-lightbulb-fill me-1"></i> Judul Proyek</strong><p class="mb-1 fw-semibold">${escapeHtml(s.project_title)}</p></div>
      <div class="mb-3"><strong style="color:var(--text-secondary)"><i class="bi bi-card-text me-1"></i> Deskripsi</strong><p class="mb-1">${escapeHtml(s.description || '-')}</p></div>
      <div class="mb-3"><strong style="color:var(--text-secondary)"><i class="bi bi-link-45deg me-1"></i> Link Demo</strong><p class="mb-1">${s.demo_link ? `<a href="${escapeHtml(s.demo_link)}" target="_blank" style="color:var(--accent-primary)">${escapeHtml(s.demo_link)} <i class="bi bi-box-arrow-up-right"></i></a>` : '<span style="color:var(--text-muted)">Tidak ada</span>'}</p></div>
      <div class="mb-3"><strong style="color:var(--text-secondary)"><i class="bi bi-file-earmark-arrow-down me-1"></i> File</strong><p class="mb-1">${s.file_path ? `<a href="${s.file_path}" target="_blank" style="color:var(--accent-primary)"><i class="bi bi-download"></i> Download</a>` : '<span style="color:var(--text-muted)">Tidak ada</span>'}</p></div>
      <div class="mb-3"><strong style="color:var(--text-secondary)"><i class="bi bi-flag-fill me-1"></i> Status</strong><p class="mb-0"><span class="badge-status badge-${s.status}">${statusLabel[s.status] || s.status}</span></p></div>
      <div><strong style="color:var(--text-secondary)"><i class="bi bi-clock me-1"></i> Waktu Submit</strong><p class="mb-0">${formatDate(s.submitted_at)}</p></div>
    </div>`;
    new bootstrap.Modal(document.getElementById('detailModal')).show();
}

async function updateStatus(id, status) {
    try {
        const res = await fetch(`/api/submissions/${id}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status })
        });
        if (!res.ok) {
            const data = await res.json();
            throw new Error(data.error || 'Failed');
        }
        const label = { pending: 'Pending', reviewed: 'Reviewed', presented: 'Presented' };
        showToast(`Status diubah ke "${label[status]}" ✓`, 'success');
        loadSubmissions();
    } catch (err) {
        showToast(err.message || 'Gagal mengubah status', 'error');
    }
}

function deleteSubmission(id) {
    const s = allSubmissions.find(sub => sub.id === id);
    const name = s ? s.team_name : 'submission';
    showConfirm(`Yakin ingin menghapus "${name}"?`, 'Aksi ini tidak dapat dibatalkan.', async () => {
        try {
            const res = await fetch(`/api/submissions/${id}`, { method: 'DELETE' });
            if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed'); }
            showToast(`"${name}" berhasil dihapus 🗑️`, 'success');
            loadSubmissions();
        } catch (err) {
            showToast(err.message || 'Gagal menghapus', 'error');
        }
    });
}

// ==================== RANDOMIZER ====================
let isSpinning = false;

async function pickRandom() {
    if (isSpinning) return;
    const btn = document.getElementById('btnRandomize');
    const slotText = document.getElementById('slotText');
    const slotMachine = document.getElementById('slotMachine');
    const winnerDisplay = document.getElementById('winnerDisplay');

    btn.disabled = true;
    isSpinning = true;
    winnerDisplay.classList.remove('show');
    slotMachine.classList.remove('winner');

    try {
        const res = await fetch('/api/randomizer/pick', { method: 'POST' });
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || 'Gagal memilih');
        }
        const data = await res.json();
        const { allSubmissions: teams, picked } = data;

        slotText.classList.add('spinning');
        const totalSpins = 30 + Math.floor(Math.random() * 20);
        let currentSpin = 0;
        let delay = 60;

        function doSpin() {
            if (currentSpin >= totalSpins) {
                slotText.classList.remove('spinning');
                slotText.textContent = '🏆 ' + picked.team_name;
                slotMachine.classList.add('winner');
                document.getElementById('winnerTeam').textContent = picked.team_name;
                document.getElementById('winnerProject').textContent = picked.project_title;
                winnerDisplay.classList.add('show');
                fireConfetti();
                btn.disabled = false;
                isSpinning = false;
                loadRandomizerHistory();
                loadSubmissions();
                return;
            }
            const t = teams[Math.floor(Math.random() * teams.length)];
            slotText.textContent = t.team_name;
            currentSpin++;
            if (currentSpin > totalSpins - 15) delay *= 1.15;
            setTimeout(doSpin, delay);
        }

        doSpin();
    } catch (err) {
        showToast(err.message, 'error');
        btn.disabled = false;
        isSpinning = false;
    }
}

function fireConfetti() {
    confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
    setTimeout(() => confetti({ particleCount: 50, angle: 60, spread: 55, origin: { x: 0 } }), 200);
    setTimeout(() => confetti({ particleCount: 50, angle: 120, spread: 55, origin: { x: 1 } }), 400);
    setTimeout(() => confetti({ particleCount: 30, spread: 100, shapes: ['star'], colors: ['#6366f1', '#8b5cf6', '#a855f7', '#10b981', '#f59e0b'], origin: { y: 0.5 } }), 600);
}

async function loadRandomizerHistory() {
    try {
        const res = await fetch('/api/randomizer/history');
        const history = await res.json();
        const container = document.getElementById('historyContainer');
        const empty = document.getElementById('emptyHistory');

        if (history.length === 0) {
            container.innerHTML = '';
            container.appendChild(empty);
            empty.style.display = 'block';
            return;
        }

        container.innerHTML = history.map((h, i) => `
        <div class="history-item">
          <div class="history-number">${i + 1}</div>
          <div class="history-info">
            <div class="history-team">${escapeHtml(h.team_name)}</div>
            <div class="history-project">${escapeHtml(h.project_title)}</div>
          </div>
          <div class="history-time">${formatDate(h.picked_at)}</div>
        </div>
      `).join('');
    } catch (err) {
        console.error('Failed to load history:', err);
    }
}

function clearHistory() {
    showConfirm('Hapus semua riwayat pemilihan?', 'Semua data riwayat akan dihapus secara permanen.', async () => {
        try {
            const res = await fetch('/api/randomizer/history', { method: 'DELETE' });
            if (!res.ok) throw new Error('Failed');
            showToast('Riwayat berhasil dihapus 🗑️', 'success');
            loadRandomizerHistory();
        } catch (err) {
            showToast('Gagal menghapus riwayat', 'error');
        }
    });
}

// ==================== CONFIRM MODAL ====================
let pendingConfirmAction = null;

function showConfirm(title, message, onConfirm) {
    document.getElementById('confirmTitle').innerHTML = '<i class="bi bi-exclamation-triangle-fill text-warning"></i> ' + title;
    document.getElementById('confirmMessage').textContent = message;
    pendingConfirmAction = onConfirm;
    new bootstrap.Modal(document.getElementById('confirmModal')).show();
}

function initConfirmModal() {
    document.getElementById('confirmActionBtn').addEventListener('click', () => {
        bootstrap.Modal.getInstance(document.getElementById('confirmModal')).hide();
        if (pendingConfirmAction) { pendingConfirmAction(); pendingConfirmAction = null; }
    });
}

// ==================== DASHBOARD EVENTS ====================
function initDashboardEvents() {
    // Settings form
    document.getElementById('settingsForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('settingName').value;
        const end_time = new Date(document.getElementById('settingEndTime').value).toISOString();
        try {
            const res = await fetch('/api/hackathon', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, end_time })
            });
            hackathonSettings = await res.json();
            document.getElementById('hackathonName').textContent = hackathonSettings.name;
            startCountdown();
            showToast('Pengaturan berhasil disimpan!', 'success');
        } catch (err) {
            showToast('Gagal menyimpan pengaturan', 'error');
        }
    });

    // Search & Sort
    let searchTimeout;
    document.getElementById('searchInput').addEventListener('input', () => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(loadSubmissions, 300);
    });
    document.getElementById('sortSelect').addEventListener('change', loadSubmissions);

    // Randomizer
    document.getElementById('btnRandomize').addEventListener('click', pickRandom);
    document.getElementById('btnClearHistory').addEventListener('click', clearHistory);

    // Logout
    document.getElementById('logoutBtn').addEventListener('click', async () => {
        await fetch('/api/auth/logout', { method: 'POST' });
        showToast('Logout berhasil', 'info');
        setTimeout(() => location.reload(), 500);
    });

    // Tab reload
    document.querySelectorAll('[data-bs-toggle="pill"]').forEach(tab => {
        tab.addEventListener('shown.bs.tab', (e) => {
            if (e.target.id === 'submissions-tab') loadSubmissions();
            if (e.target.id === 'randomizer-tab') loadRandomizerHistory();
            if (e.target.id === 'dashboard-tab') { loadHackathonSettings(); loadSubmissions(); }
        });
    });
}

// ==================== UTILITIES ====================
function formatDate(dateStr) {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}
