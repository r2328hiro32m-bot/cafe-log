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

    saveCategories(categories) {
        localStorage.setItem('cafe_categories', JSON.stringify(categories));
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

    getCompleteData() {
        return {
            categories: this.getCategories(),
            logs: this.getLogs()
        };
    }

    overwriteData(data) {
        if (data.categories) {
            this.saveCategories(data.categories);
        }
        if (data.logs) {
            localStorage.setItem('cafe_logs', JSON.stringify(data.logs));
        }
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
const chartCarousel = document.getElementById('chart-carousel');
const swipeHint = document.getElementById('swipe-hint');

// Settings Elements
const openCatEditBtn = document.getElementById('open-cat-edit-btn');
const backToTaskBtn = document.getElementById('back-to-task-btn');
const taskEntryView = document.getElementById('task-entry-view');
const categoryEditView = document.getElementById('category-edit-view');
const categoryEditList = document.getElementById('category-edit-list');
const newCategoryNameInput = document.getElementById('new-category-name');
const newCategoryColorInput = document.getElementById('new-category-color');
const addCategoryBtn = document.getElementById('add-category-btn');

// Backyard & Drive Elements
const backyardBtn = document.getElementById('backyard-btn');
const backyardModal = document.getElementById('backyard-modal');
const closeBackyardBtn = document.getElementById('close-backyard-btn');
const backupBtn = document.getElementById('backup-btn');
const restoreBtn = document.getElementById('restore-btn');
const loadingOverlay = document.getElementById('loading-overlay');
const loadingText = document.getElementById('loading-text');
const snackbar = document.getElementById('snackbar');

// Google Drive Config
const CLIENT_ID = '570189384830-umq1sust4jj1c4divbvkemm25f7i6ajm.apps.googleusercontent.com';
const SCOPES = 'https://www.googleapis.com/auth/drive.file';
const BACKUP_FILE_NAME = 'CafeLog_Backup.json';

let tokenClient;
let gapiInited = false;
let gisInited = false;

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

    // Switch to default view
    taskEntryView.style.display = 'block';
    categoryEditView.style.display = 'none';

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
let summaryCharts = []; // Array to hold multiple chart instances

function filterLogsByDateRange(logs, startDate, endDate) {
    return logs.filter(log => {
        const logDate = new Date(log.end_time);
        return logDate >= startDate && logDate <= endDate;
    });
}

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

function calculateCategoryTotals(filteredLogs) {
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

    return { categoryTotals, totalAllSec };
}

function updateSummary() {
    const logs = db.getLogs();

    // Destroy existing charts
    summaryCharts.forEach(chart => chart.destroy());
    summaryCharts = [];
    chartCarousel.innerHTML = '';

    if (currentPeriod === 'daily') {
        swipeHint.style.display = 'block';
        renderDailyCarousel(logs);
    } else {
        swipeHint.style.display = 'none';
        const filteredLogs = filterLogsByPeriod(logs, currentPeriod);
        const { categoryTotals, totalAllSec } = calculateCategoryTotals(filteredLogs);

        let label = '';
        if (currentPeriod === 'weekly') label = '過去7日間';
        if (currentPeriod === 'monthly') label = '今月';
        if (currentPeriod === 'yearly') label = '今年';

        createChartSlide(label, categoryTotals, totalAllSec, true);
        updateAIBarista(categoryTotals, totalAllSec);
    }
}

function renderDailyCarousel(logs) {
    const today = new Date();

    // Generate data for the past 7 days (including today)
    // We want the oldest day first so we can scroll to the newest (today) at the end
    const daysData = [];
    for (let i = 6; i >= 0; i--) {
        const targetDate = new Date(today);
        targetDate.setDate(today.getDate() - i);

        const startOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
        const endOfDay = new Date(startOfDay);
        endOfDay.setDate(endOfDay.getDate() + 1);
        endOfDay.setMilliseconds(endOfDay.getMilliseconds() - 1);

        const filteredLogs = filterLogsByDateRange(logs, startOfDay, endOfDay);
        const { categoryTotals, totalAllSec } = calculateCategoryTotals(filteredLogs);

        const isToday = i === 0;
        let dateLabel = `${targetDate.getMonth() + 1}月${targetDate.getDate()}日`;
        if (isToday) dateLabel = '今日';
        else if (i === 1) dateLabel = '昨日';

        daysData.push({
            dateLabel,
            categoryTotals,
            totalAllSec,
            isToday
        });
    }

    // Create slides
    daysData.forEach((data, index) => {
        const slide = createChartSlide(data.dateLabel, data.categoryTotals, data.totalAllSec, false);
        slide.dataset.index = index;

        // Store data in slide for intersection observer
        slide.categoryTotals = data.categoryTotals;
        slide.totalAllSec = data.totalAllSec;
    });

    // Scroll to the end (today)
    setTimeout(() => {
        chartCarousel.scrollLeft = chartCarousel.scrollWidth;
        // manually update AI for today initially
        const todayData = daysData[daysData.length - 1];
        updateAIBarista(todayData.categoryTotals, todayData.totalAllSec);
    }, 100);

    setupIntersectionObserver();
}

function createChartSlide(dateLabel, categoryTotals, totalAllSec, isSingle) {
    const slide = document.createElement('div');
    slide.className = 'chart-slide';

    const labelEl = document.createElement('div');
    labelEl.className = 'chart-date-label';
    labelEl.textContent = dateLabel;

    const wrapper = document.createElement('div');
    wrapper.className = 'chart-wrapper';

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    const centerIcon = document.createElement('div');
    centerIcon.className = 'chart-center-icon';
    centerIcon.textContent = '☕';

    wrapper.appendChild(canvas);
    wrapper.appendChild(centerIcon);
    slide.appendChild(labelEl);
    slide.appendChild(wrapper);

    chartCarousel.appendChild(slide);

    renderChartInstance(ctx, categoryTotals, totalAllSec);
    return slide;
}

let observer = null;
function setupIntersectionObserver() {
    if (observer) observer.disconnect();

    const slides = document.querySelectorAll('.chart-slide');
    if (slides.length === 0) return;

    observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting && entry.intersectionRatio > 0.5) {
                // This slide is currently in view
                const slide = entry.target;
                updateAIBarista(slide.categoryTotals, slide.totalAllSec);
            }
        });
    }, {
        root: chartCarousel,
        threshold: 0.6 // Trigger when 60% of the slide is visible
    });

    slides.forEach(slide => observer.observe(slide));
}

