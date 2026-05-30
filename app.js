/* ─────────────────────────────────────────────────
   StudyMind — AI Study Planner  |  app.js
───────────────────────────────────────────────── */

// ── Persistent Data (LocalStorage) ─────────────────
let data = JSON.parse(
  localStorage.getItem('studymind') ||
  '{"subjects":[],"tasks":[],"pomosToday":0,"pomosDate":"","streak":0,"lastStudyDate":"","pomolog":[]}'
);

// ── Constants ───────────────────────────────────────
const DAYS     = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const DAYNAMES = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];

const QUOTES = [
  ["The secret of getting ahead is getting started.", "Mark Twain"],
  ["It always seems impossible until it's done.", "Nelson Mandela"],
  ["Don't watch the clock; do what it does. Keep going.", "Sam Levenson"],
  ["Education is the most powerful weapon you can use to change the world.", "Nelson Mandela"],
  ["The beautiful thing about learning is nobody can take it away from you.", "B.B. King"],
  ["Success is the sum of small efforts repeated day in and day out.", "R. Collier"],
  ["Believe you can and you're halfway there.", "Theodore Roosevelt"],
  ["An investment in knowledge pays the best interest.", "Benjamin Franklin"],
  ["Your attitude determines your direction.", "Unknown"],
  ["Push yourself, because no one else is going to do it for you.", "Unknown"],
];

const ACHIEVEMENTS = [
  { id: 'first_task',    icon: '🌟', name: 'First Step',      desc: 'Complete your first task',          req: d => getTotalDone(d) >= 1 },
  { id: 'ten_tasks',     icon: '🎯', name: 'On a Roll',       desc: 'Complete 10 tasks',                 req: d => getTotalDone(d) >= 10 },
  { id: 'first_pomo',    icon: '🍅', name: 'Pomodoro Pro',    desc: 'Complete your first Pomodoro',      req: d => (d.totalPomos || 0) >= 1 },
  { id: 'five_pomo',     icon: '⚡', name: 'Focus Warrior',   desc: 'Complete 5 Pomodoros in a day',     req: d => d.pomosToday >= 5 },
  { id: 'first_subject', icon: '📚', name: 'Scholar',         desc: 'Add your first subject',            req: d => d.subjects.length >= 1 },
  { id: 'streak_3',      icon: '🔥', name: 'On Fire',         desc: '3-day streak',                      req: d => (d.streak || 0) >= 3 },
  { id: 'streak_7',      icon: '💎', name: 'Diamond Mind',    desc: '7-day streak',                      req: d => (d.streak || 0) >= 7 },
  { id: 'all_today',     icon: '🏆', name: 'Perfect Day',     desc: 'Complete all tasks in a day',       req: d => checkPerfectDay(d) },
  { id: 'five_subjects', icon: '🌈', name: 'Renaissance',     desc: 'Add 5+ subjects',                   req: d => d.subjects.length >= 5 },
];

// ── Pomodoro State ──────────────────────────────────
let pomoState = {
  mode: 'focus',
  running: false,
  seconds: 25 * 60,
  totalSeconds: 25 * 60,
  sessions: 0,
  interval: null,
};

const POMO_DURATIONS = { focus: 25, short: 5, long: 15 };

// ── Helpers ─────────────────────────────────────────
function save()  { localStorage.setItem('studymind', JSON.stringify(data)); }
function uid()   { return Math.random().toString(36).slice(2, 9); }

function getTotalDone(d)    { return d.tasks.filter(t => t.done).length; }
function checkPerfectDay(d) {
  const today     = getTodayKey();
  const todayTasks = d.tasks.filter(t => t.day === today);
  return todayTasks.length > 0 && todayTasks.every(t => t.done);
}

function getTodayKey() {
  return ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][new Date().getDay()];
}

function getCurrentWeekDates() {
  const today  = new Date();
  const dow    = today.getDay();
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((dow + 6) % 7));
  return DAYS.map((_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d.getDate();
  });
}

// ── Initialisation ──────────────────────────────────
function init() {
  setGreeting();
  setTopbarDate();
  renderDashboard();
  renderSubjects();
  renderWeekGrid();
  renderDailyView();
  renderPomodoro();
  renderMotivation();
  updateBadge();
  initEmojiPicker();
  initColorPicker();
  setCurrentDayInModal();
  updatePomoSettings();
}

