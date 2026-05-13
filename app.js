const STORAGE_KEY = "personal-todo-days-v1";

const statusLabels = {
  todo: "Не начато",
  progress: "В процессе",
  partial: "Частично",
  done: "Готово"
};

const today = toInputDate(new Date());
const seedDays = {
  [today]: {
    date: today,
    tasks: []
  }
};

let days = normalizeDays(loadDays());
let currentDate = getLatestDate(days);
let filter = "all";

const dayList = document.querySelector("#day-list");
const dayCount = document.querySelector("#day-count");
const dateSearch = document.querySelector("#date-search");
const openDateButton = document.querySelector("#open-date-button");
const newDayButton = document.querySelector("#new-day-button");
const currentTitle = document.querySelector("#current-title");
const summary = document.querySelector("#summary");
const taskForm = document.querySelector("#task-form");
const taskTitle = document.querySelector("#task-title");
const taskImportant = document.querySelector("#task-important");
const taskDate = document.querySelector("#task-date");
const tasksNode = document.querySelector("#tasks");
const filters = document.querySelector("#filters");

dateSearch.value = currentDate;
taskDate.value = currentDate;
carryProgressFromPreviousDay(currentDate);
saveDays();
render();

openDateButton.addEventListener("click", () => openDate(dateSearch.value));
newDayButton.addEventListener("click", () => openDate(toInputDate(new Date())));
dateSearch.addEventListener("keydown", (event) => {
  if (event.key === "Enter") openDate(dateSearch.value);
});

taskForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const title = taskTitle.value.trim();
  const date = taskDate.value || currentDate;
  if (!title) return;

  ensureDay(date);
  days[date].tasks.push(task(title, taskImportant.checked, false, "", date));
  taskTitle.value = "";
  taskImportant.checked = false;
  currentDate = date;
  dateSearch.value = date;
  taskDate.value = date;
  saveAndRender();
});

filters.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-filter]");
  if (!button) return;
  filter = button.dataset.filter;
  render();
});

tasksNode.addEventListener("change", (event) => {
  const card = event.target.closest("[data-task-id]");
  if (!card) return;
  const item = findTask(card.dataset.taskId);
  if (!item) return;

  if (event.target.matches("[data-action='done']")) {
    item.done = event.target.checked;
    item.status = item.done ? "done" : item.status === "done" ? "todo" : item.status;
  }

  if (event.target.matches("[data-action='status']")) {
    item.status = event.target.value;
    item.done = item.status === "done";
  }

  if (event.target.matches("[data-action='date']")) {
    moveTaskToDate(item.id, event.target.value);
    saveAndRender();
    return;
  }

  if (item.status === "progress" && !item.done) {
    carryProgressTask(item, currentDate, nextDate(currentDate));
  } else {
    removeCarriedTask(item.id, nextDate(currentDate));
  }

  saveAndRender();
});

tasksNode.addEventListener("input", (event) => {
  const card = event.target.closest("[data-task-id]");
  if (!card || !event.target.matches("[data-action='comment']")) return;
  const item = findTask(card.dataset.taskId);
  if (!item) return;
  item.comment = event.target.value;
  saveDays();
});

tasksNode.addEventListener("click", (event) => {
  const button = event.target.closest("[data-action='delete']");
  if (!button) return;
  const id = button.closest("[data-task-id]").dataset.taskId;
  days[currentDate].tasks = days[currentDate].tasks.filter((item) => item.id !== id);
  saveAndRender();
});

function task(title, important = false, done = false, comment = "", date = today, extras = {}) {
  return {
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()),
    title,
    important,
    done,
    status: done ? "done" : "todo",
    comment,
    date,
    carriedFrom: extras.carriedFrom || null
  };
}

function loadDays() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return structuredClone(seedDays);

  try {
    const parsed = JSON.parse(stored);
    return Object.keys(parsed).length ? parsed : structuredClone(seedDays);
  } catch {
    return structuredClone(seedDays);
  }
}

function normalizeDays(source) {
  Object.entries(source).forEach(([date, day]) => {
    day.date = day.date || date;
    day.tasks = Array.isArray(day.tasks) ? day.tasks : [];
    day.tasks.forEach((item) => {
      item.id = item.id || (crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()));
      item.date = item.date || date;
      item.status = item.status || (item.done ? "done" : "todo");
      item.done = item.status === "done" ? true : Boolean(item.done);
      item.comment = item.comment || "";
      item.important = Boolean(item.important);
      item.carriedFrom = item.carriedFrom || null;
    });
  });
  return source;
}

function saveDays() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(days));
}

function saveAndRender() {
  saveDays();
  render();
}

function openDate(date) {
  if (!date) return;
  ensureDay(date);
  carryProgressFromPreviousDay(date);
  currentDate = date;
  dateSearch.value = date;
  taskDate.value = date;
  saveAndRender();
}

function ensureDay(date) {
  if (!days[date]) days[date] = { date, tasks: [] };
}

