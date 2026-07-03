  function app() {
    return {
      activeTab: 'today',
      tabs: [
        { id: 'today', label: 'Today', icon: '☀️' },
        { id: 'backlog', label: 'Backlog', icon: '📥' },
        { id: 'habits', label: 'Habits', icon: '🔁' },
        { id: 'history', label: 'History', icon: '📖' },
        { id: 'metrics', label: 'Momentum', icon: '📈' },
      ],
      today: '',
      minDate: '',
      selectedDate: '',
      install: '',
      goals: {},
      backlog: [],
      recurring: [],
      seeded: {},
      newGoal: { topic: '', hours: 1, subtasksText: '' },
      // Transient "new subtask" input text, keyed by goal id. Intentionally NOT
      // part of snapshot() - half-typed drafts must never be persisted to disk.
      subtaskDrafts: {},
      newHabit: { topic: '', hours: 0.5, subtasksText: '', days: [0,1,2,3,4,5,6] },
      habitFormOpen: false,
      editingId: null,
      editingGoalId: null,   // which goal is in inline-edit mode; transient, never persisted
      weekdayNames: ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'],
      weekdayShort: ['Su','Mo','Tu','We','Th','Fr','Sa'],
      historyFilter: 'all',
      expandedHistoryDates: [],
      userName: '',
      nameInput: '',
      loggedIn: false,
      users: [],
      loginError: '',
      saveStatus: 'idle',   // idle | saving | saved | error
      _saveTimer: null,
      quote: '',
      _charts: {},

      quotes: [
        "Small steps every day add up to big results.",
        "Discipline is choosing between what you want now and what you want most.",
        "You don't have to be extreme, just consistent.",
        "The secret of getting ahead is getting started.",
        "A goal without a plan is just a wish.",
        "Done is better than perfect.",
        "Success is the sum of small efforts repeated day in and day out.",
        "What you do today can improve all your tomorrows.",
        "Focus on being productive instead of busy.",
        "The future depends on what you do today.",
      ],

      async init() {
        // Guard: opening index.html directly (file://) renders the UI but has no
        // server behind it, so nothing can load or save. Point at the real app.
        if (location.protocol === 'file:') {
          document.body.innerHTML =
            '<div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:#14121f;color:#ece9f5;font-family:system-ui,sans-serif;text-align:center;padding:2rem">' +
            '<div style="max-width:26rem"><div style="font-size:3rem;margin-bottom:0.75rem">🚪</div>' +
            '<div style="font-size:1.15rem;font-weight:600">This file isn\'t the app</div>' +
            '<div style="color:#a49fc0;font-size:0.9rem;margin-top:0.5rem;line-height:1.5">You opened <b>index.html</b> directly, so there is no server to load or save your data.<br><br>' +
            'Start Momentum by double-clicking <b>Momentum.pyw</b>, or if it\'s already running, open:</div>' +
            '<a href="http://localhost:8899" style="display:inline-block;margin-top:1rem;padding:0.7rem 1.4rem;border-radius:0.8rem;background:linear-gradient(120deg,#8b5cf6,#ec4899);color:#fff;font-weight:600;text-decoration:none">Open Momentum →</a></div></div>';
          return;
        }
        this.today = this.dateStr(new Date());
        this.selectedDate = this.today;
        this.pickQuote();
        await this.fetchUsers();
        // Watchers are registered once here (not on login) so logging out and back
        // in never stacks duplicate watchers. They no-op until a user is loaded.
        this.$watch('selectedDate', (d) => { this.editingGoalId = null; this.ensureRecurring(d); });
        this.$watch('activeTab', (tab) => {
          if (tab === 'metrics' && this.loggedIn) this.$nextTick(() => this.renderCharts());
        });
        // Best-effort flush if the tab is closed with an unsaved change pending.
        window.addEventListener('beforeunload', () => this.beacon());
      },

      pickQuote() {
        const day = new Date().getDate();
        this.quote = this.quotes[day % this.quotes.length];
      },

      // ---- Users / auth ----
      normalizeUsername(name) {
        if (typeof name !== 'string') return '';
        const n = name.trim().toLowerCase();
        return /^[a-z0-9][a-z0-9_-]{0,31}$/.test(n) ? n : '';
      },
      async fetchUsers() {
        try {
          const res = await fetch('/api/users');
          this.users = res.ok ? await res.json() : [];
        } catch (e) { this.users = []; }
      },
      // Log in to an existing profile. New profiles are created via signup().
      async login(name) {
        const clean = this.normalizeUsername(name ?? this.nameInput);
        if (!clean) { this.loginError = 'Use letters, numbers, - or _ (max 32 chars).'; return; }
        try {
          const res = await fetch('/api/load?user=' + encodeURIComponent(clean));
          if (res.ok) {
            const d = await res.json();
            this.goals = d.goals || {};
            this.backlog = d.backlog || [];
            this.recurring = d.recurring || [];
            this.seeded = d.seeded || {};
            this.install = d.install || this.today;
          } else if (res.status === 404) {
            this.loginError = `No profile named "${clean}" yet - click Sign up to create it.`;
            return;
          } else {
            this.loginError = 'Could not load that profile (it may be corrupt).';
            return;
          }
        } catch (e) {
          this.loginError = 'Cannot reach Momentum\'s server. Start it by double-clicking Momentum.pyw, then open http://localhost:8899.';
          return;
        }
        await this._enterProfile(clean);
      },
      // Create a brand-new profile. Refuses usernames that already exist so
      // one person can't silently open (and overwrite) someone else's data.
      async signup(name) {
        const clean = this.normalizeUsername(name ?? this.nameInput);
        if (!clean) { this.loginError = 'Use letters, numbers, - or _ (max 32 chars).'; return; }
        try {
          // Ask the server, not this.users, so a stale list can't allow a clash.
          const res = await fetch('/api/load?user=' + encodeURIComponent(clean));
          if (res.ok) {
            this.loginError = `"${clean}" already exists - use Log in instead.`;
            return;
          }
          if (res.status !== 404) {
            this.loginError = 'Could not check that username. Try again.';
            return;
          }
        } catch (e) {
          this.loginError = 'Cannot reach Momentum\'s server. Start it by double-clicking Momentum.pyw, then open http://localhost:8899.';
          return;
        }
        // Brand-new user: empty profile installed today.
        this.goals = {}; this.backlog = []; this.recurring = []; this.seeded = {};
        this.install = this.today;
        await this._enterProfile(clean);
      },
      // Shared tail of login/signup: activate the loaded state and persist it.
      async _enterProfile(clean) {
        this.userName = clean;
        this.loginError = '';
        this.selectedDate = this.today;
        const dataDates = Object.keys(this.goals).filter(d => (this.goals[d] || []).length > 0);
        this.minDate = dataDates.length ? [this.install, ...dataDates].sort()[0] : this.install;
        this.loggedIn = true;
        this.ensureRecurring(this.today);
        await this.flushNow();   // persist immediately so a new profile's file exists
        await this.fetchUsers();
      },
      logout() {
        this.flushNow();          // best-effort save of any pending change
        this.loggedIn = false;
        this.nameInput = '';
        this.loginError = '';
        this.activeTab = 'today';
        this.fetchUsers();
      },
      // Stops the hidden server started by Momentum.pyw. Data is flushed first.
      async quitApp() {
        if (!confirm('Quit Momentum? Your data is saved and the app will stop.')) return;
        await this.flushNow();
        try { await fetch('/api/quit', { method: 'POST' }); } catch (e) {}
        document.body.innerHTML =
          '<div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:#14121f;color:#ece9f5;font-family:system-ui,sans-serif;text-align:center;padding:2rem">' +
          '<div><div style="font-size:3rem;margin-bottom:0.75rem">👋</div>' +
          '<div style="font-size:1.15rem;font-weight:600">Momentum is closed</div>' +
          '<div style="color:#a49fc0;font-size:0.9rem;margin-top:0.4rem">Your data is saved. You can close this tab.<br>Double-click Momentum.pyw to start it again.</div></div></div>';
      },
      displayName() {
        const n = this.userName || '';
        return n ? n.charAt(0).toUpperCase() + n.slice(1) : '';
      },
      userInitial() {
        return (this.userName || '?').trim().charAt(0).toUpperCase();
      },

      // ---- Greeting ----
      hourNow() { return new Date().getHours(); },
      isEvening() { const h = this.hourNow(); return h >= 20 || h < 4; },
      greeting() {
        const h = this.hourNow();
        if (h < 5) return "Burning the midnight oil";
        if (h < 12) return "Good morning";
        if (h < 17) return "Good afternoon";
        if (h < 21) return "Good evening";
        return "Winding down";
      },
      dateLabel() {
        const d = new Date();
        return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
      },

      // ---- Persistence (local server -> userData/<username>.json) ----
      // Snapshot of everything that belongs to the current user's file.
      snapshot() {
        return {
          username: this.userName,
          install: this.install,
          updatedAt: new Date().toISOString(),
          goals: this.goals,
          backlog: this.backlog,
          recurring: this.recurring,
          seeded: this.seeded,
        };
      },
      // Debounced save: many rapid mutations (checking subtasks, etc.) collapse
      // into a single request 400ms after the last change.
      save() {
        if (!this.loggedIn) return;
        clearTimeout(this._saveTimer);
        this._saveTimer = setTimeout(() => this.flushNow(), 400);
      },
      async flushNow() {
        if (!this.loggedIn || !this.userName) return;
        clearTimeout(this._saveTimer);
        this.saveStatus = 'saving';
        try {
          const res = await fetch('/api/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: this.userName, data: this.snapshot() }),
          });
          if (!res.ok) throw new Error('save failed');
          this.saveStatus = 'saved';
          setTimeout(() => { if (this.saveStatus === 'saved') this.saveStatus = 'idle'; }, 1500);
        } catch (e) {
          this.saveStatus = 'error';   // surfaced in header; click to retry
        }
      },
      // Fire-and-forget save on tab close (fetch may be cancelled; beacon isn't).
      beacon() {
        if (!this.loggedIn || !this.userName) return;
        const body = JSON.stringify({ username: this.userName, data: this.snapshot() });
        navigator.sendBeacon('/api/save', new Blob([body], { type: 'application/json' }));
      },

      // ---- Import / Export (JSON) ----
      exportData() {
        const blob = new Blob([JSON.stringify(this.snapshot(), null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `momentum-${this.userName}-${this.today}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      },
      async importData(ev) {
        const file = ev.target.files && ev.target.files[0];
        if (!file) return;
        try {
          const d = JSON.parse(await file.text());
          if (typeof d !== 'object' || d === null) throw new Error('bad shape');
          if (!confirm(`Import will replace ${this.displayName()}'s current data with this file. Continue?`)) return;
          this.goals = d.goals || {};
          this.backlog = d.backlog || [];
          this.recurring = d.recurring || [];
          this.seeded = d.seeded || {};
          if (d.install) this.install = d.install;
          this.selectedDate = this.today;
          const dataDates = Object.keys(this.goals).filter(x => (this.goals[x] || []).length > 0);
          this.minDate = dataDates.length ? [this.install, ...dataDates].sort()[0] : this.install;
          this.ensureRecurring(this.today);
          await this.flushNow();
          if (this.activeTab === 'metrics') this.$nextTick(() => this.renderCharts());
          alert('Import complete.');
        } catch (e) {
          alert('Import failed: that file is not valid Momentum JSON.');
        } finally {
          ev.target.value = '';   // allow re-importing the same file
        }
      },

      // ---- Helpers ----
      dateStr(d) {
        return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      },
      shiftDate(delta) {
        const d = new Date(this.selectedDate + 'T00:00:00');
        d.setDate(d.getDate() + delta);
        const ns = this.dateStr(d);
        if (ns < this.minDate) return; // never before install date
        this.selectedDate = ns;
        this.onDateChange();
      },
      onDateChange() {},
      formatDisplayDate(dateStr) {
        if (!dateStr) return '';
        const d = new Date(dateStr + 'T00:00:00');
        const s = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
        if (dateStr === this.today) return s + ' · Today';
        return s;
      },
      ageLabel(dateStr) {
        if (!dateStr) return '';
        const a = new Date(dateStr + 'T00:00:00');
        const b = new Date(this.today + 'T00:00:00');
        const days = Math.round((b - a) / 86400000);
        if (days <= 0) return 'today';
        if (days === 1) return 'yesterday';
        if (days < 7) return days + 'd ago';
        if (days < 30) return Math.floor(days/7) + 'w ago';
        return Math.floor(days/30) + 'mo ago';
      },
      uid() { return Math.random().toString(36).slice(2) + Date.now().toString(36); },

      // ---- Goals ----
      goalsForDate(date) { return this.goals[date] || []; },
      addGoal() {
        if (!this.newGoal.topic.trim()) return;
        const subtasks = this.newGoal.subtasksText.split('\n').map(s => s.trim()).filter(Boolean).map(text => ({ id: this.uid(), text, completed: false }));
        const goal = {
          id: this.uid(),
          topic: this.newGoal.topic.trim(),
          hours: this.newGoal.hours || 1,
          loggedHours: null,
          completed: false,
          subtasks,
          createdAt: this.selectedDate,
          addingSubtask: false,
        };
        if (!this.goals[this.selectedDate]) this.goals[this.selectedDate] = [];
        this.goals[this.selectedDate].push(goal);
        this.save();
        this.resetNewGoal();
      },
      resetNewGoal() { this.newGoal = { topic: '', hours: 1, subtasksText: '' }; },
      toggleGoal(date, gi, ev) {
        const g = this.goals[date][gi];
        g.completed = !g.completed;
        if (g.completed) {
          g.subtasks.forEach(s => s.completed = true);
          if (ev) this.celebrate(ev);
        }
        this.save();
      },
      toggleSubtask(date, gi, si) {
        const goal = this.goals[date][gi];
        goal.subtasks[si].completed = !goal.subtasks[si].completed;
        goal.completed = goal.subtasks.every(s => s.completed);
        this.save();
      },
      commitSubtask(date, gi) {
        const goal = this.goals[date][gi];
        const text = (this.subtaskDrafts[goal.id] || '').trim();
        if (!text) return;
        goal.subtasks.push({ id: this.uid(), text, completed: false });
        delete this.subtaskDrafts[goal.id];   // clear the transient draft
        goal.completed = false;
        this.save();
      },
      logHours(date, gi, val) {
        this.goals[date][gi].loggedHours = parseFloat(val) || 0;
        this.save();
      },
      deleteGoal(date, gi) { this.goals[date].splice(gi, 1); this.save(); },

      // ---- Inline goal editing ----
      // Live edits: the template binds title/hours/subtask text straight to the goal
      // via x-model, so every keystroke mutates state and the debounced save() persists it.
      startEditGoal(goal) { this.editingGoalId = goal.id; },
      stopEditGoal(goal) {
        goal.topic = this.cleanText(goal.topic);
        const h = parseFloat(goal.hours);
        goal.hours = isNaN(h) || h < 0 ? 0 : h;   // guard against a cleared/negative hours field
        // Strip blank lines from each subtask, then drop any that ended up empty.
        goal.subtasks.forEach(s => { s.text = this.cleanText(s.text); });
        goal.subtasks = goal.subtasks.filter(s => s.text !== '');
        if (goal.subtasks.length > 0) goal.completed = goal.subtasks.every(s => s.completed);
        this.editingGoalId = null;
        this.save();
      },
      removeSubtask(date, gi, si) {
        const goal = this.goals[date][gi];
        goal.subtasks.splice(si, 1);
        // Recompute completion from what remains; don't let an emptied list flip the goal complete.
        if (goal.subtasks.length > 0) goal.completed = goal.subtasks.every(s => s.completed);
        this.save();
      },
      // Grow an edit <textarea> to fit its content: reset to auto, then match scrollHeight.
      // Called on x-init (when the field appears) and on every keystroke.
      autoGrow(el) {
        if (!el) return;
        el.style.height = 'auto';
        el.style.height = el.scrollHeight + 'px';
      },
      // Tidy multi-line text on save: drop blank lines and trailing whitespace so
      // stray newlines don't persist as wasted space. Run on Done, never while typing.
      cleanText(s) {
        return (s || '')
          .split('\n')
          .map(line => line.replace(/\s+$/, ''))
          .filter(line => line.trim() !== '')
          .join('\n');
      },
      subtaskProgress(goal) {
        const done = goal.subtasks.filter(s => s.completed).length;
        return `${done}/${goal.subtasks.length}`;
      },

      // ---- Celebration ----
      celebrate(ev) {
        const colors = ['#a78bfa','#f472b6','#fbbf24','#34d399','#60a5fa'];
        const rect = ev.currentTarget.getBoundingClientRect();
        const cx = rect.left + rect.width/2;
        for (let i = 0; i < 24; i++) {
          const p = document.createElement('div');
          p.className = 'confetti-piece';
          p.style.left = cx + 'px';
          p.style.background = colors[i % colors.length];
          p.style.animationDuration = (0.9 + Math.random()*0.7) + 's';
          const dx = (Math.random()-0.5) * 260;
          p.style.setProperty('transform', `translateX(${dx}px)`);
          p.animate([
            { transform: 'translate(0,0) rotate(0)', opacity: 1 },
            { transform: `translate(${dx}px, 90vh) rotate(${Math.random()*720}deg)`, opacity: 0 }
          ], { duration: 900 + Math.random()*700, easing: 'cubic-bezier(0.2,0.6,0.4,1)' });
          document.body.appendChild(p);
          setTimeout(() => p.remove(), 1700);
        }
      },

      // ---- Backlog ----
      moveToBacklog(date, gi) {
        const goal = this.goals[date].splice(gi, 1)[0];
        goal.originalDate = goal.createdAt || date;
        goal.backlognedAt = this.today;
        goal.addingSubtask = false;
        this.backlog.unshift(goal);
        this.save();
      },
      endOfDay() {
        const goals = this.goals[this.selectedDate] || [];
        // Daily habits are never backlogged - a missed habit just stays missed for that day.
        const toBacklog = goals.filter(g => !g.completed && !g.recurringId);
        if (toBacklog.length === 0) { alert("Nothing to carry over - habits aside, you're all caught up! 🎉"); return; }
        if (!confirm(`Move ${toBacklog.length} unfinished goal(s) to your backlog? (Daily habits stay put.)`)) return;
        this.goals[this.selectedDate] = goals.filter(g => g.completed || g.recurringId);
        toBacklog.forEach(g => {
          g.originalDate = g.createdAt || this.selectedDate;
          g.backlognedAt = this.today;
          g.addingSubtask = false;
          this.backlog.unshift(g);
        });
        this.save();
      },
      scheduleFromBacklog(idx, date) {
        if (!date) return;
        const item = this.backlog.splice(idx, 1)[0];
        item.createdAt = date;
        item.addingSubtask = false;
        if (!this.goals[date]) this.goals[date] = [];
        this.goals[date].push(item);
        this.save();
      },
      deleteBacklogItem(idx) { this.backlog.splice(idx, 1); this.save(); },

      // ---- Recurring habits ----
      // Habits are templates materialized into each day's goal list on demand. We only ever seed
      // the *current* day (never the past, never future days on mere navigation), and only habits
      // whose weekday schedule includes that day. seeded[] remembers what was placed per date so a
      // deleted instance doesn't reappear.
      ensureRecurring(date) {
        if (!date || date !== this.today) return;
        const dow = new Date(date + 'T00:00:00').getDay();
        if (!this.seeded[date]) this.seeded[date] = [];
        let changed = false;
        for (const r of this.recurring) {
          if (date < (r.startDate || this.today)) continue;
          if (!(r.days || [0,1,2,3,4,5,6]).includes(dow)) continue; // not scheduled this weekday
          if (this.seeded[date].includes(r.id)) continue;
          const exists = (this.goals[date] || []).some(g => g.recurringId === r.id);
          if (!exists) {
            if (!this.goals[date]) this.goals[date] = [];
            this.goals[date].push(this.instantiateHabit(r, date));
          }
          this.seeded[date].push(r.id);
          changed = true;
        }
        if (changed) this.save();
      },
      instantiateHabit(r, date) {
        return {
          id: this.uid(),
          topic: r.topic,
          hours: r.hours || 0.5,
          loggedHours: null,
          completed: false,
          subtasks: (r.subtasks || []).map(s => ({ id: this.uid(), text: s.text, completed: false })),
          createdAt: date,
          addingSubtask: false,
          recurringId: r.id,
        };
      },
      // Habits whose weekday schedule includes the given date (used for the future-day hint).
      habitsOnDate(date) {
        if (!date) return [];
        const dow = new Date(date + 'T00:00:00').getDay();
        return this.recurring.filter(r => (r.days || [0,1,2,3,4,5,6]).includes(dow));
      },
      scheduleLabel(days) {
        const d = (days && days.length) ? days : [0,1,2,3,4,5,6];
        if (d.length === 7) return 'Every day';
        if (d.length === 5 && [1,2,3,4,5].every(x => d.includes(x))) return 'Weekdays';
        if (d.length === 2 && [0,6].every(x => d.includes(x))) return 'Weekends';
        return d.slice().sort((a,b) => a-b).map(i => this.weekdayNames[i]).join(', ');
      },

      // ---- Habit form (add + edit) ----
      openAddHabit() { this.editingId = null; this.resetNewHabit(); this.habitFormOpen = true; },
      openEditHabit(h) {
        this.editingId = h.id;
        this.newHabit = {
          topic: h.topic,
          hours: h.hours,
          subtasksText: (h.subtasks || []).map(s => s.text).join('\n'),
          days: [...(h.days || [0,1,2,3,4,5,6])],
        };
        this.habitFormOpen = true;
      },
      closeHabitForm() { this.habitFormOpen = false; this.editingId = null; this.resetNewHabit(); },
      toggleHabitDay(i) {
        const arr = this.newHabit.days;
        const idx = arr.indexOf(i);
        if (idx === -1) arr.push(i); else arr.splice(idx, 1);
      },
      setHabitDays(preset) {
        if (preset === 'all') this.newHabit.days = [0,1,2,3,4,5,6];
        else if (preset === 'weekdays') this.newHabit.days = [1,2,3,4,5];
        else if (preset === 'weekends') this.newHabit.days = [0,6];
      },
      submitHabit() {
        const topic = this.newHabit.topic.trim();
        if (!topic || this.newHabit.days.length === 0) return;
        const hours = this.newHabit.hours || 0.5;
        const subtasks = this.newHabit.subtasksText.split('\n').map(s => s.trim()).filter(Boolean).map(text => ({ text }));
        const days = [...this.newHabit.days].sort((a,b) => a-b);
        if (this.editingId) {
          const h = this.recurring.find(r => r.id === this.editingId);
          if (h) { h.topic = topic; h.hours = hours; h.subtasks = subtasks; h.days = days; }
          this.syncHabitToToday(this.editingId, topic, hours, subtasks, days);
        } else {
          this.recurring.push({ id: this.uid(), topic, hours, subtasks, startDate: this.today, days });
        }
        this.save();
        this.closeHabitForm();
        this.ensureRecurring(this.today);
      },
      // Reflect a template edit onto today's still-untouched instance so customization takes effect now.
      syncHabitToToday(id, topic, hours, subtasks, days) {
        const list = this.goals[this.today] || [];
        const inst = list.find(g => g.recurringId === id);
        if (!inst || inst.completed) return; // never rewrite a completed instance
        const touched = inst.subtasks.some(s => s.completed);
        const dow = new Date(this.today + 'T00:00:00').getDay();
        if (!days.includes(dow) && !touched) {
          // no longer scheduled today -> pull the untouched instance back out
          list.splice(list.indexOf(inst), 1);
          if (this.seeded[this.today]) this.seeded[this.today] = this.seeded[this.today].filter(x => x !== id);
          return;
        }
        inst.topic = topic;
        inst.hours = hours;
        if (!touched) inst.subtasks = subtasks.map(s => ({ id: this.uid(), text: s.text, completed: false }));
      },
      resetNewHabit() { this.newHabit = { topic: '', hours: 0.5, subtasksText: '', days: [0,1,2,3,4,5,6] }; },
      deleteHabit(idx) {
        if (!confirm('Stop this habit? Days already logged keep their record.')) return;
        this.recurring.splice(idx, 1);
        this.save();
      },

      // ---- Scoring (partial credit) ----
      // Fraction of a goal that's done, 0..1. A goal with subtasks earns partial
      // credit for each finished subtask; a goal without subtasks stays all-or-nothing.
      goalProgress(g) {
        if (g.completed) return 1;
        const subs = g.subtasks || [];
        if (subs.length) return subs.filter(s => s.completed).length / subs.length;
        return 0;
      },
      // Whole-day progress as a rounded percent, averaging per-goal progress so
      // partial work still moves the needle. Only reports 100 when every goal is
      // truly complete - rounding must never fake a perfect day.
      dayProgressPct(gs) {
        if (!gs.length) return 0;
        if (gs.every(g => g.completed)) return 100;
        const avg = gs.reduce((s, g) => s + this.goalProgress(g), 0) / gs.length;
        return Math.min(99, Math.round(avg * 100));
      },

      // ---- Day stats ----
      dayStats() {
        const gs = this.goalsForDate(this.selectedDate);
        const completed = gs.filter(g => g.completed).length;
        const total = gs.length;
        const hours = gs.reduce((s, g) => s + (parseFloat(g.hours) || 0), 0);
        const doneHours = gs.filter(g => g.completed).reduce((s, g) => s + (parseFloat(g.loggedHours ?? g.hours) || 0), 0);
        const pct = this.dayProgressPct(gs);
        return { completed, total, hours: +hours.toFixed(2), doneHours: +doneHours.toFixed(2), pct };
      },

      // ---- History ----
      historyDates() {
        return Object.keys(this.goals).filter(d => (this.goals[d] || []).length > 0 && d <= this.today).sort((a, b) => b.localeCompare(a));
      },
      toggleHistoryDate(date) {
        const idx = this.expandedHistoryDates.indexOf(date);
        if (idx === -1) this.expandedHistoryDates.push(date);
        else this.expandedHistoryDates.splice(idx, 1);
      },
      historyDayPct(date) {
        return this.dayProgressPct(this.goals[date] || []);
      },
      historyDaySummary(date) {
        const gs = this.goals[date] || [];
        const done = gs.filter(g => g.completed).length;
        const hrs = gs.reduce((s, g) => s + (parseFloat(g.loggedHours ?? g.hours) || 0), 0);
        return `${done}/${gs.length} goals · ${+hrs.toFixed(1)}h`;
      },
      filteredHistoryGoals(date) {
        const gs = this.goals[date] || [];
        if (this.historyFilter === 'complete') return gs.filter(g => g.completed);
        if (this.historyFilter === 'incomplete') return gs.filter(g => !g.completed);
        return gs;
      },

      // ---- Metrics ----
      getLast7Days() {
        return Array.from({ length: 7 }, (_, i) => {
          const d = new Date(this.today + 'T00:00:00');
          d.setDate(d.getDate() - (6 - i));
          return this.dateStr(d);
        });
      },
      getLast4Weeks() {
        const weeks = [];
        for (let w = 3; w >= 0; w--) {
          const days = Array.from({ length: 7 }, (_, i) => {
            const d = new Date(this.today + 'T00:00:00');
            d.setDate(d.getDate() - (w * 7) - (6 - i));
            return this.dateStr(d);
          });
          weeks.push(days);
        }
        return weeks;
      },
      metrics() {
        const days = this.getLast7Days();
        // A day keeps the streak alive once its partial-credit progress clears this bar,
        // so a strong-but-imperfect day no longer breaks the chain.
        const STREAK_THRESHOLD = 70;
        let streak = 0;
        for (let i = days.length - 1; i >= 0; i--) {
          const gs = this.goals[days[i]] || [];
          if (gs.length === 0) break;
          if (this.dayProgressPct(gs) >= STREAK_THRESHOLD) streak++;
          else break;
        }
        const activePcts = days.filter(d => (this.goals[d] || []).length > 0)
          .map(d => this.dayProgressPct(this.goals[d]));
        const avgWeek = activePcts.length ? Math.round(activePcts.reduce((a, b) => a + b, 0) / activePcts.length) : 0;
        const totalHours = days.reduce((s, d) => s + (this.goals[d] || []).filter(g=>g.completed).reduce((ss, g) => ss + (parseFloat(g.loggedHours ?? g.hours) || 0), 0), 0);
        const totalGoals = days.reduce((s, d) => s + (this.goals[d] || []).length, 0);
        return { streak, avgWeek, totalHours: +totalHours.toFixed(1), totalGoals };
      },

      renderCharts() {
        const DEF = {
          responsive: true,
          plugins: { legend: { display: false } },
          scales: {
            x: { ticks: { color: '#a49fc0', font: { size: 11 } }, grid: { color: 'rgba(255,255,255,0.05)' } },
            y: { ticks: { color: '#a49fc0', font: { size: 11 } }, grid: { color: 'rgba(255,255,255,0.05)' } },
          },
        };
        const days = this.getLast7Days();
        const dailyLabels = days.map(d => new Date(d + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' }));
        const dailyCompleted = days.map(d => (this.goals[d] || []).filter(g => g.completed).length);
        const dailyTotal = days.map(d => (this.goals[d] || []).length);

        if (this._charts.daily) this._charts.daily.destroy();
        const dc = document.getElementById('dailyChart');
        if (dc) this._charts.daily = new Chart(dc, {
          type: 'bar',
          data: { labels: dailyLabels, datasets: [
            { label: 'Completed', data: dailyCompleted, backgroundColor: 'rgba(167,139,250,0.85)', borderRadius: 6 },
            { label: 'Planned', data: dailyTotal, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 6 },
          ]},
          options: { ...DEF, scales: { ...DEF.scales, y: { ...DEF.scales.y, beginAtZero: true, ticks: { ...DEF.scales.y.ticks, stepSize: 1 } } } },
        });

        const weeks = this.getLast4Weeks();
        const weekLabels = weeks.map((wd, i) => 'W' + (i + 1) + ' · ' + new Date(wd[0] + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
        const weekPcts = weeks.map(wd => this.dayProgressPct(wd.flatMap(d => this.goals[d] || [])));

        if (this._charts.weekly) this._charts.weekly.destroy();
        const wc = document.getElementById('weeklyChart');
        if (wc) this._charts.weekly = new Chart(wc, {
          type: 'bar',
          data: { labels: weekLabels, datasets: [{ data: weekPcts, backgroundColor: weekPcts.map(p => p >= 80 ? 'rgba(52,211,153,0.85)' : p >= 50 ? 'rgba(251,191,36,0.85)' : 'rgba(244,114,182,0.85)'), borderRadius: 6 }] },
          options: { ...DEF, scales: { ...DEF.scales, y: { ...DEF.scales.y, min: 0, max: 100, ticks: { ...DEF.scales.y.ticks, callback: v => v + '%' } } } },
        });

        const hoursData = days.map(d => (this.goals[d] || []).filter(g=>g.completed).reduce((s, g) => s + (parseFloat(g.loggedHours ?? g.hours) || 0), 0));
        if (this._charts.hours) this._charts.hours.destroy();
        const hc = document.getElementById('hoursChart');
        if (hc) this._charts.hours = new Chart(hc, {
          type: 'line',
          data: { labels: dailyLabels, datasets: [{ data: hoursData, borderColor: '#f472b6', backgroundColor: 'rgba(244,114,182,0.12)', fill: true, tension: 0.4, pointBackgroundColor: '#f472b6', pointRadius: 4 }] },
          options: { ...DEF, scales: { ...DEF.scales, y: { ...DEF.scales.y, beginAtZero: true, ticks: { ...DEF.scales.y.ticks, callback: v => v + 'h' } } } },
        });
      },
    };
  }