function renderChartInstance(ctx, categoryTotals, totalAllSec) {
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

    const chart = new Chart(ctx, {
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

    summaryCharts.push(chart);
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

// --- Category Settings Logic ---
function renderSettingsCategories() {
    const categories = db.getCategories();
    categoryEditList.innerHTML = '';

    categories.forEach(cat => {
        const item = document.createElement('div');
        item.className = 'category-edit-item';

        item.innerHTML = `
            <div class="category-info">
                <div class="color-dot" style="background-color: ${cat.color};"></div>
                <span class="category-name-text">${cat.name}</span>
            </div>
            <button class="delete-btn" data-id="${cat.id}">✖</button>
        `;

        categoryEditList.appendChild(item);
    });

    // Attach delete events
    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.target.getAttribute('data-id');
            deleteCategory(id);
        });
    });
}

function deleteCategory(id) {
    let categories = db.getCategories();

    // Prevent deleting the last category
    if (categories.length <= 1) {
        alert('カテゴリは最低1つ必要です。');
        return;
    }

    if (confirm('このカテゴリを削除しますか？\n（過去の記録の集計に影響する場合があります）')) {
        categories = categories.filter(c => c.id !== id);
        db.saveCategories(categories);
        renderSettingsCategories();
        updateSummary(); // Refresh summary if needed
    }
}

function addCategory() {
    const name = newCategoryNameInput.value.trim();
    const color = newCategoryColorInput.value;

    if (!name) {
        alert('カテゴリ名を入力してください。');
        return;
    }

    const categories = db.getCategories();
    categories.push({
        id: 'cat_' + Date.now(),
        name: name,
        color: color
    });

    db.saveCategories(categories);
    renderSettingsCategories();
    updateSummary();

    newCategoryNameInput.value = '';

    // Also re-render chips in case user added a category
    renderCategoryChips();
}

openCatEditBtn.addEventListener('click', () => {
    renderSettingsCategories();
    taskEntryView.style.display = 'none';
    categoryEditView.style.display = 'block';
});

backToTaskBtn.addEventListener('click', () => {
    taskEntryView.style.display = 'block';
    categoryEditView.style.display = 'none';
});

addCategoryBtn.addEventListener('click', addCategory);

