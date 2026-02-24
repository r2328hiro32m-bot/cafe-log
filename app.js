/**
 * Cafe Log - JavaScript Application Logic
 */

// Colors matching CSS variables
const COLORS = {
    work: '#D32F2F',      // 仕事
    break: '#388E3C',     // 休憩
    childcare: '#E67E22', // 育児
    hobby: '#2980B9',     // 趣味
    chores: '#F1C40F'     // 家事
};

// Default Categories
const DEFAULT_CATEGORIES = [
    { id: 'cat_work', name: '仕事', color: COLORS.work },
    { id: 'cat_break', name: '休憩', color: COLORS.break },
    { id: 'cat_childcare', name: '育児', color: COLORS.childcare },
    { id: 'cat_hobby', name: '趣味', color: COLORS.hobby },
    { id: 'cat_chores', name: '家事', color: COLORS.chores }
];

// --- DB Service ---
class DBService {
    constructor() {
        this.initCategories();
        this.initLogs();
    }

    initCategories() {
        if (!localStorage.getItem('cafe_categories')) {
            localStorage.setItem('cafe_categories', JSON.stringify(DEFAULT_CATEGORIES));
        }
    }

    initLogs() {
        if (!localStorage.getItem('cafe_logs')) {
            localStorage.setItem('cafe_logs', JSON.stringify([]));
        }
    }

    getCategories() {
        return JSON.parse(localStorage.getItem('cafe_categories') || '[]');
    }

    getLogs() {
        return JSON.parse(localStorage.getItem('cafe_logs') || '[]');
    }

    getCategoryById(id) {
        return this.getCategories().find(c => c.id === id);
    }

    addLog(taskName, categoryId, startTime, endTime, durationSec) {
        const logs = this.getLogs();
        const newLog = {
            id: 'log_' + Date.now(),
            task_name: taskName,
            category_id: categoryId,
            start_time: startTime,
            end_time: endTime,
            duration_sec: durationSec
        };
        logs.push(newLog);
        localStorage.setItem('cafe_logs', JSON.stringify(logs));
        return newLog;
    }

    getUniqueTaskNames() {
        const logs = this.getLogs();
        const names = logs.map(l => l.task_name).filter(n => n && n.trim() !== '');
        return [...new Set(names)];
    }
}

const db = new DBService();

// --- Application State ---
let isTracking = false;
let currentStartTime = null;
let timerInterval = null;
let currentSelectedCategoryId = null;

// --- DOM Elements ---
const timerDisplay = document.getElementById('timer-display');
const coffeeCupBtn = document.getElementById('coffee-cup-btn');
const timerStatus = document.getElementById('timer-status');
const taskModal = document.getElementById('task-modal');
const categoryChipsContainer = document.getElementById('category-chips');
const cancelTaskBtn = document.getElementById('cancel-task-btn');
const saveTaskBtn = document.getElementById('save-task-btn');
const taskNameInput = document.getElementById('task-name-input');
const autocompleteList = document.getElementById('autocomplete-list');
const tabBtns = document.querySelectorAll('.tab-btn');
const aiMessage = document.getElementById('ai-message');