function setGreeting() {
  const h      = new Date().getHours();
  const greet  = h < 12 ? 'Good Morning' : h < 17 ? 'Good Afternoon' : 'Good Evening';
  document.getElementById('greeting-text').innerHTML = `${greet}, <span>Scholar!</span>`;
  const q = QUOTES[Math.floor(Math.random() * QUOTES.length)];
  document.getElementById('daily-quote').textContent  = `"${q[0]}"`;
  document.getElementById('daily-author').textContent = `— ${q[1]}`;
}

function setTopbarDate() {
  document.getElementById('topbar-date').textContent =
    new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

// ── Navigation ──────────────────────────────────────
function navigate(page) {
  document.querySelectorAll('.nav-item').forEach(n => {
    n.classList.toggle('active', n.dataset.page === page);
  });
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-' + page).classList.add('active');

  const titles  = { dashboard: 'Dashboard', planner: 'Planner', subjects: 'Subjects', pomodoro: 'Pomodoro Timer', motivation: 'Motivation' };
  const actions = { dashboard: '+ Add Task', planner: '+ Add Task', subjects: '', pomodoro: '', motivation: '' };

  document.getElementById('page-title').textContent = titles[page] || page;
  const btn = document.getElementById('topbar-action');
  btn.textContent    = actions[page] || '';
  btn.style.display  = actions[page] ? '' : 'none';

  if (page === 'dashboard')  renderDashboard();
  if (page === 'planner')    { renderWeekGrid(); renderDailyView(); }
  if (page === 'subjects')   renderSubjects();
  if (page === 'motivation') renderMotivation();
}

// Wire up sidebar nav clicks
document.querySelectorAll('.nav-item').forEach(n => {
  n.addEventListener('click', () => navigate(n.dataset.page));
});

// ── Dashboard ───────────────────────────────────────
function renderDashboard() {
  const todayKey   = getTodayKey();
  const todayTasks = data.tasks.filter(t => t.day === todayKey);
  const allDone    = data.tasks.filter(t =>  t.done).length;
  const allPending = data.tasks.filter(t => !t.done).length;

  document.getElementById('stat-done').textContent    = allDone;
  document.getElementById('stat-pending').textContent = allPending;
  document.getElementById('stat-subjects').textContent= data.subjects.length;

  // Sync today's pomo count
  const today = new Date().toDateString();
  if (data.pomosDate !== today) { data.pomosToday = 0; data.pomosDate = today; save(); }
  document.getElementById('stat-pomos').textContent = data.pomosToday;

  // Subject progress bars
  const progEl = document.getElementById('dash-progress');
  if (data.subjects.length === 0) {
    progEl.innerHTML = '<div class="empty-state"><div class="empty-icon">📊</div><p>Add subjects to track progress</p></div>';
  } else {
    progEl.innerHTML = data.subjects.map(s => {
      const subTasks = data.tasks.filter(t => t.subjectId === s.id);
      const done     = subTasks.filter(t => t.done).length;
      const pct      = subTasks.length ? Math.round(done / subTasks.length * 100) : 0;
      return `<div class="progress-item">
        <div class="progress-row">
          <span class="progress-name">${s.icon} ${s.name}</span>
          <span class="progress-pct">${pct}%</span>
        </div>
        <div class="progress-bar">
          <div class="progress-fill" style="width:${pct}%;background:${s.color}"></div>
        </div>
      </div>`;
    }).join('');
  }

  // Today's tasks list
  const todayEl = document.getElementById('dash-today-tasks');
  if (todayTasks.length === 0) {
    todayEl.innerHTML = '<div class="empty-state"><div class="empty-icon">📝</div><p>No tasks for today</p></div>';
  } else {
    todayEl.innerHTML = todayTasks.slice(0, 5).map(t => {
      const s = data.subjects.find(s => s.id === t.subjectId);
      return `<div class="task-mini">
        <div class="task-mini-check ${t.done ? 'done' : ''}" onclick="toggleTask('${t.id}')">
          ${t.done ? '✓' : ''}
        </div>
        <span class="task-mini-text ${t.done ? 'done' : ''}">${t.name}</span>
        ${s ? `<span class="task-mini-subj" style="color:${s.color}">${s.icon} ${s.name}</span>` : ''}
      </div>`;
    }).join('');
  }

  // Weekly bar chart
  const barsEl = document.getElementById('week-overview-bars');
  barsEl.innerHTML = DAYS.map(d => {
    const dayTasks = data.tasks.filter(t => t.day === d);
    const done     = dayTasks.filter(t => t.done).length;
    const total    = dayTasks.length;
    const pct      = total ? Math.round(done / total * 100) : 0;
    const isToday  = d === getTodayKey();
    return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px">
      <div style="font-size:10px;color:var(--muted)">${done}/${total}</div>
      <div style="flex:1;width:100%;background:var(--surface3);border-radius:4px;overflow:hidden;min-height:8px;display:flex;flex-direction:column;justify-content:flex-end">
        <div style="background:${isToday ? 'var(--accent)' : 'var(--muted)'};height:${pct}%;min-height:${total > 0 ? '4px' : '0'};border-radius:4px;transition:height 0.5s"></div>
      </div>
      <div style="font-size:10px;color:${isToday ? 'var(--accent)' : 'var(--muted)'};font-weight:${isToday ? 700 : 400}">${d}</div>
    </div>`;
  }).join('');

  updateBadge();
}

function updateBadge() {
  document.getElementById('pending-badge').textContent = data.tasks.filter(t => !t.done).length;
}

// ── Task CRUD ───────────────────────────────────────
function openAddTaskModal(day) {
  document.getElementById('task-name').value     = '';
  document.getElementById('task-priority').value = 'medium';

  // Populate subject dropdown
  const sel = document.getElementById('task-subject');
  sel.innerHTML = '<option value="">— No Subject —</option>' +
    data.subjects.map(s => `<option value="${s.id}">${s.icon} ${s.name}</option>`).join('');

  if (day) document.getElementById('task-day').value = day;
  document.getElementById('task-modal').classList.add('open');
}

function closeModal() {
  document.getElementById('task-modal').classList.remove('open');
}

function setCurrentDayInModal() {
  document.getElementById('task-day').value = getTodayKey();
}

function saveTask() {
  const name = document.getElementById('task-name').value.trim();
  if (!name) { showToast('Please enter a task name'); return; }

  data.tasks.push({
    id:        uid(),
    name,
    subjectId: document.getElementById('task-subject').value || null,
    day:       document.getElementById('task-day').value,
    priority:  document.getElementById('task-priority').value,
    done:      false,
    createdAt: Date.now(),
  });
  save();
  closeModal();
  renderAll();
  showToast('Task added!');
}

function toggleTask(id) {
  const t = data.tasks.find(t => t.id === id);
  if (t) { t.done = !t.done; save(); renderAll(); updateStreak(); }
}

function deleteTask(id) {
  data.tasks = data.tasks.filter(t => t.id !== id);
  save();
  renderAll();
}

function renderAll() {
  renderDashboard();
  renderWeekGrid();
  renderDailyView();
  renderSubjects();
  renderMotivation();
}

// ── Planner ─────────────────────────────────────────
function switchPlannerView(view, el) {
  document.querySelectorAll('.planner-tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  document.getElementById('planner-week').style.display  = view === 'week'  ? '' : 'none';
  document.getElementById('planner-daily').style.display = view === 'daily' ? '' : 'none';
}

function renderWeekGrid() {
  const todayKey = getTodayKey();
  const dates    = getCurrentWeekDates();
  const grid     = document.getElementById('week-grid');

  grid.innerHTML = DAYS.map((d, i) => {
    const tasks = data.tasks.filter(t => t.day === d);
    return `<div class="day-col ${d === todayKey ? 'today' : ''}" id="col-${d}"
        ondragover="event.preventDefault();this.querySelector('.day-tasks').classList.add('drag-over')"
        ondragleave="this.querySelector('.day-tasks').classList.remove('drag-over')"
        ondrop="dropTask(event,'${d}')">
      <div class="day-header">
        <div class="day-name">${DAYNAMES[i].slice(0, 3).toUpperCase()}</div>
        <div class="day-num">${dates[i]}</div>
      </div>
      <div class="day-tasks" id="tasks-${d}">
        ${tasks.map(t => taskPill(t)).join('')}
        <button class="day-add-btn" onclick="openAddTaskModal('${d}')">+ Add</button>
      </div>
    </div>`;
  }).join('');

  // Attach drag listeners
  grid.querySelectorAll('.task-pill').forEach(el => {
    el.addEventListener('dragstart', e => { e.dataTransfer.setData('taskId', el.dataset.id); el.classList.add('dragging'); });
    el.addEventListener('dragend',   () => el.classList.remove('dragging'));
  });
}

function taskPill(t) {
  const s       = data.subjects.find(s => s.id === t.subjectId);
  const pColors = { low: '#5cf4c8', medium: '#fcb45c', high: '#fc5c7d' };
  const dotColor = s ? s.color : (pColors[t.priority] || '#7c5cfc');
  return `<div class="task-pill ${t.done ? 'done-pill' : ''}" draggable="true" data-id="${t.id}">
    <div class="pill-dot" style="background:${dotColor}"></div>
    <span class="pill-text">${t.name}</span>
    <span class="pill-check" onclick="toggleTask('${t.id}')">${t.done ? '✓' : '○'}</span>
    <span class="pill-delete" onclick="deleteTask('${t.id}')">✕</span>
  </div>`;
}

function dropTask(e, day) {
  e.preventDefault();
  const id   = e.dataTransfer.getData('taskId');
  const task = data.tasks.find(t => t.id === id);
  if (task) { task.day = day; save(); renderWeekGrid(); renderDailyView(); }
  document.querySelectorAll('.day-tasks').forEach(d => d.classList.remove('drag-over'));
}

function renderDailyView() {
  const todayKey = getTodayKey();
  const hours    = Array.from({ length: 14 }, (_, i) => i + 7); // 7 AM – 8 PM
  const slotsEl  = document.getElementById('time-slots');

  slotsEl.innerHTML = hours.map(h => {
    const label = h < 12 ? `${h} AM` : h === 12 ? '12 PM' : `${h - 12} PM`;
    const tasks = data.tasks.filter(t => t.day === todayKey && parseInt(t.hour) === h);
    return `<div class="time-slot">
      <div class="slot-time">${label}</div>
      <div class="slot-content"
        ondragover="event.preventDefault();this.classList.add('drag-over')"
        ondragleave="this.classList.remove('drag-over')"
        ondrop="dropToSlot(event,'${todayKey}',${h})">
        ${tasks.map(t => taskPill(t)).join('')}
      </div>
    </div>`;
  }).join('');

  // Unscheduled tasks panel
  const unscheduled = document.getElementById('unscheduled-tasks');
  const un = data.tasks.filter(t => t.day === todayKey && !t.hour);
  if (un.length === 0) {
    unscheduled.innerHTML = '<div class="empty-state"><p>No unscheduled tasks today</p></div>';
  } else {
    unscheduled.innerHTML = un.map(t => taskPill(t)).join('');
  }

  // Drag listeners for time slots
  slotsEl.querySelectorAll('.task-pill').forEach(el => {
    el.addEventListener('dragstart', e => e.dataTransfer.setData('taskId', el.dataset.id));
  });
}

function dropToSlot(e, day, hour) {
  e.preventDefault();
  const id   = e.dataTransfer.getData('taskId');
  const task = data.tasks.find(t => t.id === id);
  if (task) { task.day = day; task.hour = hour; save(); renderDailyView(); }
  document.querySelectorAll('.slot-content').forEach(d => d.classList.remove('drag-over'));
}

// ── Subjects ────────────────────────────────────────
let selectedEmoji = '📐';
let selectedColor = '#7c5cfc';

function initEmojiPicker() {
  document.querySelectorAll('.emoji-opt').forEach(el => {
    el.addEventListener('click', () => {
      document.querySelectorAll('.emoji-opt').forEach(e => e.classList.remove('selected'));
      el.classList.add('selected');
      selectedEmoji = el.dataset.e;
    });
  });
}

function initColorPicker() {
  document.querySelectorAll('.color-opt').forEach(el => {
    el.addEventListener('click', () => {
      document.querySelectorAll('.color-opt').forEach(e => e.classList.remove('selected'));
      el.classList.add('selected');
      selectedColor = el.dataset.c;
    });
  });
}

function addSubject() {
  const name = document.getElementById('new-subj-name').value.trim();
  if (!name) { showToast('Please enter a subject name'); return; }
  data.subjects.push({ id: uid(), name, icon: selectedEmoji, color: selectedColor, createdAt: Date.now() });
  document.getElementById('new-subj-name').value = '';
  save();
  renderSubjects();
  renderDashboard();
  showToast('Subject added!');
}

function deleteSubject(id) {
  data.subjects = data.subjects.filter(s => s.id !== id);
  data.tasks    = data.tasks.filter(t => t.subjectId !== id);
  save();
  renderSubjects();
  renderAll();
}

function addSubjectTask(subjectId, inputEl) {
  const name = inputEl.value.trim();
  if (!name) return;
  data.tasks.push({ id: uid(), name, subjectId, day: getTodayKey(), priority: 'medium', done: false, createdAt: Date.now() });
  inputEl.value = '';
  save();
  renderSubjects();
  renderAll();
}

function renderSubjects() {
  const grid = document.getElementById('subjects-grid');
  if (data.subjects.length === 0) {
    grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><div class="empty-icon">📚</div><p>Add your first subject above</p></div>';
    return;
  }
  grid.innerHTML = data.subjects.map(s => {
    const subTasks = data.tasks.filter(t => t.subjectId === s.id);
    const done     = subTasks.filter(t => t.done).length;
    const pct      = subTasks.length ? Math.round(done / subTasks.length * 100) : 0;
    return `<div class="subject-card">
      <div class="subject-top">
        <div class="subject-icon" style="background:${s.color}20;color:${s.color}">${s.icon}</div>
        <div class="subject-info">
          <h3>${s.name}</h3>
          <p>${subTasks.length} tasks · ${done} done</p>
        </div>
        <button class="subject-del-btn" onclick="deleteSubject('${s.id}')" title="Delete subject">🗑</button>
      </div>
      <div class="subject-progress">
        <div class="progress-row">
          <span class="progress-name" style="font-size:12px">Progress</span>
          <span class="progress-pct">${pct}%</span>
        </div>
        <div class="progress-bar">
          <div class="progress-fill" style="width:${pct}%;background:${s.color}"></div>
        </div>
      </div>
      ${subTasks.length > 0 ? `<div class="subject-tasks">
        ${subTasks.map(t => `
          <div class="subject-task-row">
            <div class="stask-check ${t.done ? 'done' : ''}" onclick="toggleTask('${t.id}')">${t.done ? '✓' : ''}</div>
            <span class="stask-name ${t.done ? 'done' : ''}">${t.name}</span>
            <span class="stask-del" onclick="deleteTask('${t.id}')">✕</span>
          </div>`).join('')}
      </div>` : ''}
      <div class="subject-footer">
        <input class="subject-add-input" id="sinput-${s.id}" placeholder="Add task..."
          onkeydown="if(event.key==='Enter') addSubjectTask('${s.id}', this)">
        <button class="btn btn-sm" onclick="addSubjectTask('${s.id}', document.getElementById('sinput-${s.id}'))">+</button>
      </div>
    </div>`;
  }).join('');
}

// ── Pomodoro ────────────────────────────────────────
function setPomoMode(mode) {
  pomoState.mode = mode;
  const mins = (data.pomoSettings && data.pomoSettings[mode]) || POMO_DURATIONS[mode];
  pomoState.seconds      = mins * 60;
  pomoState.totalSeconds = mins * 60;

  if (pomoState.running) {
    clearInterval(pomoState.interval);
    pomoState.running = false;
  }
  updatePomoUI();

  // Update sidebar mode buttons
  document.querySelectorAll('.pomo-mode-btn').forEach(b => {
    b.classList.toggle(
      'active',
      b.textContent.toLowerCase().includes(mode === 'short' ? 'short' : mode === 'long' ? 'long' : 'focus')
    );
  });
  // Update full-page mode buttons
  document.querySelectorAll('[id^="fp-"]').forEach(b => b.classList.remove('active'));
  const fpEl = document.getElementById('fp-' + mode);
  if (fpEl) fpEl.classList.add('active');
}

function togglePomo() {
  if (pomoState.running) {
    clearInterval(pomoState.interval);
    pomoState.running = false;
    document.getElementById('mini-start').textContent = '▶';
    document.getElementById('big-start').textContent  = '▶';
  } else {
    pomoState.running  = true;
    pomoState.interval = setInterval(tickPomo, 1000);
    document.getElementById('mini-start').textContent = '⏸';
    document.getElementById('big-start').textContent  = '⏸';
  }
}

function tickPomo() {
  pomoState.seconds--;

  if (pomoState.seconds <= 0) {
    clearInterval(pomoState.interval);
    pomoState.running = false;
    document.getElementById('mini-start').textContent = '▶';
    document.getElementById('big-start').textContent  = '▶';

    if (pomoState.mode === 'focus') {
      pomoState.sessions++;
      const today = new Date().toDateString();
      if (data.pomosDate !== today) { data.pomosToday = 0; data.pomosDate = today; }
      data.pomosToday++;
      data.totalPomos = (data.totalPomos || 0) + 1;

      // Log the session
      data.pomolog = data.pomolog || [];
      data.pomolog.unshift({ time: new Date().toLocaleTimeString(), duration: (data.pomoSettings?.focus || 25) });
      if (data.pomolog.length > 20) data.pomolog.pop();

      save();
      renderPomoLog();
      renderDashboard();
      showToast('🍅 Pomodoro complete! Take a break.');

      // Auto-advance: long break every 4 sessions, else short break
      if (pomoState.sessions % 4 === 0) setPomoMode('long');
      else                               setPomoMode('short');
    } else {
      showToast('Break over! Time to focus.');
      setPomoMode('focus');
    }
    return;
  }
  updatePomoUI();
}

function resetPomo() {
  clearInterval(pomoState.interval);
  pomoState.running = false;
  const mins = (data.pomoSettings && data.pomoSettings[pomoState.mode]) || POMO_DURATIONS[pomoState.mode];
  pomoState.seconds      = mins * 60;
  pomoState.totalSeconds = mins * 60;
  document.getElementById('mini-start').textContent = '▶';
  document.getElementById('big-start').textContent  = '▶';
  updatePomoUI();
}

function skipPomoSession() {
  clearInterval(pomoState.interval);
  pomoState.running  = false;
  pomoState.seconds  = 0;
  tickPomo();
}

function updatePomoSettings() {
  const f = parseInt(document.getElementById('set-focus')?.value)  || 25;
  const s = parseInt(document.getElementById('set-short')?.value)  || 5;
  const l = parseInt(document.getElementById('set-long')?.value)   || 15;
  data.pomoSettings       = { focus: f, short: s, long: l };
  POMO_DURATIONS.focus    = f;
  POMO_DURATIONS.short    = s;
  POMO_DURATIONS.long     = l;
  save();
  if (!pomoState.running) {
    const mins             = POMO_DURATIONS[pomoState.mode];
    pomoState.seconds      = mins * 60;
    pomoState.totalSeconds = mins * 60;
    updatePomoUI();
  }
}

function updatePomoUI() {
  const m     = Math.floor(pomoState.seconds / 60);
  const s     = pomoState.seconds % 60;
  const label = `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;

  document.getElementById('mini-timer').textContent = label;
  const bigTimer = document.getElementById('big-timer');
  if (bigTimer) bigTimer.textContent = label;

  // Ring progress
  const pct      = pomoState.seconds / pomoState.totalSeconds;
  const miniCirc = 175.9, bigCirc = 603.2;
  const miniEl   = document.getElementById('mini-ring');
  const bigEl    = document.getElementById('big-ring');
  if (miniEl) miniEl.style.strokeDashoffset = miniCirc * (1 - pct);
  if (bigEl)  bigEl.style.strokeDashoffset  = bigCirc  * (1 - pct);

  // Mode label & color
  const modeLabels = { focus: 'FOCUS', short: 'SHORT BREAK', long: 'LONG BREAK' };
  const modeColors = { focus: 'var(--accent)', short: 'var(--accent3)', long: 'var(--accent2)' };
  const modeEl = document.getElementById('big-mode');
  if (modeEl) modeEl.textContent = modeLabels[pomoState.mode];
  if (bigEl)  bigEl.style.stroke  = modeColors[pomoState.mode];
  if (miniEl) miniEl.style.stroke  = modeColors[pomoState.mode];
}

function renderPomodoro() {
  // Session dots
  const dots = document.getElementById('pomo-sessions');
  if (dots) {
    dots.innerHTML = Array.from({ length: 4 }, (_, i) =>
      `<div class="pomo-session-dot ${i < pomoState.sessions % 4 ? 'done' : ''}"></div>`
    ).join('');
  }
  renderPomoLog();
  updatePomoUI();

  // Restore saved settings
  if (data.pomoSettings) {
    if (document.getElementById('set-focus')) document.getElementById('set-focus').value = data.pomoSettings.focus || 25;
    if (document.getElementById('set-short')) document.getElementById('set-short').value = data.pomoSettings.short || 5;
    if (document.getElementById('set-long'))  document.getElementById('set-long').value  = data.pomoSettings.long  || 15;
    POMO_DURATIONS.focus = data.pomoSettings.focus || 25;
    POMO_DURATIONS.short = data.pomoSettings.short || 5;
    POMO_DURATIONS.long  = data.pomoSettings.long  || 15;
    if (!pomoState.running) {
      pomoState.seconds      = POMO_DURATIONS[pomoState.mode] * 60;
      pomoState.totalSeconds = POMO_DURATIONS[pomoState.mode] * 60;
      updatePomoUI();
    }
  }
}

function renderPomoLog() {
  const list = document.getElementById('pomo-log-list');
  if (!list) return;
  const log = data.pomolog || [];
  if (log.length === 0) { list.innerHTML = '<div class="empty-state"><p>No sessions yet</p></div>'; return; }
  list.innerHTML = log.slice(0, 8).map(l =>
    `<div class="pomo-log-item">
      <div class="pomo-log-dot"></div>
      Focus session · ${l.duration} min
      <span class="pomo-log-time">${l.time}</span>
    </div>`
  ).join('');
}

// ── Motivation / Streak ─────────────────────────────
function updateStreak() {
  const today     = new Date().toDateString();
  if (data.lastStudyDate === today) return;
  const yesterday = new Date(Date.now() - 86400000).toDateString();
  if (data.lastStudyDate === yesterday) {
    data.streak = (data.streak || 0) + 1;
  } else {
    data.streak = 1;
  }
  data.lastStudyDate = today;
  save();
}

function renderMotivation() {
  document.getElementById('streak-num').textContent = data.streak || 0;

  // Overall subject progress
  const overall = document.getElementById('motiv-overall-progress');
  if (data.subjects.length === 0) {
    overall.innerHTML = '<div class="empty-state"><p>No subjects yet</p></div>';
  } else {
    overall.innerHTML = data.subjects.map(s => {
      const subTasks = data.tasks.filter(t => t.subjectId === s.id);
      const done     = subTasks.filter(t => t.done).length;
      const pct      = subTasks.length ? Math.round(done / subTasks.length * 100) : 0;
      return `<div class="progress-item">
        <div class="progress-row">
          <span class="progress-name">${s.icon} ${s.name}</span>
          <span class="progress-pct">${pct}% · ${done}/${subTasks.length}</span>
        </div>
        <div class="progress-bar">
          <div class="progress-fill" style="width:${pct}%;background:${s.color}"></div>
        </div>
      </div>`;
    }).join('');
  }

  // Achievements grid
  const grid = document.getElementById('achievements');
  grid.innerHTML = ACHIEVEMENTS.map(a => {
    const unlocked = a.req(data);
    return `<div class="achievement ${unlocked ? '' : 'locked'}">
      <div class="achievement-icon">${a.icon}</div>
      <div class="achievement-name">${a.name}</div>
      <div class="achievement-desc">${a.desc}</div>
      ${unlocked ? '<div style="color:var(--accent3);font-size:11px;margin-top:4px;font-weight:600">✓ Unlocked</div>' : ''}
    </div>`;
  }).join('');
}

// ── Toast Notifications ─────────────────────────────
function showToast(msg) {
  const t     = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}

// ── Bootstrap ───────────────────────────────────────
init();