function carryProgressFromPreviousDay(date) {
  const sourceDate = previousDate(date);
  if (!days[sourceDate]) return;

  days[sourceDate].tasks
    .filter((item) => item.status === "progress" && !item.done)
    .forEach((item) => carryProgressTask(item, sourceDate, date));
}

function carryProgressTask(item, sourceDate, targetDate) {
  ensureDay(targetDate);
  const alreadyCarried = days[targetDate].tasks.some((targetTask) => targetTask.carriedFrom === item.id);
  if (alreadyCarried) return;

  days[targetDate].tasks.push(task(
    item.title,
    item.important,
    false,
    item.comment,
    targetDate,
    { carriedFrom: item.id }
  ));
  days[targetDate].tasks.at(-1).status = "progress";
}

function removeCarriedTask(sourceId, targetDate) {
  if (!days[targetDate]) return;
  days[targetDate].tasks = days[targetDate].tasks.filter((item) => item.carriedFrom !== sourceId);
}

function moveTaskToDate(id, targetDate) {
  if (!targetDate || targetDate === currentDate) return;
  const item = findTask(id);
  if (!item) return;

  ensureDay(targetDate);
  days[currentDate].tasks = days[currentDate].tasks.filter((taskItem) => taskItem.id !== id);
  item.date = targetDate;
  days[targetDate].tasks.push(item);
}

function render() {
  renderDays();
  renderCurrentDay();
  renderTasks();
  renderFilters();
}

function renderDays() {
  const dates = Object.keys(days).sort((a, b) => b.localeCompare(a));
  dayCount.textContent = dates.length;
  dayList.innerHTML = dates.map((date) => {
    const items = days[date].tasks;
    const done = items.filter((item) => item.done).length;
    const active = date === currentDate ? " active" : "";
    return `
      <button class="day-button${active}" type="button" data-date="${date}">
        <span>${formatDate(date)}</span>
        <small>${done}/${items.length}</small>
      </button>
    `;
  }).join("");

  dayList.querySelectorAll("[data-date]").forEach((button) => {
    button.addEventListener("click", () => openDate(button.dataset.date));
  });
}

function renderCurrentDay() {
  const items = days[currentDate].tasks;
  const done = items.filter((item) => item.done).length;
  const important = items.filter((item) => item.important && !item.done).length;
  const progress = items.filter((item) => item.status === "progress" && !item.done).length;
  currentTitle.textContent = formatDate(currentDate);
  summary.innerHTML = `
    <span>Всего: ${items.length}</span>
    <span>Готово: ${done}</span>
    <span>В процессе: ${progress}</span>
    <span>Важных открыто: ${important}</span>
  `;
}

function renderFilters() {
  filters.querySelectorAll("button").forEach((button) => {
    button.classList.toggle("active", button.dataset.filter === filter);
  });
}

function renderTasks() {
  const items = days[currentDate].tasks.filter(matchesFilter);

  if (!items.length) {
    tasksNode.innerHTML = `<div class="empty">На эту дату задач по выбранному фильтру нет.</div>`;
    return;
  }

  tasksNode.innerHTML = items.map((item) => `
    <article class="task-card${item.done ? " done" : ""}" data-task-id="${item.id}">
      <input class="task-check" data-action="done" type="checkbox" ${item.done ? "checked" : ""} aria-label="Отметить выполнение" />
      <div class="task-main">
        <div class="task-title-row">
          <p class="task-title">${escapeHtml(item.title)}</p>
          ${item.important ? `<span class="badge">Важное</span>` : ""}
          ${item.carriedFrom ? `<span class="carry-badge">Перенесено</span>` : ""}
        </div>
        <textarea data-action="comment" placeholder="Комментарий, промежуточный результат или что осталось доделать">${escapeHtml(item.comment || "")}</textarea>
      </div>
      <div class="task-side">
        <label class="mini-label">
          <span>Дата</span>
          <input data-action="date" type="date" value="${escapeHtml(item.date || currentDate)}" />
        </label>
        <select data-action="status" aria-label="Статус задачи">
          ${Object.entries(statusLabels).map(([value, label]) => `
            <option value="${value}" ${item.status === value ? "selected" : ""}>${label}</option>
          `).join("")}
        </select>
        <button class="delete-button" data-action="delete" type="button">Удалить</button>
      </div>
    </article>
  `).join("");
}

function matchesFilter(item) {
  if (filter === "open") return !item.done;
  if (filter === "important") return item.important;
  if (filter === "done") return item.done;
  return true;
}

function findTask(id) {
  return days[currentDate].tasks.find((item) => item.id === id);
}

function getLatestDate(source) {
  return Object.keys(source).sort((a, b) => b.localeCompare(a))[0] || toInputDate(new Date());
}

function previousDate(date) {
  const value = new Date(`${date}T00:00:00`);
  value.setDate(value.getDate() - 1);
  return toInputDate(value);
}

function nextDate(date) {
  const value = new Date(`${date}T00:00:00`);
  value.setDate(value.getDate() + 1);
  return toInputDate(value);
}

function toInputDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDate(date) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(new Date(`${date}T00:00:00`));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