// --- Timer Logic ---
function formatTime(totalSeconds) {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function updateTimer() {
    if (!currentStartTime) return;
    const now = new Date();
    const diffSec = Math.floor((now - currentStartTime) / 1000);
    timerDisplay.textContent = formatTime(diffSec);
}

function startTracking() {
    isTracking = true;
    currentStartTime = new Date();
    coffeeCupBtn.classList.add('is-running');
    timerStatus.textContent = 'Tap to Stop';
    timerInterval = setInterval(updateTimer, 1000);
}

function stopTracking() {
    isTracking = false;
    clearInterval(timerInterval);
    coffeeCupBtn.classList.remove('is-running');
    timerStatus.textContent = 'Tap to Start';
    openTaskModal();
}

coffeeCupBtn.addEventListener('click', () => {
    if (isTracking) {
        stopTracking();
    } else {
        startTracking();
    }
});

// --- Modal & Category Logic ---
function renderCategoryChips() {
    const categories = db.getCategories();
    categoryChipsContainer.innerHTML = '';
    categories.forEach((cat, index) => {
        const chip = document.createElement('div');
        chip.className = 'chip';
        chip.textContent = cat.name;
        chip.style.backgroundColor = cat.color;
        chip.style.color = '#fff';
        if (cat.name === '家事') {
            chip.style.color = '#4A3C31'; // make text dark for yellow background
        }

        // Select first by default
        if (index === 0) {
            chip.classList.add('active');
            chip.style.border = `2px solid ${cat.color}`;
            currentSelectedCategoryId = cat.id;
        }

        chip.addEventListener('click', () => {
            document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            currentSelectedCategoryId = cat.id;
        });

        categoryChipsContainer.appendChild(chip);
    });
}

function openTaskModal() {
    renderCategoryChips();
    taskNameInput.value = '';
    taskModal.classList.add('active');
}

function closeTaskModal() {
    taskModal.classList.remove('active');
    // reset timer view
    timerDisplay.textContent = '00:00:00';
    currentStartTime = null;
}

cancelTaskBtn.addEventListener('click', () => {
    if (confirm('記録を破棄しますか？')) {
        closeTaskModal();
    }
});

saveTaskBtn.addEventListener('click', () => {
    const taskName = taskNameInput.value.trim() || '名称未設定タスク';
    const endTime = new Date();
    const durationSec = Math.floor((endTime - currentStartTime) / 1000);

    db.addLog(taskName, currentSelectedCategoryId, currentStartTime.toISOString(), endTime.toISOString(), durationSec);
    closeTaskModal();
    updateSummary(); // Refresh summary graph
});

// --- Autocomplete Logic ---
taskNameInput.addEventListener('input', () => {
    const val = taskNameInput.value.toLowerCase();
    autocompleteList.innerHTML = '';

    if (!val) {
        autocompleteList.classList.remove('active');
        return;
    }

    const uniqueNames = db.getUniqueTaskNames();
    const matches = uniqueNames.filter(name => name.toLowerCase().includes(val));

    if (matches.length > 0) {
        autocompleteList.classList.add('active');
        matches.forEach(match => {
            const li = document.createElement('li');
            li.textContent = match;
            li.addEventListener('click', () => {
                taskNameInput.value = match;
                autocompleteList.classList.remove('active');
            });
            autocompleteList.appendChild(li);
        });
    } else {
        autocompleteList.classList.remove('active');
    }
});

document.addEventListener('click', (e) => {
    if (e.target !== taskNameInput && e.target !== autocompleteList) {
        autocompleteList.classList.remove('active');
    }
});

// --- Summary & Chart Logic ---
let currentPeriod = 'daily';
let summaryChart = null;

function filterLogsByPeriod(logs, period) {
    const now = new Date();
    return logs.filter(log => {
        const logDate = new Date(log.end_time);

        switch (period) {
            case 'daily':
                return logDate.toDateString() === now.toDateString();
            case 'weekly':
                const weekAgo = new Date(now);
                weekAgo.setDate(now.getDate() - 7);
                return logDate >= weekAgo && logDate <= now;
            case 'monthly':
                return logDate.getMonth() === now.getMonth() && logDate.getFullYear() === now.getFullYear();
            case 'yearly':
                return logDate.getFullYear() === now.getFullYear();
            default:
                return true;
        }
    });
}

function updateSummary() {
    const logs = db.getLogs();
    const filteredLogs = filterLogsByPeriod(logs, currentPeriod);

    const categoryTotals = {};
    const categories = db.getCategories();
    categories.forEach(c => categoryTotals[c.id] = { name: c.name, color: c.color, totalSec: 0 });

    let totalAllSec = 0;
    filteredLogs.forEach(log => {
        if (categoryTotals[log.category_id]) {
            categoryTotals[log.category_id].totalSec += log.duration_sec;
            totalAllSec += log.duration_sec;
        }
    });

    updateChart(categoryTotals, totalAllSec);
    updateAIBarista(categoryTotals, totalAllSec);
}

function updateChart(categoryTotals, totalAllSec) {
    const ctx = document.getElementById('summary-chart').getContext('2d');

    const labels = [];
    const data = [];
    const backgroundColor = [];

    Object.values(categoryTotals).forEach(cat => {
        if (cat.totalSec > 0) {
            labels.push(cat.name);
            data.push(cat.totalSec);
            backgroundColor.push(cat.color);
        }
    });

    if (data.length === 0) {
        labels.push('データなし');
        data.push(1);
        backgroundColor.push('#E6D5C3');
    }

    if (summaryChart) {
        summaryChart.destroy();
    }

    summaryChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: backgroundColor,
                borderWidth: 2,
                borderColor: '#FAF6F0',
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '75%',
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        font: {
                            family: "'M PLUS Rounded 1c', 'Outfit', sans-serif",
                            size: 13
                        },
                        color: '#4A3C31'
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            if (totalAllSec === 0) return ' データなし';
                            const val = context.raw;
                            const percentage = Math.round((val / totalAllSec) * 100);
                            const h = Math.floor(val / 3600);
                            const m = Math.floor((val % 3600) / 60);
                            const s = val % 60;
                            let timeStr = '';
                            if (h > 0) {
                                timeStr += `${h}時間`;
                            }
                            if (m > 0 || h === 0) {
                                timeStr += `${m}分`;
                            }
                            if (val < 60) {
                                timeStr = `${s}秒`;
                            }
                            return ` ${timeStr} (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
}

tabBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
        tabBtns.forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        currentPeriod = e.target.dataset.period;
        updateSummary();
    });
});

// --- AI Barista Logic ---
function updateAIBarista(categoryTotals, totalAllSec) {
    if (totalAllSec === 0) {
        aiMessage.textContent = 'こんにちは！今日も一杯のコーヒーから始めませんか？カップをタップして記録をスタートしましょう。';
        return;
    }

    let maxCat = null;
    let maxSec = 0;
    let breakSec = categoryTotals['cat_break']?.totalSec || 0;

    Object.values(categoryTotals).forEach(cat => {
        if (cat.totalSec > maxSec) {
            maxSec = cat.totalSec;
            maxCat = cat;
        }
    });

    let message = '';

    if (maxCat.name === '仕事') {
        if (breakSec === 0) {
            message = 'お仕事お疲れ様です。集中されていますね！でも、そろそろ少しだけ休憩を挟んで、温かいコーヒーでもどうですか？';
        } else {
            message = 'お仕事お疲れ様です。適度に休憩も取れていて素晴らしいペースです！この調子で頑張りましょう。';
        }
    } else if (maxCat.name === '休憩') {
        message = 'ゆっくりとした時間を過ごせていますね。心と体を休めることはとても大切です。リラックスしてくださいね。';
    } else if (maxCat.name === '育児') {
        message = '育児、本当にお疲れ様です！毎日頑張っているご自身を、たまにはめいっぱい甘やかしてあげてくださいね。';
    } else if (maxCat.name === '趣味') {
        message = '好きなことに没頭できる時間は至福ですね。その充実感が、明日への素敵なエネルギーになりますよ！';
    } else if (maxCat.name === '家事') {
        message = '家事お疲れ様です。あなたの頑張りが毎日の心地よい暮らしを作っています。少し休んでホッと一息つきましょう。';
    } else {
        message = '今日も一日お疲れ様です。ゆっくり休んでくださいね。';
    }

    aiMessage.textContent = message;
}

// Initial Render
document.addEventListener('DOMContentLoaded', () => {
    updateSummary();
});
