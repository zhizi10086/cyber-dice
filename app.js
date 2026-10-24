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
  const SHARE_BASE_URL = "https://zhizi10086.github.io/cyber-dice/";
  const DEFAULT_CARD_NAME = "无名道友";

  const CONFIG = {
    scenes: {
      wander: {
        id: "wander",
        label: "虚空漫游",
        shareKey: "wander",
        goodWhisper: "（虚空低语：心念澄明，前路自有回响。）",
        badWhisper: "（虚空低语：此刻迷雾正浓，宜静候星象流转。）",
      },
      relic: {
        id: "relic",
        label: "开核桃",
        shareKey: "relic",
        goodWhisper: "（虚空低语：金部件已在向你招手。）",
        badWhisper: "（虚空低语：光辉车必出福马，切勿浪费遗物。）",
      },
      riven: {
        id: "riven",
        label: "洗紫卡",
        shareKey: "kuva",
        goodWhisper: "（赤毒赐福：极易洗出极品词条，大胆重随。）",
        badWhisper: "（赤毒警示：天道无常，今日切勿死磕。）",
      },
      lich: {
        id: "lich",
        label: "捅玄骸",
        shareKey: "lich",
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
      historyKey: "cyberDice.history.v2",
      legacyHistoryKey: "cyberDice.history.v1",
      rollTimesKey: "cyberDice.rollTimes.v1",
      cardNameKey: "cyberDice.cardName.v1",
      historyLimit: 50,
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
    manualSubmit: document.querySelector('#manual-form button[type="submit"]'),
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
    copyShareLink: document.querySelector("#copy-share-link"),
    generateCard: document.querySelector("#generate-card"),
    extremeWarning: document.querySelector("#extreme-warning"),
    addictionWarning: document.querySelector("#addiction-warning"),
    warningFlash: document.querySelector("#warning-flash"),
    toast: document.querySelector("#toast"),
    formaSacrifice: document.querySelector("#forma-sacrifice"),
    formaFloats: document.querySelector("#forma-floats"),
    historyPanel: document.querySelector("#history-panel"),
    historyList: document.querySelector("#history-list"),
    historyEmpty: document.querySelector("#history-empty"),
    historyFilterEmpty: document.querySelector("#history-filter-empty"),
    historyFilters: [...document.querySelectorAll(".archive-filter")],
    historyCount: document.querySelector("#history-count"),
    historyFilterCounts: {
      all: document.querySelector("#filter-count-all"),
      good: document.querySelector("#filter-count-good"),
      neutral: document.querySelector("#filter-count-neutral"),
      bad: document.querySelector("#filter-count-bad"),
    },
    historyStorageNote: document.querySelector("#history-storage-note"),
    clearHistory: document.querySelector("#clear-history"),
    clearHistoryDialog: document.querySelector("#clear-history-dialog"),
    cancelClearHistory: document.querySelector("#cancel-clear-history"),
    confirmClearHistory: document.querySelector("#confirm-clear-history"),
    sharedBanner: document.querySelector("#shared-banner"),
    exitSharedView: document.querySelector("#exit-shared-view"),
    cardNameDialog: document.querySelector("#card-name-dialog"),
    cardNameForm: document.querySelector("#card-name-form"),
    cardNameInput: document.querySelector("#card-name-input"),
    cancelCardName: document.querySelector("#cancel-card-name"),
    cardSealName: document.querySelector("#card-seal-name"),
    cardScene: document.querySelector("#card-scene"),
    cardAchievement: document.querySelector("#card-achievement"),
    cardDiceList: document.querySelector("#card-dice-list"),
    cardOverallScore: document.querySelector("#card-overall-score"),
    cardVerdict: document.querySelector("#card-verdict"),
    cardWhisper: document.querySelector("#card-whisper"),
    cardQrCode: document.querySelector("#card-qr-code"),
    cardShareUrl: document.querySelector("#card-share-url"),
    oracleCard: document.querySelector("#oracle-card"),
    readoutState: document.querySelector("#readout-state"),
    announcer: document.querySelector("#announcer"),
    dieTemplate: document.querySelector("#die-card-template"),
  };

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const manualInputs = new Map();
  let activeMode = "auto";
  let activeScene = "wander";
  let activeHistoryFilter = "all";
  let isRolling = false;
  let isSharedView = false;
  let sharedExitNotice = "";
  let revealTimeouts = [];
  let revealIntervals = [];
  let toastTimeout = null;
  let warningFlashTimeout = null;
  let activeResult = null;
  let formaTapCount = 0;
  let formaToastShown = false;
  let isGeneratingCard = false;

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
      shouldRecord: true,
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
      `【场景】${result.scene.label}`,
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

  function buildShareUrl(result) {
    const url = new URL(SHARE_BASE_URL);
    url.searchParams.set("mode", result.scene.shareKey);

    DICE.forEach((die) => {
      url.searchParams.set(
        die.id.toLowerCase(),
        String(result.byId[die.id].roll),
      );
    });

    return url.href;
  }

  function parseSharedState() {
    const params = new URLSearchParams(location.search);
    const modeValues = params.getAll("mode");
    if (modeValues.length !== 1) {
      return null;
    }

    const mode = modeValues[0];
    const scene = Object.values(CONFIG.scenes)
      .find((candidate) => candidate.shareKey === mode);

    if (!scene) {
      return null;
    }

    const rolls = [];
    for (const die of DICE) {
      const parameterName = die.id.toLowerCase();
      const values = params.getAll(parameterName);
      if (values.length !== 1) {
        return null;
      }

      const rawValue = values[0];
      if (!/^\d+$/.test(rawValue)) {
        return null;
      }

      const roll = Number(rawValue);
      if (!Number.isInteger(roll) || roll < 1 || roll > die.sides) {
        return null;
      }
      rolls.push(roll);
    }

    return {
      sceneId: scene.id,
      rolls,
    };
  }

  function getToneFromOverall(overall) {
    if (overall > 20) {
      return "good";
    }
    if (overall < -20) {
      return "bad";
    }
    return "neutral";
  }

  function createRecordId() {
    if (typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }

    return `record-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function normalizeHistoryEntry(entry, index) {
    const validModes = new Set(["auto", "manual"]);
    const validScenes = new Set(Object.keys(CONFIG.scenes));
    if (
      !entry ||
      !Number.isFinite(entry.timestamp) ||
      !validModes.has(entry.mode) ||
      !validScenes.has(entry.scene) ||
      !Number.isFinite(entry.overall) ||
      typeof entry.verdict !== "string"
    ) {
      return null;
    }

    const validStates = new Set([0, 1, 2]);
    const dice = Array.isArray(entry.dice)
      ? entry.dice
        .filter((die) =>
          die &&
          DICE.some((definition) => definition.id === die.id) &&
          Number.isInteger(die.roll) &&
          Number.isFinite(die.contribution) &&
          validStates.has(die.state) &&
          typeof die.flavor === "string",
        )
        .slice(0, DICE.length)
      : [];

    return {
      schemaVersion: 2,
      id: typeof entry.id === "string" && entry.id
        ? entry.id
        : `legacy-${entry.timestamp}-${index}`,
      timestamp: entry.timestamp,
      mode: entry.mode,
      scene: entry.scene,
      overall: entry.overall,
      tone: ["good", "neutral", "bad"].includes(entry.tone)
        ? entry.tone
        : getToneFromOverall(entry.overall),
      verdict: entry.verdict,
      achievement:
        typeof entry.achievement === "string" && entry.achievement
          ? entry.achievement
          : "",
      whisper: typeof entry.whisper === "string" ? entry.whisper : "",
      dice: dice.length === DICE.length ? dice : null,
      legacy: dice.length !== DICE.length,
    };
  }

  function migrateLegacyHistory() {
    const legacy = storage.read(CONFIG.storage.legacyHistoryKey, []);
    if (!Array.isArray(legacy) || legacy.length === 0) {
      return [];
    }

    const migrated = legacy
      .map(normalizeHistoryEntry)
      .filter(Boolean)
      .slice(0, CONFIG.storage.historyLimit);
    storage.write(CONFIG.storage.historyKey, migrated);
    storage.remove(CONFIG.storage.legacyHistoryKey);
    return migrated;
  }

  function getHistoryEntries() {
    const value = storage.read(CONFIG.storage.historyKey, null);
    if (!Array.isArray(value)) {
      return migrateLegacyHistory();
    }

    return value
      .map(normalizeHistoryEntry)
      .filter(Boolean)
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

  function formatFullDateTime(timestamp) {
    const date = new Date(timestamp);
    const pad = (value) => String(value).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
      `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  }

  function getHistoryToneLabel(tone) {
    return tone === "good" ? "吉" : tone === "bad" ? "凶" : "平";
  }

  function createHistoryShareText(entry) {
    const scene = CONFIG.scenes[entry.scene];
    const lines = [
      "📜【虚空天机历史】",
      `时间：${formatFullDateTime(entry.timestamp)}`,
      `场景：${scene.label}`,
      `模式：${entry.mode === "manual" ? "手" : "自"}`,
    ];

    if (entry.dice) {
      entry.dice.forEach((die) => {
        const definition = DICE.find((candidate) => candidate.id === die.id);
        lines.push(
          `【${definition.role}】${die.id.padEnd(4)}: ${String(die.roll).padStart(2)} | 偏差 ${formatSigned(die.contribution)} | 【${STATE_NAMES[die.state]}】${die.flavor}`,
        );
      });
    } else {
      lines.push("【点数】旧记录未保存点数明细");
    }

    lines.push(
      "------------------------",
      `【综合天机】 ${formatSigned(entry.overall)}`,
      `【天师批语】 ${entry.verdict}`,
    );
    if (entry.achievement) {
      lines.push(`【成就】${entry.achievement}`);
    }
    if (entry.whisper) {
      lines.push(entry.whisper);
    }

    return lines.join("\n");
  }

  function buildHistoryShareUrl(entry) {
    if (!entry.dice) {
      return "";
    }

    const byId = Object.fromEntries(
      entry.dice.map((die) => [die.id, { roll: die.roll }]),
    );
    return buildShareUrl({
      scene: CONFIG.scenes[entry.scene],
      byId,
    });
  }

  function createHistoryDiceDetails(entry) {
    const container = document.createElement("div");
    container.className = "history-dice";

    entry.dice.forEach((savedDie) => {
      const definition = DICE.find((die) => die.id === savedDie.id);
      const row = document.createElement("div");
      row.className = "history-die";
      row.dataset.state = STATE_KEYS[savedDie.state];

      const dieName = document.createElement("span");
      dieName.textContent = `${savedDie.id} ${definition.role}`;
      const roll = document.createElement("strong");
      roll.textContent = `${savedDie.roll} 点`;
      const contribution = document.createElement("span");
      contribution.textContent = formatSigned(savedDie.contribution);
      const flavor = document.createElement("span");
      flavor.textContent = `${STATE_NAMES[savedDie.state]} · ${savedDie.flavor}`;

      row.append(dieName, roll, contribution, flavor);
      container.append(row);
    });

    return container;
  }

  async function copyHistoryText(entry) {
    try {
      await writeClipboard(createHistoryShareText(entry));
      showToast("带时间的历史战报已复制。");
    } catch {
      showToast("历史战报复制失败，请稍后重试。", "error");
    }
  }

  async function copyHistoryLink(entry) {
    const url = buildHistoryShareUrl(entry);
    if (!url) {
      showToast("旧记录没有点数明细，无法生成分享链接。", "error");
      return;
    }

    try {
      await writeClipboard(url);
      showToast("历史卦象链接已复制。");
    } catch {
      showToast("历史链接复制失败，请稍后重试。", "error");
    }
  }

  function renderHistory() {
    const entries = getHistoryEntries();
    elements.historyCount.textContent =
      `${entries.length} / ${CONFIG.storage.historyLimit}`;
    const counts = {
      all: entries.length,
      good: entries.filter((entry) => entry.tone === "good").length,
      neutral: entries.filter((entry) => entry.tone === "neutral").length,
      bad: entries.filter((entry) => entry.tone === "bad").length,
    };
    Object.entries(elements.historyFilterCounts).forEach(([tone, element]) => {
      element.textContent = String(counts[tone]);
    });
    elements.historyFilters.forEach((button) => {
      const isActive = button.dataset.filter === activeHistoryFilter;
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-pressed", String(isActive));
    });

    const filtered = activeHistoryFilter === "all"
      ? entries
      : entries.filter((entry) => entry.tone === activeHistoryFilter);
    elements.historyEmpty.hidden = entries.length > 0;
    elements.historyFilterEmpty.hidden =
      entries.length === 0 || filtered.length > 0;
    elements.historyList.hidden = filtered.length === 0;
    elements.clearHistory.disabled = entries.length === 0;
    elements.historyList.replaceChildren();

    filtered.forEach((entry) => {
      const scene = CONFIG.scenes[entry.scene];
      const item = document.createElement("li");
      item.className = "history-item";
      const details = document.createElement("details");
      details.className = "history-entry";
      details.dataset.recordId = entry.id;
      const summary = document.createElement("summary");
      summary.className = "history-entry__summary";

      const time = document.createElement("time");
      time.className = "history-entry__time";
      time.dateTime = new Date(entry.timestamp).toISOString();
      time.textContent = formatArchiveTime(entry.timestamp);

      const mode = document.createElement("span");
      mode.className = "history-entry__mode";
      mode.textContent = entry.mode === "manual" ? "[手]" : "[自]";

      const sceneLabel = document.createElement("span");
      sceneLabel.className = "history-entry__scene";
      sceneLabel.textContent = scene.label;

      const score = document.createElement("strong");
      score.className = "history-entry__score";
      score.textContent = formatSigned(entry.overall);

      const tone = document.createElement("span");
      tone.className = "history-entry__tone";
      tone.dataset.tone = entry.tone;
      tone.textContent = getHistoryToneLabel(entry.tone);

      const verdict = document.createElement("span");
      verdict.className = "history-entry__verdict";
      verdict.textContent = entry.verdict;

      summary.append(time, mode, sceneLabel, score, tone, verdict);

      const detail = document.createElement("div");
      detail.className = "history-entry__details";
      if (entry.dice) {
        detail.append(createHistoryDiceDetails(entry));
      } else {
        const legacyNote = document.createElement("p");
        legacyNote.className = "history-entry__legacy";
        legacyNote.textContent = "旧记录未保存点数明细。";
        detail.append(legacyNote);
      }
      if (entry.achievement) {
        const achievement = document.createElement("p");
        achievement.className = "history-entry__achievement";
        achievement.textContent = `成就解锁：${entry.achievement}`;
        detail.append(achievement);
      }
      if (entry.whisper) {
        const whisper = document.createElement("p");
        whisper.className = "history-entry__whisper";
        whisper.textContent = entry.whisper;
        detail.append(whisper);
      }

      const actions = document.createElement("div");
      actions.className = "history-entry__actions";
      const textButton = document.createElement("button");
      textButton.className = "history-action";
      textButton.type = "button";
      textButton.textContent = "复制带时间战报";
      textButton.addEventListener("click", () => copyHistoryText(entry));
      const linkButton = document.createElement("button");
      linkButton.className = "history-action";
      linkButton.type = "button";
      linkButton.textContent = "复制本卦链接";
      linkButton.disabled = !entry.dice;
      if (!entry.dice) {
        linkButton.title = "旧记录没有点数明细";
      }
      linkButton.addEventListener("click", () => copyHistoryLink(entry));
      actions.append(textButton, linkButton);
      detail.append(actions);

      details.append(summary, detail);
      item.append(details);
      elements.historyList.append(item);
    });
  }

  function recordResult(result) {
    const now = Date.now();
    const entry = {
      schemaVersion: 2,
      id: createRecordId(),
      timestamp: now,
      mode: result.mode,
      scene: result.scene.id,
      overall: result.overall,
      tone: result.verdict.tone,
      verdict: result.verdict.text,
      achievement: result.achievement?.name || "",
      whisper: result.whisper,
      dice: result.results.map((saved) => ({
        id: saved.die.id,
        roll: saved.roll,
        contribution: saved.contribution,
        state: saved.state,
        flavor: saved.flavor,
      })),
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

  async function copyShareLink() {
    if (!activeResult) {
      return;
    }

    try {
      await writeClipboard(buildShareUrl(activeResult));
      showToast("本卦链接已复制。");
    } catch {
      showToast("链接复制失败，请稍后重试。", "error");
    }
  }

  function sanitizeCardName(value) {
    const normalized = String(value).trim().replace(/\s+/g, " ");
    if (!normalized) {
      return DEFAULT_CARD_NAME;
    }

    return Array.from(normalized).slice(0, 12).join("");
  }

  function openCardNameDialog() {
    if (!activeResult || isGeneratingCard) {
      return;
    }

    const storedName = storage.read(
      CONFIG.storage.cardNameKey,
      DEFAULT_CARD_NAME,
    );
    elements.cardNameInput.value =
      typeof storedName === "string" && storedName.trim()
        ? sanitizeCardName(storedName)
        : DEFAULT_CARD_NAME;
    elements.cardNameDialog.showModal();
    window.requestAnimationFrame(() => {
      elements.cardNameInput.focus();
      elements.cardNameInput.select();
    });
  }

  function renderExportCard(result, cardName) {
    const shareUrl = buildShareUrl(result);
    elements.cardSealName.textContent = cardName;
    elements.cardScene.textContent = result.scene.label;
    elements.cardAchievement.hidden = !result.achievement;
    elements.cardAchievement.textContent = result.achievement
      ? `成就解锁：${result.achievement.name}`
      : "";
    elements.cardOverallScore.textContent = formatSigned(result.overall);
    elements.cardVerdict.textContent = result.verdict.text;
    elements.cardWhisper.hidden = !result.whisper;
    elements.cardWhisper.textContent = result.whisper;
    elements.cardShareUrl.textContent = shareUrl;
    elements.cardDiceList.replaceChildren();

    result.results.forEach(({ die, roll, state, flavor }) => {
      const item = document.createElement("li");
      const identity = document.createElement("span");
      const value = document.createElement("strong");
      const status = document.createElement("span");
      const text = document.createElement("span");

      identity.textContent = `${die.id} ${die.role}`;
      value.textContent = String(roll);
      status.textContent = STATE_NAMES[state];
      text.textContent = `${flavor}${die.reverse ? "（反）" : ""}`;
      status.dataset.state = STATE_KEYS[state];
      item.append(identity, value, status, text);
      elements.cardDiceList.append(item);
    });

    const qr = qrcode(0, "M");
    qr.addData(shareUrl, "Byte");
    qr.make();
    elements.cardQrCode.src = qr.createDataURL(6, 24);
    return shareUrl;
  }

  async function waitForImage(image) {
    if (image.complete && image.naturalWidth > 0) {
      return;
    }

    await new Promise((resolve, reject) => {
      image.addEventListener("load", resolve, { once: true });
      image.addEventListener("error", reject, { once: true });
    });
  }

  async function deliverCanvas(canvas) {
    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error("Card image generation returned an empty blob."));
          return;
        }
        resolve(blob);
      }, "image/png");
    });

    const now = new Date();
    const pad = (value) => String(value).padStart(2, "0");
    const filename =
      `tianji-card-${now.getFullYear()}${pad(now.getMonth() + 1)}` +
      `${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}` +
      `${pad(now.getSeconds())}.png`;
    const file = new File([blob], filename, { type: "image/png" });

    if (navigator.canShare?.({ files: [file] }) && navigator.share) {
      try {
        await navigator.share({
          title: "虚空天机计算盘",
          text: "我的本卦天机卡牌",
          files: [file],
        });
        return "shared";
      } catch (error) {
        if (error?.name === "AbortError") {
          return "cancelled";
        }
      }
    }

    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = filename;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    return "downloaded";
  }

  async function generateCardImage(cardName) {
    if (!activeResult || isGeneratingCard) {
      return;
    }

    isGeneratingCard = true;
    elements.generateCard.disabled = true;

    try {
      if (typeof window.html2canvas !== "function" || typeof window.qrcode !== "function") {
        throw new Error("Card generation libraries are unavailable.");
      }

      renderExportCard(activeResult, cardName);
      await waitForImage(elements.cardQrCode);
      await new Promise((resolve) => window.requestAnimationFrame(resolve));

      const canvas = await window.html2canvas(elements.oracleCard, {
        backgroundColor: "#020908",
        logging: false,
        scale: 1,
        useCORS: false,
        width: 750,
        height: 1334,
        windowWidth: 750,
        windowHeight: 1334,
      });
      const delivery = await deliverCanvas(canvas);
      if (delivery !== "cancelled") {
        showToast("天机卡牌已生成。");
      }
    } catch {
      showToast("天机卡牌生成失败，请稍后重试。", "error");
    } finally {
      isGeneratingCard = false;
      elements.generateCard.disabled = false;
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
    if (field.input.disabled) {
      field.decrease.disabled = true;
      field.increase.disabled = true;
      return;
    }

    const rawValue = field.input.value.trim();
    const numericValue = Number(rawValue);
    const hasIntegerValue = rawValue !== "" && Number.isInteger(numericValue);

    field.decrease.disabled = hasIntegerValue && numericValue <= 1;
    field.increase.disabled = hasIntegerValue && numericValue >= field.die.sides;
  }

  function adjustManualValue(field, delta) {
    if (field.input.disabled) {
      return;
    }

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
    elements.copyShareLink.disabled = true;
    elements.generateCard.disabled = true;
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
    const addictionTriggered = result.shouldRecord
      ? recordResult(result)
      : false;
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
    elements.copyShareLink.disabled = false;
    elements.generateCard.disabled = false;
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
    elements.copyShareLink.disabled = true;
    elements.generateCard.disabled = true;
    resetFormaInteraction();
    elements.announcer.textContent = "";
  }

  function setManualInputsDisabled(disabled) {
    manualInputs.forEach((field) => {
      field.input.disabled = disabled;
      updateStepperState(field);
    });
  }

  function setSharedControlsDisabled(disabled) {
    elements.tabs.forEach((tab) => {
      tab.disabled = disabled;
    });
    elements.sceneTabs.forEach((tab) => {
      tab.disabled = disabled;
    });
    elements.rollAuto.disabled = disabled;
    elements.manualSubmit.disabled = disabled;
    elements.resetManual.disabled = disabled;
    setManualInputsDisabled(disabled);
  }

  function enterSharedView(shared) {
    isSharedView = true;
    activateMode("manual");
    activateScene(shared.sceneId);

    DICE.forEach((die, index) => {
      manualInputs.get(die.id).input.value = String(shared.rolls[index]);
      updateStepperState(manualInputs.get(die.id));
    });

    setSharedControlsDisabled(true);
    elements.sharedBanner.hidden = false;
    const result = calculateAll(shared.rolls, shared.sceneId, "manual");
    result.shouldRecord = false;
    showResults(result, true);
  }

  function exitSharedView() {
    if (!isSharedView) {
      return;
    }

    isSharedView = false;
    const url = new URL(location.href);
    url.search = "";
    history.replaceState({}, "", url);
    elements.sharedBanner.hidden = true;
    setSharedControlsDisabled(false);
    resetResults();
    elements.announcer.textContent = "分享回放已结束，可以开始自己的推演。";
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
    const isDesktopShell =
      Boolean(window.__TAURI_INTERNALS__ || window.__TAURI__) ||
      location.hostname === "tauri.localhost" ||
      location.protocol === "tauri:";
    const isOnlinePage =
      (location.protocol === "http:" || location.protocol === "https:") &&
      location.hostname !== "cyber-dice.local" &&
      !isDesktopShell;

    document.querySelectorAll("[data-online-only]").forEach((element) => {
      element.hidden = !isOnlinePage;
    });
  }

  function registerServiceWorker() {
    const isDesktopShell =
      Boolean(window.__TAURI_INTERNALS__ || window.__TAURI__) ||
      location.hostname === "tauri.localhost" ||
      location.protocol === "tauri:";
    const isLocalDevelopment =
      location.hostname === "localhost" || location.hostname === "127.0.0.1";
    const canRegister =
      "serviceWorker" in navigator &&
      location.hostname !== "cyber-dice.local" &&
      !isDesktopShell &&
      (location.protocol === "https:" || isLocalDevelopment);

    if (!canRegister) {
      return;
    }

    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch(() => {
        // PWA 注册失败不影响在线起卦与卡牌功能。
      });
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
  elements.copyShareLink.addEventListener("click", copyShareLink);
  elements.generateCard.addEventListener("click", openCardNameDialog);
  elements.formaSacrifice.addEventListener("click", handleFormaTap);
  elements.manualForm.addEventListener("submit", submitManual);
  elements.resetManual.addEventListener("click", resetManualForm);
  elements.historyPanel.addEventListener("toggle", () => {
    if (elements.historyPanel.open) {
      renderHistory();
    }
  });
  elements.historyFilters.forEach((button) => {
    button.addEventListener("click", () => {
      activeHistoryFilter = button.dataset.filter;
      renderHistory();
    });
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
  elements.exitSharedView.addEventListener("click", exitSharedView);
  elements.cancelCardName.addEventListener("click", () => {
    elements.cardNameDialog.close();
  });
  elements.cardNameForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!activeResult) {
      elements.cardNameDialog.close();
      return;
    }

    const cardName = sanitizeCardName(elements.cardNameInput.value);
    storage.write(CONFIG.storage.cardNameKey, cardName);
    elements.cardNameDialog.close();
    void generateCardImage(cardName);
  });
  elements.cardNameDialog.addEventListener("click", (event) => {
    if (event.target === elements.cardNameDialog) {
      elements.cardNameDialog.close();
    }
  });

  configureOnlineOnlyLinks();
  elements.historyStorageNote.hidden = storage.persistent;
  renderHistory();
  createManualFields();
  const sharedState = parseSharedState();
  if (sharedState) {
    enterSharedView(sharedState);
  }
  registerServiceWorker();
})();
