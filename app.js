(() => {
  "use strict";

  const TOTAL_WEIGHT = 7.8;
  const STATE_NAMES = ["凶", "平", "吉"];
  const STATE_KEYS = ["bad", "neutral", "good"];
  const REVEAL_START_MS = 300;
  const REVEAL_STEP_MS = 120;
  const VERDICT_DELAY_MS = 500;
  const TOAST_DURATION_MS = 2400;
  const WARNING_FLASH_DURATION_MS = 1200;

  const CONFIG = {
    scenes: {
      relic: {
        id: "relic",
        label: "开核桃",
        icon: "📦",
        goodWhisper: "（虚空低语：金部件已在向你招手。）",
        badWhisper: "（虚空低语：光辉车必出福马，切勿浪费遗物。）",
      },
      riven: {
        id: "riven",
        label: "洗紫卡",
        icon: "🔮",
        goodWhisper: "（赤毒赐福：极易洗出极品词条，大胆重随。）",
        badWhisper: "（赤毒警示：天道无常，今日切勿死磕。）",
      },
      lich: {
        id: "lich",
        label: "捅玄骸",
        icon: "💀",
        goodWhisper: "（天命指引：第一刀必中，大胆盲刀。）",
        badWhisper: "（解密提示：煞气极重，密码极易试错，谨慎出刀。）",
      },
    },
    achievements: [
      {
        id: "void-chosen",
        name: "虚空天选",
        matches: (byId) => byId.D20.roll === 20 && byId.D100.roll === 1,
      },
      {
        id: "unlucky-legend",
        name: "绝世非酋",
        matches: (byId) => byId.D20.roll === 1 && byId.D100.roll === 100,
      },
      {
        id: "balance",
        name: "吉凶相抵",
        matches: (byId) => {
          const left = [byId.D20.state, byId.D12.state, byId.D8.state];
          const right = [byId.D100.state, byId.D6.state, byId.D4.state];
          const forward = left.every((state) => state === 2) &&
            right.every((state) => state === 0);
          const reverse = left.every((state) => state === 0) &&
            right.every((state) => state === 2);
          return forward || reverse;
        },
      },
    ],
    storage: {
      historyKey: "cyberDice.history.v1",
      rollTimesKey: "cyberDice.rollTimes.v1",
      historyLimit: 5,
      addictionWindowMs: 300000,
      addictionThreshold: 3,
    },
    // 显示顺序与原始控制台一致：核心、过程、细节。
    dice: [
      {
        id: "D20",
        sides: 20,
        weight: 2,
        threshold: 5,
        role: "大主骰",
        group: "核心基盘",
        reverse: false,
        flavors: ["命途多舛", "吉凶参半", "天命所归"],
      },
      {
        id: "D100",
        sides: 100,
        weight: 1.3,
        threshold: 3.5,
        role: "大反骰",
        group: "核心基盘",
        reverse: true,
        flavors: ["深渊凝视", "暗流涌动", "风平浪静"],
      },
      {
        id: "D12",
        sides: 12,
        weight: 1.5,
        threshold: 4,
        role: "中流骰",
        group: "过程波动",
        reverse: false,
        flavors: ["先扬后抑", "平稳如常", "渐入佳境"],
      },
      {
        id: "D8",
        sides: 8,
        weight: 1.2,
        threshold: 3,
        role: "变数骰",
        group: "过程波动",
        reverse: false,
        flavors: ["后继乏力", "死水微澜", "异军突起"],
      },
      {
        id: "D6",
        sides: 6,
        weight: 1,
        threshold: 2.5,
        role: "资源骰",
        group: "操作细节",
        reverse: false,
        flavors: ["散财之相", "得失参半", "日进斗金"],
      },
      {
        id: "D4",
        sides: 4,
        weight: 0.8,
        threshold: 2,
        role: "灵感骰",
        group: "操作细节",
        reverse: false,
        flavors: ["付诸东流", "心如止水", "灵光乍现"],
      },
    ],
  };

  const DICE = CONFIG.dice;

  const elements = {
    sceneTabs: [...document.querySelectorAll(".scene-tab")],
    tabs: [...document.querySelectorAll(".mode-tab")],
    autoPanel: document.querySelector("#auto-panel"),
    manualPanel: document.querySelector("#manual-panel"),
    rollAuto: document.querySelector("#roll-auto"),
    rollAutoLabel: document.querySelector("#roll-auto-label"),
    manualForm: document.querySelector("#manual-form"),
    manualFields: document.querySelector("#manual-fields"),
    formError: document.querySelector("#form-error"),
    resetManual: document.querySelector("#reset-manual"),
    oracleIdle: document.querySelector("#oracle-idle"),
    results: document.querySelector("#results"),
    diceGrid: document.querySelector("#dice-grid"),
    achievementBanner: document.querySelector("#achievement-banner"),
    achievementText: document.querySelector("#achievement-text"),
    overallCard: document.querySelector("#overall-card"),
    overallScore: document.querySelector("#overall-score"),
    overallVerdict: document.querySelector("#overall-verdict"),
    sceneWhisper: document.querySelector("#scene-whisper"),
    copyReport: document.querySelector("#copy-report"),
    extremeWarning: document.querySelector("#extreme-warning"),
    addictionWarning: document.querySelector("#addiction-warning"),
    warningFlash: document.querySelector("#warning-flash"),
    toast: document.querySelector("#toast"),
    formaSacrifice: document.querySelector("#forma-sacrifice"),
    formaFloats: document.querySelector("#forma-floats"),
    historyPanel: document.querySelector("#history-panel"),
    historyList: document.querySelector("#history-list"),
    historyEmpty: document.querySelector("#history-empty"),
    historyCount: document.querySelector("#history-count"),
    historyStorageNote: document.querySelector("#history-storage-note"),
    clearHistory: document.querySelector("#clear-history"),
    clearHistoryDialog: document.querySelector("#clear-history-dialog"),
    cancelClearHistory: document.querySelector("#cancel-clear-history"),
    confirmClearHistory: document.querySelector("#confirm-clear-history"),
    readoutState: document.querySelector("#readout-state"),
    announcer: document.querySelector("#announcer"),
    dieTemplate: document.querySelector("#die-card-template"),
  };

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const manualInputs = new Map();
  let activeMode = "auto";
  let activeScene = "relic";
  let isRolling = false;
  let revealTimeouts = [];
  let revealIntervals = [];
  let toastTimeout = null;
  let warningFlashTimeout = null;
  let activeResult = null;
  let formaTapCount = 0;
  let formaToastShown = false;

  function createStorageAdapter() {
    const memory = new Map();
    let persistent = false;

    try {
      const probeKey = "__cyber_dice_storage_probe__";
      window.localStorage.setItem(probeKey, "1");
      window.localStorage.removeItem(probeKey);
      persistent = true;
    } catch {
      // 隐私模式或浏览器回退页面可能禁用本地存储。
    }

    return {
      persistent,
      read(key, fallback) {
        try {
          const raw = persistent ? window.localStorage.getItem(key) : memory.get(key);
          return raw ? JSON.parse(raw) : fallback;
        } catch {
          return fallback;
        }
      },
      write(key, value) {
        const raw = JSON.stringify(value);
        if (persistent) {
          try {
            window.localStorage.setItem(key, raw);
            return true;
          } catch {
            return false;
          }
        }

        memory.set(key, raw);
        return true;
      },
      remove(key) {
        if (persistent) {
          try {
            window.localStorage.removeItem(key);
          } catch {
            // 清理失败时保留现有界面状态，不中断使用。
          }
        } else {
          memory.delete(key);
        }
      },
    };
  }

  const storage = createStorageAdapter();

  function calculateDie(die, roll) {
    const baseNormalized = (2 * (roll - 1)) / (die.sides - 1) - 1;
    const normalized = die.reverse ? -baseNormalized : baseNormalized;
    const contribution = (100 * normalized * die.weight) / TOTAL_WEIGHT;
    let state = 1;

    if (contribution > die.threshold) {
      state = 2;
    } else if (contribution < -die.threshold) {
      state = 0;
    }

    return {
      die,
      roll,
      normalized,
      contribution,
      state,
      flavor: die.flavors[state],
    };
  }

  function calculateAll(rolls, sceneId = activeScene, mode = activeMode) {
    const results = DICE.map((die, index) => calculateDie(die, rolls[index]));
    const overall = results.reduce((sum, result) => sum + result.contribution, 0);
    const d100Result = results.find((result) => result.die.id === "D100");
    const byId = Object.fromEntries(results.map((result) => [result.die.id, result]));
    const scene = CONFIG.scenes[sceneId] || CONFIG.scenes.relic;
    const achievement =
      CONFIG.achievements.find((candidate) => candidate.matches(byId)) || null;
    let whisper = "";

    if (overall > 40) {
      whisper = scene.goodWhisper;
    } else if (overall < -40) {
      whisper = scene.badWhisper;
    }

    return {
      results,
      byId,
      overall,
      verdict: getVerdict(overall),
      extremeWarning: overall < -40 || d100Result.roll >= 95,
      scene,
      mode,
      achievement,
      whisper,
    };
  }

  function getVerdict(overall) {
    if (overall > 40) {
      return { tone: "good", text: "六合呈祥，速战速决。" };
    }
    if (overall > 20) {
      return { tone: "good", text: "吉星高照，见好即收。" };
    }
    if (overall >= -20) {
      return { tone: "neutral", text: "阴阳交泰，按兵不动。" };
    }
    if (overall >= -40) {
      return { tone: "bad", text: "煞气渐起，明哲保身。" };
    }
    return { tone: "bad", text: "天劫降世，退避三舍。" };
  }

  function formatSigned(value) {
    const safeValue = Math.abs(value) < 0.0000001 ? 0 : value;
    return `${safeValue >= 0 ? "+" : ""}${safeValue.toFixed(2)}`;
  }

  function formatBattleReport(result) {
    const lines = [];
    if (result.achievement) {
      lines.push(`🏆【成就解锁：${result.achievement.name}】`);
    }

    const diceLines = result.results.map(({ die, roll, state, flavor }) => {
      const reverseMark = die.reverse ? " (反)" : "";
      return `【${die.role}】${die.id.padEnd(4)}: ${String(roll).padStart(2)} | 【${STATE_NAMES[state]}】${flavor}${reverseMark}`;
    });

    lines.push(
      "📜【虚空天机签】",
      `【场景】${result.scene.icon} ${result.scene.label}`,
      ...diceLines,
      "------------------------",
      `【综合天机】 ${formatSigned(result.overall)}`,
      `【天师批语】 ${result.verdict.text}`,
    );

    if (result.whisper) {
      lines.push(result.whisper);
    }

    return lines.join("\n");
  }

  function getHistoryEntries() {
    const value = storage.read(CONFIG.storage.historyKey, []);
    if (!Array.isArray(value)) {
      return [];
    }

    const validModes = new Set(["auto", "manual"]);
    const validScenes = new Set(Object.keys(CONFIG.scenes));

    return value
      .filter((entry) =>
        entry &&
        Number.isFinite(entry.timestamp) &&
        validModes.has(entry.mode) &&
        validScenes.has(entry.scene) &&
        Number.isFinite(entry.overall) &&
        typeof entry.verdict === "string",
      )
      .slice(0, CONFIG.storage.historyLimit);
  }

  function getRollTimes(now = Date.now()) {
    const value = storage.read(CONFIG.storage.rollTimesKey, []);
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .filter((timestamp) =>
        Number.isFinite(timestamp) &&
        timestamp <= now &&
        now - timestamp <= CONFIG.storage.addictionWindowMs,
      )
      .sort((left, right) => left - right);
  }

  function formatArchiveTime(timestamp) {
    const date = new Date(timestamp);
    const pad = (value) => String(value).padStart(2, "0");
    return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  function renderHistory() {
    const entries = getHistoryEntries();
    elements.historyCount.textContent =
      `${entries.length} / ${CONFIG.storage.historyLimit}`;
    elements.historyEmpty.hidden = entries.length > 0;
    elements.historyList.hidden = entries.length === 0;
    elements.clearHistory.disabled = entries.length === 0;
    elements.historyList.replaceChildren();

    entries.forEach((entry) => {
      const scene = CONFIG.scenes[entry.scene];
      const item = document.createElement("li");
      item.className = "history-entry";

      const time = document.createElement("time");
      time.className = "history-entry__time";
      time.dateTime = new Date(entry.timestamp).toISOString();
      time.textContent = formatArchiveTime(entry.timestamp);

      const mode = document.createElement("span");
      mode.className = "history-entry__mode";
      mode.textContent = entry.mode === "manual" ? "[手]" : "[自]";

      const sceneLabel = document.createElement("span");
      sceneLabel.className = "history-entry__scene";
      sceneLabel.textContent = `${scene.icon} ${scene.label}`;

      const score = document.createElement("strong");
      score.className = "history-entry__score";
      score.textContent = formatSigned(entry.overall);

      const verdict = document.createElement("span");
      verdict.className = "history-entry__verdict";
      verdict.textContent = entry.verdict;

      item.append(time, mode, sceneLabel, score, verdict);
      elements.historyList.append(item);
    });
  }

  function recordResult(result) {
    const now = Date.now();
    const entry = {
      timestamp: now,
      mode: result.mode,
      scene: result.scene.id,
      overall: result.overall,
      verdict: result.verdict.text,
    };
    const history = [entry, ...getHistoryEntries()]
      .slice(0, CONFIG.storage.historyLimit);
    storage.write(CONFIG.storage.historyKey, history);

    const rollTimes = getRollTimes(now);
    rollTimes.push(now);
    storage.write(CONFIG.storage.rollTimesKey, rollTimes);
    renderHistory();

    return rollTimes.length >= CONFIG.storage.addictionThreshold;
  }

  function resetFormaInteraction() {
    formaTapCount = 0;
    formaToastShown = false;
    elements.formaSacrifice.hidden = true;
    elements.formaSacrifice.classList.remove("is-pulsing");
    elements.formaFloats.replaceChildren();
  }

  function showFormaSacrifice(result) {
    elements.formaSacrifice.hidden = result.overall >= -40;
  }

  function handleFormaTap() {
    if (!activeResult || activeResult.overall >= -40) {
      return;
    }

    formaTapCount += 1;
    elements.formaSacrifice.classList.remove("is-pulsing");
    void elements.formaSacrifice.offsetWidth;
    elements.formaSacrifice.classList.add("is-pulsing");

    const floatingText = document.createElement("span");
    floatingText.className = "forma-float";
    floatingText.textContent = "福马 -1";
    const buttonRect = elements.formaSacrifice.getBoundingClientRect();
    floatingText.style.left = `${buttonRect.left + buttonRect.width / 2}px`;
    floatingText.style.top = `${buttonRect.top + 18}px`;
    elements.formaFloats.append(floatingText);
    window.setTimeout(() => floatingText.remove(), 900);

    if (formaTapCount >= 10 && !formaToastShown) {
      formaToastShown = true;
      showToast("心诚则灵，虚空已原谅你的非气。");
    }
  }

  function clearHistoryEntries() {
    storage.remove(CONFIG.storage.historyKey);
    renderHistory();
    elements.clearHistoryDialog.close();
    showToast("天命档案已清空。");
  }

  async function writeClipboard(text) {
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        return;
      } catch {
        // 权限或非安全上下文失败时继续使用兼容回退。
      }
    }

    const textarea = document.createElement("textarea");
    const previousFocus = document.activeElement;
    textarea.value = text;
    textarea.className = "clipboard-fallback";
    textarea.setAttribute("readonly", "");
    document.body.append(textarea);
    textarea.select();
    textarea.setSelectionRange(0, text.length);

    const copied = document.execCommand?.("copy") === true;
    textarea.remove();
    if (previousFocus instanceof HTMLElement) {
      previousFocus.focus();
    }

    if (!copied) {
      throw new Error("Clipboard is unavailable.");
    }
  }

  function showToast(message, tone = "success") {
    if (toastTimeout) {
      window.clearTimeout(toastTimeout);
    }

    elements.toast.textContent = message;
    elements.toast.dataset.tone = tone;
    elements.toast.hidden = false;
    elements.toast.classList.remove("is-visible");
    void elements.toast.offsetWidth;
    elements.toast.classList.add("is-visible");

    toastTimeout = window.setTimeout(() => {
      elements.toast.classList.remove("is-visible");
      elements.toast.hidden = true;
      toastTimeout = null;
    }, TOAST_DURATION_MS);
  }

  async function copyBattleReport() {
    if (!activeResult) {
      return;
    }

    try {
      await writeClipboard(formatBattleReport(activeResult));
      showToast("战报已复制，快去群里对线。");
    } catch {
      showToast("战报复制失败，请稍后重试。", "error");
    }
  }

  function triggerWarningFlash() {
    if (reducedMotion.matches) {
      return;
    }

    if (warningFlashTimeout) {
      window.clearTimeout(warningFlashTimeout);
    }

    elements.warningFlash.hidden = false;
    elements.warningFlash.classList.remove("is-flashing");
    void elements.warningFlash.offsetWidth;
    elements.warningFlash.classList.add("is-flashing");

    warningFlashTimeout = window.setTimeout(() => {
      elements.warningFlash.classList.remove("is-flashing");
      elements.warningFlash.hidden = true;
      warningFlashTimeout = null;
    }, WARNING_FLASH_DURATION_MS);
  }

  function clearTransientFeedback() {
    if (toastTimeout) {
      window.clearTimeout(toastTimeout);
      toastTimeout = null;
    }
    if (warningFlashTimeout) {
      window.clearTimeout(warningFlashTimeout);
      warningFlashTimeout = null;
    }

    elements.toast.classList.remove("is-visible");
    elements.toast.hidden = true;
    elements.warningFlash.classList.remove("is-flashing");
    elements.warningFlash.hidden = true;
    elements.extremeWarning.hidden = true;
    elements.addictionWarning.hidden = true;
    elements.sceneWhisper.hidden = true;
  }

  function randomInteger(max) {
    const cryptoApi = window.crypto || window.msCrypto;

    if (cryptoApi?.getRandomValues) {
      const values = new Uint32Array(1);
      const upperBound = Math.floor(0x100000000 / max) * max;
      let value;

      do {
        cryptoApi.getRandomValues(values);
        value = values[0];
      } while (value >= upperBound);

      return (value % max) + 1;
    }

    return Math.floor(Math.random() * max) + 1;
  }

  function createManualFields() {
    const fragment = document.createDocumentFragment();

    DICE.forEach((die) => {
      const field = document.createElement("div");
      field.className = "manual-field";

      const label = document.createElement("label");
      label.className = "manual-field__label";
      label.htmlFor = `input-${die.id}`;
      label.innerHTML = `<strong>${die.id}</strong><span>${die.role}</span>`;

      const shell = document.createElement("div");
      shell.className = "input-shell";

      const input = document.createElement("input");
      input.id = `input-${die.id}`;
      input.name = die.id;
      input.type = "number";
      input.inputMode = "numeric";
      input.min = "1";
      input.max = String(die.sides);
      input.step = "1";
      input.placeholder = `1–${die.sides}`;
      input.autocomplete = "off";
      input.setAttribute("aria-describedby", `error-${die.id}`);

      const maximum = document.createElement("span");
      maximum.className = "input-shell__max";
      maximum.textContent = `/ ${die.sides}`;

      const error = document.createElement("p");
      error.className = "field-error";
      error.id = `error-${die.id}`;

      const stepper = document.createElement("div");
      stepper.className = "manual-stepper";

      const decrease = document.createElement("button");
      decrease.className = "step-button";
      decrease.type = "button";
      decrease.textContent = "−";
      decrease.setAttribute("aria-label", `${die.id} ${die.role}点数减一`);
      decrease.setAttribute("aria-controls", input.id);

      const increase = document.createElement("button");
      increase.className = "step-button";
      increase.type = "button";
      increase.textContent = "+";
      increase.setAttribute("aria-label", `${die.id} ${die.role}点数加一`);
      increase.setAttribute("aria-controls", input.id);

      shell.append(input, maximum);
      stepper.append(decrease, shell, increase);
      field.append(label, stepper, error);
      fragment.append(field);
      const fieldState = { input, shell, error, die, decrease, increase };
      manualInputs.set(die.id, fieldState);

      input.addEventListener("input", () => {
        clearFieldError(die.id);
        updateStepperState(fieldState);
      });
      decrease.addEventListener("click", () => adjustManualValue(fieldState, -1));
      increase.addEventListener("click", () => adjustManualValue(fieldState, 1));
      updateStepperState(fieldState);
    });

    elements.manualFields.append(fragment);
  }

  function clearFieldError(dieId) {
    const field = manualInputs.get(dieId);
    field.input.removeAttribute("aria-invalid");
    field.shell.classList.remove("is-invalid");
    field.error.textContent = "";
    elements.formError.textContent = "";
  }

  function clearAllFieldErrors() {
    manualInputs.forEach((_, dieId) => clearFieldError(dieId));
    elements.formError.textContent = "";
  }

  function updateStepperState(field) {
    const rawValue = field.input.value.trim();
    const numericValue = Number(rawValue);
    const hasIntegerValue = rawValue !== "" && Number.isInteger(numericValue);

    field.decrease.disabled = hasIntegerValue && numericValue <= 1;
    field.increase.disabled = hasIntegerValue && numericValue >= field.die.sides;
  }

  function adjustManualValue(field, delta) {
    const rawValue = field.input.value.trim();
    const numericValue = Number(rawValue);
    const hadValidValue = rawValue !== "" && Number.isInteger(numericValue);
    const nextValue = hadValidValue
      ? Math.min(field.die.sides, Math.max(1, numericValue + delta))
      : 1;

    field.input.value = String(nextValue);
    clearFieldError(field.die.id);
    updateStepperState(field);
  }

  function setFieldError(field, message) {
    field.input.setAttribute("aria-invalid", "true");
    field.shell.classList.add("is-invalid");
    field.error.textContent = message;
  }

  function validateManualForm() {
    clearAllFieldErrors();
    const rolls = [];
    let firstInvalid = null;

    DICE.forEach((die) => {
      const field = manualInputs.get(die.id);
      const rawValue = field.input.value.trim();
      const numericValue = Number(rawValue);
      let message = "";

      if (rawValue === "") {
        message = "请输入点数";
      } else if (!Number.isInteger(numericValue)) {
        message = "点数必须是整数";
      } else if (numericValue < 1 || numericValue > die.sides) {
        message = `请输入 1–${die.sides}`;
      }

      if (message) {
        setFieldError(field, message);
        firstInvalid ??= field.input;
      } else {
        rolls.push(numericValue);
      }
    });

    if (firstInvalid) {
      elements.formError.textContent = "请修正标红的骰子点数后再解析。";
      firstInvalid.focus();
      return null;
    }

    return rolls;
  }

  function clearRevealTimers() {
    revealIntervals.forEach((timer) => window.clearInterval(timer));
    revealTimeouts.forEach((timer) => window.clearTimeout(timer));
    revealIntervals = [];
    revealTimeouts = [];
  }

  function createDieCard(die) {
    const card = elements.dieTemplate.content.firstElementChild.cloneNode(true);
    card.dataset.die = die.id;
    card.querySelector(".die-id").textContent = die.id;
    card.querySelector(".die-role").textContent = `[${die.role}]`;
    card.querySelector(".die-state").textContent = "—";
    card.querySelector(".die-flavor").textContent = die.group;
    card.setAttribute("aria-label", `${die.id} ${die.role}，等待结果`);

    const reverseMark = card.querySelector(".reverse-mark");
    reverseMark.hidden = !die.reverse;
    return card;
  }

  function prepareResults(cards) {
    clearTransientFeedback();
    elements.diceGrid.replaceChildren(...cards);
    elements.oracleIdle.hidden = true;
    elements.results.hidden = false;
    elements.results.setAttribute("aria-busy", "true");
    elements.readoutState.textContent = "SCANNING";
    elements.readoutState.classList.add("is-active");
    elements.overallScore.textContent = "···";
    elements.overallVerdict.textContent = "正在解析六骰偏差";
    elements.overallCard.dataset.verdict = "neutral";
    elements.overallCard.classList.remove("is-revealing");
    elements.overallCard.hidden = true;
    elements.copyReport.disabled = true;
    elements.extremeWarning.hidden = true;
    elements.addictionWarning.hidden = true;
    elements.sceneWhisper.hidden = true;
    elements.achievementBanner.hidden = true;
    elements.achievementBanner.classList.remove("is-revealing");
    elements.achievementText.textContent = "";
    resetFormaInteraction();
  }

  function renderDieResult(card, result) {
    const stateKey = STATE_KEYS[result.state];
    card.dataset.state = stateKey;
    card.classList.remove("is-rolling");
    card.classList.add("is-settled");
    card.querySelector(".die-state").textContent = STATE_NAMES[result.state];
    card.querySelector(".die-value").textContent = String(result.roll);
    card.querySelector(".die-deviation").textContent = formatSigned(result.contribution);
    card.querySelector(".die-flavor").textContent = result.flavor;
    card.setAttribute(
      "aria-label",
      `${result.die.id} ${result.die.role}，点数 ${result.roll}，偏差 ${formatSigned(result.contribution)}，状态 ${STATE_NAMES[result.state]}，${result.flavor}`,
    );
  }

  function renderOverall(result, animateReveal) {
    activeResult = result;
    const addictionTriggered = recordResult(result);
    elements.overallCard.dataset.verdict = result.verdict.tone;
    elements.overallScore.textContent = formatSigned(result.overall);
    elements.overallVerdict.textContent = result.verdict.text;
    elements.sceneWhisper.textContent = result.whisper;
    elements.sceneWhisper.hidden = !result.whisper;
    elements.achievementText.textContent = result.achievement
      ? `成就解锁：${result.achievement.name}`
      : "";
    elements.achievementBanner.hidden = !result.achievement;
    elements.achievementBanner.classList.remove("is-revealing");
    elements.copyReport.disabled = false;
    elements.extremeWarning.hidden = !result.extremeWarning;
    elements.addictionWarning.hidden = !addictionTriggered;
    elements.overallCard.hidden = false;
    elements.overallCard.classList.remove("is-revealing");
    showFormaSacrifice(result);

    if (animateReveal && !reducedMotion.matches) {
      void elements.overallCard.offsetWidth;
      elements.overallCard.classList.add("is-revealing");
      if (result.achievement) {
        void elements.achievementBanner.offsetWidth;
        elements.achievementBanner.classList.add("is-revealing");
      }
    }

    if (result.extremeWarning && !reducedMotion.matches) {
      triggerWarningFlash();
    }

    elements.readoutState.textContent = "COMPLETE";
    elements.results.setAttribute("aria-busy", "false");
    elements.announcer.textContent =
      `${result.achievement ? `${result.achievement.name}成就。` : ""}` +
      `综合天机 ${formatSigned(result.overall)}。${result.verdict.text}` +
      `${result.whisper ? ` ${result.whisper}` : ""}`;
  }

  function showResults(result, animate) {
    clearRevealTimers();
    const cards = DICE.map(createDieCard);
    prepareResults(cards);

    const finish = () => {
      cards.forEach((card, index) => renderDieResult(card, result.results[index]));
      renderOverall(result, animate && !reducedMotion.matches);

      if (activeMode === "auto") {
        elements.rollAutoLabel.textContent = "再次推演";
      }
    };

    if (!animate || reducedMotion.matches) {
      finish();
      return Promise.resolve();
    }

    cards.forEach((card, index) => {
      const valueElement = card.querySelector(".die-value");
      const stateElement = card.querySelector(".die-state");
      card.classList.add("is-rolling");
      stateElement.textContent = "···";

      const ticker = window.setInterval(() => {
        valueElement.textContent = String(randomInteger(DICE[index].sides));
      }, 58);
      valueElement.textContent = String(randomInteger(DICE[index].sides));

      const settleTimer = window.setTimeout(() => {
        window.clearInterval(ticker);
        renderDieResult(card, result.results[index]);
      }, REVEAL_START_MS + index * REVEAL_STEP_MS);

      revealIntervals.push(ticker);
      revealTimeouts.push(settleTimer);
    });

    return new Promise((resolve) => {
      const completeTimer = window.setTimeout(() => {
        renderOverall(result, true);
        if (activeMode === "auto") {
          elements.rollAutoLabel.textContent = "再次推演";
        }
        resolve();
      }, REVEAL_START_MS + (DICE.length - 1) * REVEAL_STEP_MS + VERDICT_DELAY_MS);
      revealTimeouts.push(completeTimer);
    });
  }

  async function startAutoRoll() {
    if (isRolling) {
      return;
    }

    isRolling = true;
    elements.rollAuto.disabled = true;
    elements.tabs.forEach((tab) => {
      tab.disabled = true;
    });
    elements.sceneTabs.forEach((tab) => {
      tab.disabled = true;
    });
    elements.announcer.textContent = "六骰正在推演。";

    const rolls = DICE.map((die) => randomInteger(die.sides));
    const result = calculateAll(rolls, activeScene, "auto");

    try {
      await showResults(result, true);
    } finally {
      isRolling = false;
      elements.rollAuto.disabled = false;
      elements.tabs.forEach((tab) => {
        tab.disabled = false;
      });
      elements.sceneTabs.forEach((tab) => {
        tab.disabled = false;
      });
    }
  }

  function submitManual(event) {
    event.preventDefault();
    const rolls = validateManualForm();

    if (!rolls) {
      return;
    }

    const result = calculateAll(rolls, activeScene, "manual");
    showResults(result, false);
  }

  function resetResults() {
    clearRevealTimers();
    clearTransientFeedback();
    activeResult = null;
    elements.diceGrid.replaceChildren();
    elements.results.hidden = true;
    elements.results.removeAttribute("aria-busy");
    elements.oracleIdle.hidden = false;
    elements.readoutState.textContent = "STANDBY";
    elements.readoutState.classList.remove("is-active");
    elements.overallCard.removeAttribute("data-verdict");
    elements.overallCard.classList.remove("is-revealing");
    elements.overallCard.hidden = true;
    elements.achievementBanner.hidden = true;
    elements.achievementBanner.classList.remove("is-revealing");
    elements.achievementText.textContent = "";
    elements.sceneWhisper.hidden = true;
    elements.addictionWarning.hidden = true;
    elements.copyReport.disabled = true;
    resetFormaInteraction();
    elements.announcer.textContent = "";
  }

  function resetManualForm() {
    manualInputs.forEach((field) => {
      field.input.value = "";
      updateStepperState(field);
    });
    clearAllFieldErrors();
    resetResults();
    elements.rollAutoLabel.textContent = "启动自动推演";
    manualInputs.get("D20")?.input.focus();
  }

  function activateMode(mode) {
    if (isRolling || mode === activeMode) {
      return;
    }

    activeMode = mode;
    elements.tabs.forEach((tab) => {
      const isActive = tab.dataset.mode === mode;
      tab.classList.toggle("is-active", isActive);
      tab.setAttribute("aria-selected", String(isActive));
      tab.tabIndex = isActive ? 0 : -1;
    });

    const isAuto = mode === "auto";
    elements.autoPanel.hidden = !isAuto;
    elements.manualPanel.hidden = isAuto;
    resetResults();

    if (isAuto) {
      elements.rollAuto.focus();
    } else {
      manualInputs.get("D20")?.input.focus();
    }
  }

  function activateScene(sceneId) {
    if (isRolling || sceneId === activeScene || !CONFIG.scenes[sceneId]) {
      return;
    }

    activeScene = sceneId;
    elements.sceneTabs.forEach((tab) => {
      const isActive = tab.dataset.scene === sceneId;
      tab.classList.toggle("is-active", isActive);
      tab.setAttribute("aria-checked", String(isActive));
      tab.tabIndex = isActive ? 0 : -1;
    });
    resetResults();
    elements.announcer.textContent =
      `已切换至${CONFIG.scenes[sceneId].label}场景。`;
  }

  function handleSceneKeydown(event) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
      return;
    }

    event.preventDefault();
    const currentIndex = elements.sceneTabs.indexOf(event.currentTarget);
    let nextIndex;

    if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = elements.sceneTabs.length - 1;
    } else {
      const direction = event.key === "ArrowRight" ? 1 : -1;
      nextIndex =
        (currentIndex + direction + elements.sceneTabs.length) %
        elements.sceneTabs.length;
    }

    const nextScene = elements.sceneTabs[nextIndex];
    activateScene(nextScene.dataset.scene);
    nextScene.focus();
  }

  function handleTabKeydown(event) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
      return;
    }

    event.preventDefault();
    const currentIndex = elements.tabs.indexOf(event.currentTarget);
    let nextIndex;

    if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = elements.tabs.length - 1;
    } else {
      const direction = event.key === "ArrowRight" ? 1 : -1;
      nextIndex = (currentIndex + direction + elements.tabs.length) % elements.tabs.length;
    }

    const nextTab = elements.tabs[nextIndex];
    activateMode(nextTab.dataset.mode);
    nextTab.focus();
  }

  function configureOnlineOnlyLinks() {
    const isOnlinePage =
      (location.protocol === "http:" || location.protocol === "https:") &&
      location.hostname !== "cyber-dice.local";

    document.querySelectorAll("[data-online-only]").forEach((element) => {
      element.hidden = !isOnlinePage;
    });
  }

  elements.tabs.forEach((tab) => {
    tab.addEventListener("click", () => activateMode(tab.dataset.mode));
    tab.addEventListener("keydown", handleTabKeydown);
  });
  elements.sceneTabs.forEach((tab) => {
    tab.addEventListener("click", () => activateScene(tab.dataset.scene));
    tab.addEventListener("keydown", handleSceneKeydown);
  });
  elements.rollAuto.addEventListener("click", startAutoRoll);
  elements.copyReport.addEventListener("click", copyBattleReport);
  elements.formaSacrifice.addEventListener("click", handleFormaTap);
  elements.manualForm.addEventListener("submit", submitManual);
  elements.resetManual.addEventListener("click", resetManualForm);
  elements.historyPanel.addEventListener("toggle", () => {
    if (elements.historyPanel.open) {
      renderHistory();
    }
  });
  elements.clearHistory.addEventListener("click", () => {
    if (getHistoryEntries().length > 0) {
      elements.clearHistoryDialog.showModal();
    }
  });
  elements.cancelClearHistory.addEventListener("click", () => {
    elements.clearHistoryDialog.close();
  });
  elements.confirmClearHistory.addEventListener("click", clearHistoryEntries);
  elements.clearHistoryDialog.addEventListener("click", (event) => {
    if (event.target === elements.clearHistoryDialog) {
      elements.clearHistoryDialog.close();
    }
  });

  configureOnlineOnlyLinks();
  elements.historyStorageNote.hidden = storage.persistent;
  renderHistory();
  createManualFields();
})();