// --- Google Drive Logic ---
function showLoading(text) {
    loadingText.textContent = text;
    loadingOverlay.classList.add('active');
}

function hideLoading() {
    loadingOverlay.classList.remove('active');
}

function showSnackbar(message) {
    snackbar.textContent = message;
    snackbar.classList.add('show');
    setTimeout(() => {
        snackbar.classList.remove('show');
    }, 3000);
}

// Google API Initialization
function gapiLoaded() {
    gapi.load('client', initializeGapiClient);
}

async function initializeGapiClient() {
    await gapi.client.init({
        discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
    });
    gapiInited = true;
    enableDriveButtons();
}

function gisLoaded() {
    tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: '', // defined later per action
    });
    gisInited = true;
    enableDriveButtons();
}

function enableDriveButtons() {
    if (gapiInited && gisInited) {
        backupBtn.disabled = false;
        restoreBtn.disabled = false;
    }
}

// Ensure scripts call loaded logic when ready
window.addEventListener('load', () => {
    if (window.gapi) gapiLoaded();
    if (window.google) gisLoaded();
});

function getOAuthToken(callback) {
    tokenClient.callback = async (resp) => {
        if (resp.error !== undefined) {
            throw (resp);
        }
        await callback();
    };

    if (gapi.client.getToken() === null) {
        tokenClient.requestAccessToken({ prompt: 'consent' });
    } else {
        tokenClient.requestAccessToken({ prompt: '' });
    }
}

async function findBackupFileId() {
    let response;
    try {
        response = await gapi.client.drive.files.list({
            q: `name='${BACKUP_FILE_NAME}' and trashed=false`,
            fields: 'files(id, name)',
            spaces: 'drive',
        });
    } catch (err) {
        console.error(err);
        return null;
    }
    const files = response.result.files;
    if (files && files.length > 0) {
        return files[0].id;
    } else {
        return null;
    }
}

// Backup Operation
backupBtn.addEventListener('click', () => {
    getOAuthToken(handleBackup);
});

async function handleBackup() {
    showLoading('豆を保存瓶に詰めています...');

    try {
        const fileId = await findBackupFileId();
        const dataStr = JSON.stringify(db.getCompleteData(), null, 2);

        const metadata = {
            name: BACKUP_FILE_NAME,
            mimeType: 'application/json'
        };

        const file = new Blob([dataStr], { type: 'application/json' });
        const form = new FormData();

        form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        form.append('file', file);

        let url = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
        let method = 'POST';

        if (fileId) {
            // Update existing
            url = `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart`;
            method = 'PATCH';
        }

        const fetchOptions = {
            method: method,
            headers: new Headers({ 'Authorization': 'Bearer ' + gapi.client.getToken().access_token }),
            body: form
        };

        const res = await fetch(url, fetchOptions);
        if (!res.ok) {
            throw new Error('Upload failed');
        }

        hideLoading();
        showSnackbar('保存が完了しました。今日も良い一日を！');
        backyardModal.classList.remove('active');

    } catch (error) {
        console.error(error);
        hideLoading();
        alert('バックアップに失敗しました。');
    }
}

// Restore Operation
restoreBtn.addEventListener('click', () => {
    getOAuthToken(handleRestore);
});

async function handleRestore() {
    showLoading('クラウドの棚から記録を探しています...');

    try {
        const fileId = await findBackupFileId();

        if (!fileId) {
            hideLoading();
            alert('クラウドにバックアップデータが見つかりませんでした。');
            return;
        }

        showLoading('豆を補充しています...');

        const response = await gapi.client.drive.files.get({
            fileId: fileId,
            alt: 'media'
        });

        const data = response.result;

        if (data && (data.categories || data.logs)) {
            db.overwriteData(data);
            updateSummary();
            hideLoading();
            showSnackbar('復元が完了しました。今日も良い一日を！');
            backyardModal.classList.remove('active');
        } else {
            throw new Error('Invalid data format');
        }

    } catch (error) {
        console.error(error);
        hideLoading();
        alert('復元に失敗しました。');
    }
}

// Backyard UI toggles
backyardBtn.addEventListener('click', () => {
    backyardModal.classList.add('active');
});

closeBackyardBtn.addEventListener('click', () => {
    backyardModal.classList.remove('active');
});

// Initial Render
document.addEventListener('DOMContentLoaded', () => {
    updateSummary();
    backupBtn.disabled = true;
    restoreBtn.disabled = true;
});
