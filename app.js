(() => {
  "use strict";

  const TOTAL_WEIGHT = 7.8;
  const STATE_NAMES = ["凶", "平", "吉"];
  const STATE_KEYS = ["bad", "neutral", "good"];
  const REVEAL_START_MS = 300;
  const REVEAL_STEP_MS = 120;

  // 显示顺序与原始控制台一致：核心、过程、细节。
  const DICE = [
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
  ];

  const elements = {
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
    overallCard: document.querySelector("#overall-card"),
    overallScore: document.querySelector("#overall-score"),
    overallVerdict: document.querySelector("#overall-verdict"),
    readoutState: document.querySelector("#readout-state"),
    announcer: document.querySelector("#announcer"),
    dieTemplate: document.querySelector("#die-card-template"),
  };

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const manualInputs = new Map();
  let activeMode = "auto";
  let isRolling = false;
  let revealTimeouts = [];
  let revealIntervals = [];

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

  function calculateAll(rolls) {
    const results = DICE.map((die, index) => calculateDie(die, rolls[index]));
    const overall = results.reduce((sum, result) => sum + result.contribution, 0);

    return {
      results,
      overall,
      verdict: getVerdict(overall),
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

      shell.append(input, maximum);
      field.append(label, shell, error);
      fragment.append(field);
      manualInputs.set(die.id, { input, shell, error, die });

      input.addEventListener("input", () => clearFieldError(die.id));
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
    elements.diceGrid.replaceChildren(...cards);
    elements.oracleIdle.hidden = true;
    elements.results.hidden = false;
    elements.results.setAttribute("aria-busy", "true");
    elements.readoutState.textContent = "SCANNING";
    elements.readoutState.classList.add("is-active");
    elements.overallScore.textContent = "···";
    elements.overallVerdict.textContent = "正在解析六骰偏差";
    elements.overallCard.dataset.verdict = "neutral";
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

  function renderOverall(result) {
    elements.overallCard.dataset.verdict = result.verdict.tone;
    elements.overallScore.textContent = formatSigned(result.overall);
    elements.overallVerdict.textContent = result.verdict.text;
    elements.readoutState.textContent = "COMPLETE";
    elements.results.setAttribute("aria-busy", "false");
    elements.announcer.textContent =
      `综合天机 ${formatSigned(result.overall)}。${result.verdict.text}`;
  }

  function showResults(result, animate) {
    clearRevealTimers();
    const cards = DICE.map(createDieCard);
    prepareResults(cards);

    const finish = () => {
      cards.forEach((card, index) => renderDieResult(card, result.results[index]));
      renderOverall(result);

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
        renderOverall(result);
        if (activeMode === "auto") {
          elements.rollAutoLabel.textContent = "再次推演";
        }
        resolve();
      }, REVEAL_START_MS + (DICE.length - 1) * REVEAL_STEP_MS + 70);
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
    elements.announcer.textContent = "六骰正在推演。";

    const rolls = DICE.map((die) => randomInteger(die.sides));
    const result = calculateAll(rolls);

    try {
      await showResults(result, true);
    } finally {
      isRolling = false;
      elements.rollAuto.disabled = false;
      elements.tabs.forEach((tab) => {
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

    const result = calculateAll(rolls);
    showResults(result, false);
  }

  function resetResults() {
    clearRevealTimers();
    elements.diceGrid.replaceChildren();
    elements.results.hidden = true;
    elements.results.removeAttribute("aria-busy");
    elements.oracleIdle.hidden = false;
    elements.readoutState.textContent = "STANDBY";
    elements.readoutState.classList.remove("is-active");
    elements.overallCard.removeAttribute("data-verdict");
    elements.announcer.textContent = "";
  }

  function resetManualForm() {
    manualInputs.forEach((field) => {
      field.input.value = "";
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
    const isOnlinePage = location.protocol === "http:" || location.protocol === "https:";

    document.querySelectorAll("[data-online-only]").forEach((element) => {
      element.hidden = !isOnlinePage;
    });
  }

  elements.tabs.forEach((tab) => {
    tab.addEventListener("click", () => activateMode(tab.dataset.mode));
    tab.addEventListener("keydown", handleTabKeydown);
  });
  elements.rollAuto.addEventListener("click", startAutoRoll);
  elements.manualForm.addEventListener("submit", submitManual);
  elements.resetManual.addEventListener("click", resetManualForm);

  configureOnlineOnlyLinks();
  createManualFields();
})();
