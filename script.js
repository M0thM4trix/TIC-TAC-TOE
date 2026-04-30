const PLAYERS = {
  X: { name: "X", label: "Крестики" },
  O: { name: "O", label: "Нолики" }
};

const WIN_COMBOS = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6]
];

const BOARD_NAMES = [
  "левый верх",
  "верх",
  "правый верх",
  "левый центр",
  "центр",
  "правый центр",
  "левый низ",
  "низ",
  "правый низ"
];

const state = {
  mode: "pvp",
  currentPlayer: "X",
  globalBoard: Array(9).fill(null),
  localBoards: Array.from({ length: 9 }, () => Array(9).fill(null)),
  activeBoardIndex: -1,
  gameActive: false,
  moveHistory: [],
  winningGlobalCombo: [],
  scores: { X: 0, O: 0, DRAW: 0 },
  audioCtx: null,
  aiTimer: null
};

const els = {
  menuScreen: document.getElementById("menu-screen"),
  gameScreen: document.getElementById("game-screen"),
  board: document.getElementById("board"),
  status: document.getElementById("status"),
  modeLabel: document.getElementById("mode-label"),
  targetBoard: document.getElementById("target-board"),
  moveCounter: document.getElementById("move-counter"),
  history: document.getElementById("history"),
  scoreX: document.getElementById("score-x"),
  scoreO: document.getElementById("score-o"),
  scoreDraw: document.getElementById("score-draw"),
  rulesDialog: document.getElementById("rules-dialog"),
  rulesBtn: document.getElementById("rules-btn"),
  undoBtn: document.getElementById("undo-btn"),
  newRoundBtn: document.getElementById("new-round-btn"),
  menuBtn: document.getElementById("menu-btn"),
  modeButtons: document.querySelectorAll(".mode-btn")
};

function init() {
  buildBoard();
  bindEvents();
  updateScores();
  showMenu();
}

function bindEvents() {
  els.modeButtons.forEach((button) => {
    button.addEventListener("click", () => startGame(button.dataset.mode));
  });

  els.rulesBtn.addEventListener("click", () => els.rulesDialog.showModal());
  els.newRoundBtn.addEventListener("click", () => {
    playSound("move");
    resetRound();
  });
  els.menuBtn.addEventListener("click", showMenu);
  els.undoBtn.addEventListener("click", undoMove);
}

function buildBoard() {
  els.board.innerHTML = "";

  for (let boardIndex = 0; boardIndex < 9; boardIndex++) {
    const largeBoard = document.createElement("div");
    largeBoard.className = "large-board";
    largeBoard.dataset.boardIndex = boardIndex;
    largeBoard.dataset.label = boardIndex + 1;

    for (let cellIndex = 0; cellIndex < 9; cellIndex++) {
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = "small-cell";
      cell.dataset.boardIndex = boardIndex;
      cell.dataset.cellIndex = cellIndex;
      cell.setAttribute("aria-label", `Большая доска ${boardIndex + 1}, клетка ${cellIndex + 1}`);
      cell.addEventListener("click", () => handleHumanMove(boardIndex, cellIndex));
      largeBoard.appendChild(cell);
    }

    els.board.appendChild(largeBoard);
  }
}

function startGame(mode) {
  state.mode = mode;
  els.modeLabel.textContent = mode === "ai" ? "Против бота" : "2 игрока";
  els.menuScreen.classList.remove("active");
  els.gameScreen.classList.add("active");
  resetRound();
}

function showMenu() {
  clearTimeout(state.aiTimer);
  state.gameActive = false;
  els.gameScreen.classList.remove("active");
  els.menuScreen.classList.add("active");
}

function resetRound() {
  clearTimeout(state.aiTimer);
  state.currentPlayer = "X";
  state.globalBoard = Array(9).fill(null);
  state.localBoards = Array.from({ length: 9 }, () => Array(9).fill(null));
  state.activeBoardIndex = -1;
  state.gameActive = true;
  state.moveHistory = [];
  state.winningGlobalCombo = [];
  render();
}

function handleHumanMove(boardIndex, cellIndex) {
  if (state.mode === "ai" && state.currentPlayer === "O") return;
  makeMove(boardIndex, cellIndex, "human");
}

function makeMove(boardIndex, cellIndex, source) {
  if (!state.gameActive) return false;

  if (!isMoveLegal(boardIndex, cellIndex)) {
    playSound("error");
    return false;
  }

  const player = state.currentPlayer;
  const previousActiveBoardIndex = state.activeBoardIndex;
  state.localBoards[boardIndex][cellIndex] = player;

  const localResult = evaluateBoard(state.localBoards[boardIndex]);
  let captured = null;
  if (localResult && !state.globalBoard[boardIndex]) {
    captured = localResult;
    state.globalBoard[boardIndex] = localResult;
  }

  state.moveHistory.push({
    player,
    boardIndex,
    cellIndex,
    previousActiveBoardIndex,
    captured,
    source
  });

  const globalResult = evaluateBoard(state.globalBoard, true);
  if (globalResult) {
    state.winningGlobalCombo = getWinningCombo(state.globalBoard, globalResult);
    finishRound(globalResult);
    render();
    playSound("win-global");
    return true;
  }

  if (state.globalBoard.every(Boolean)) {
    finishRound("DRAW");
    render();
    playSound("win-global");
    return true;
  }

  state.activeBoardIndex = state.globalBoard[cellIndex] ? -1 : cellIndex;
  state.currentPlayer = player === "X" ? "O" : "X";
  render();
  playSound(captured ? "win-local" : "move");
  scheduleAiMove();
  return true;
}

function isMoveLegal(boardIndex, cellIndex) {
  return (
    state.gameActive &&
    !state.globalBoard[boardIndex] &&
    !state.localBoards[boardIndex][cellIndex] &&
    (state.activeBoardIndex === -1 || state.activeBoardIndex === boardIndex)
  );
}

function evaluateBoard(board, ignoreDraw = false) {
  for (const combo of WIN_COMBOS) {
    const [a, b, c] = combo;
    if (board[a] && board[a] !== "DRAW" && board[a] === board[b] && board[a] === board[c]) {
      return board[a];
    }
  }

  if (!ignoreDraw && board.every(Boolean)) {
    return "DRAW";
  }

  return null;
}

function getWinningCombo(board, winner) {
  return WIN_COMBOS.find(([a, b, c]) => board[a] === winner && board[b] === winner && board[c] === winner) || [];
}

function finishRound(winner) {
  state.gameActive = false;
  state.scores[winner] += 1;
  updateScores();
}

function undoMove() {
  if (state.moveHistory.length === 0 || !state.gameActive) return;
  clearTimeout(state.aiTimer);

  const undoCount = state.mode === "ai" && state.currentPlayer === "X" && state.moveHistory.length > 1 ? 2 : 1;

  for (let i = 0; i < undoCount; i++) {
    const move = state.moveHistory.pop();
    if (!move) break;

    state.localBoards[move.boardIndex][move.cellIndex] = null;
    if (move.captured) {
      state.globalBoard[move.boardIndex] = null;
    }
    state.activeBoardIndex = move.previousActiveBoardIndex;
    state.currentPlayer = move.player;
  }

  render();
}

function scheduleAiMove() {
  clearTimeout(state.aiTimer);
  if (state.mode !== "ai" || state.currentPlayer !== "O" || !state.gameActive) return;

  state.aiTimer = setTimeout(() => {
    const move = chooseAiMove();
    if (move) makeMove(move.boardIndex, move.cellIndex, "ai");
  }, 520);
}

function chooseAiMove() {
  const legalMoves = getLegalMoves();
  if (legalMoves.length === 0) return null;

  const winMove = findTacticalMove(legalMoves, "O");
  if (winMove) return winMove;

  const blockMove = findTacticalMove(legalMoves, "X");
  if (blockMove) return blockMove;

  const globalSetup = legalMoves.find((move) => {
    const testGlobal = [...state.globalBoard];
    const testLocal = state.localBoards[move.boardIndex].map((cell, index) => (index === move.cellIndex ? "O" : cell));
    const localResult = evaluateBoard(testLocal);
    if (localResult === "O") testGlobal[move.boardIndex] = "O";
    return evaluateBoard(testGlobal, true) === "O";
  });
  if (globalSetup) return globalSetup;

  const preferredCells = [4, 0, 2, 6, 8, 1, 3, 5, 7];
  return [...legalMoves].sort((a, b) => {
    const boardScore = boardPreferenceScore(b.boardIndex) - boardPreferenceScore(a.boardIndex);
    if (boardScore !== 0) return boardScore;
    return preferredCells.indexOf(a.cellIndex) - preferredCells.indexOf(b.cellIndex);
  })[0];
}

function findTacticalMove(legalMoves, player) {
  return legalMoves.find((move) => {
    const testBoard = state.localBoards[move.boardIndex].map((cell, index) => (index === move.cellIndex ? player : cell));
    return evaluateBoard(testBoard) === player;
  });
}

function boardPreferenceScore(boardIndex) {
  if (boardIndex === 4) return 4;
  if ([0, 2, 6, 8].includes(boardIndex)) return 3;
  return 2;
}

function getLegalMoves() {
  const moves = [];
  const boards = state.activeBoardIndex === -1
    ? state.globalBoard.map((value, index) => (value ? null : index)).filter((value) => value !== null)
    : [state.activeBoardIndex];

  boards.forEach((boardIndex) => {
    if (state.globalBoard[boardIndex]) return;
    state.localBoards[boardIndex].forEach((cell, cellIndex) => {
      if (!cell) moves.push({ boardIndex, cellIndex });
    });
  });

  return moves;
}

function render() {
  renderCells();
  renderOverlays();
  renderHud();
  renderHistory();
}

function renderCells() {
  document.querySelectorAll(".large-board").forEach((boardEl) => {
    const boardIndex = Number(boardEl.dataset.boardIndex);
    const active = state.gameActive && !state.globalBoard[boardIndex] && (state.activeBoardIndex === -1 || state.activeBoardIndex === boardIndex);
    boardEl.classList.toggle("active", active);
    boardEl.classList.toggle("global-win", state.winningGlobalCombo.includes(boardIndex));
  });

  document.querySelectorAll(".small-cell").forEach((cell) => {
    const boardIndex = Number(cell.dataset.boardIndex);
    const cellIndex = Number(cell.dataset.cellIndex);
    const value = state.localBoards[boardIndex][cellIndex];
    const legal = isMoveLegal(boardIndex, cellIndex);
    const lastMove = state.moveHistory[state.moveHistory.length - 1];

    cell.textContent = value || "";
    cell.disabled = !legal || (state.mode === "ai" && state.currentPlayer === "O");
    cell.classList.toggle(
      "last-move",
      Boolean(lastMove && lastMove.boardIndex === boardIndex && lastMove.cellIndex === cellIndex)
    );
  });
}

function renderOverlays() {
  document.querySelectorAll(".board-winner").forEach((overlay) => overlay.remove());

  state.globalBoard.forEach((winner, boardIndex) => {
    if (!winner) return;

    const boardEl = document.querySelector(`.large-board[data-board-index="${boardIndex}"]`);
    const overlay = document.createElement("div");
    overlay.className = `board-winner${winner === "DRAW" ? " draw" : ""}`;
    overlay.textContent = winner === "DRAW" ? "-" : winner;
    boardEl.appendChild(overlay);
  });
}

function renderHud() {
  els.undoBtn.disabled = state.moveHistory.length === 0 || !state.gameActive;
  els.moveCounter.textContent = state.moveHistory.length;
  els.targetBoard.textContent = state.activeBoardIndex === -1 ? "Любая" : `${state.activeBoardIndex + 1}: ${BOARD_NAMES[state.activeBoardIndex]}`;

  if (!state.gameActive) {
    const winner = evaluateBoard(state.globalBoard, true);
    if (winner) {
      els.status.innerHTML = `Победитель: <span class="blink">${winner}</span>`;
    } else {
      els.status.innerHTML = `Игра окончена: <span class="blink">ничья</span>`;
    }
    return;
  }

  if (state.mode === "ai" && state.currentPlayer === "O") {
    els.status.innerHTML = `Бот думает: <span class="blink">O</span>`;
    return;
  }

  els.status.innerHTML = `Ход: <span class="blink">${state.currentPlayer}</span>`;
}

function renderHistory() {
  els.history.innerHTML = "";

  state.moveHistory.slice(-18).forEach((move) => {
    const item = document.createElement("li");
    item.textContent = `${move.player}: ${move.boardIndex + 1}.${move.cellIndex + 1}`;
    if (move.captured) {
      item.textContent += ` -> ${move.captured === "DRAW" ? "ничья" : `захват ${move.captured}`}`;
    }
    els.history.appendChild(item);
  });
}

function updateScores() {
  els.scoreX.textContent = state.scores.X;
  els.scoreO.textContent = state.scores.O;
  els.scoreDraw.textContent = state.scores.DRAW;
}

function playSound(type) {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    if (!state.audioCtx) state.audioCtx = new AudioContext();
    if (state.audioCtx.state === "suspended") state.audioCtx.resume();

    const osc = state.audioCtx.createOscillator();
    const gain = state.audioCtx.createGain();
    const now = state.audioCtx.currentTime;
    osc.connect(gain);
    gain.connect(state.audioCtx.destination);

    if (type === "move") {
      osc.type = "square";
      osc.frequency.setValueAtTime(300, now);
      osc.frequency.exponentialRampToValueAtTime(520, now + 0.08);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.linearRampToValueAtTime(0, now + 0.1);
      osc.start(now);
      osc.stop(now + 0.1);
    } else if (type === "win-local") {
      osc.type = "square";
      [440, 554, 659].forEach((freq, index) => osc.frequency.setValueAtTime(freq, now + index * 0.09));
      gain.gain.setValueAtTime(0.09, now);
      gain.gain.linearRampToValueAtTime(0, now + 0.36);
      osc.start(now);
      osc.stop(now + 0.36);
    } else if (type === "win-global") {
      osc.type = "square";
      [440, 554, 659, 880, 1108].forEach((freq, index) => osc.frequency.setValueAtTime(freq, now + index * 0.1));
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.linearRampToValueAtTime(0, now + 0.7);
      osc.start(now);
      osc.stop(now + 0.7);
    } else {
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(150, now);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.linearRampToValueAtTime(0, now + 0.14);
      osc.start(now);
      osc.stop(now + 0.14);
    }
  } catch (error) {
    console.warn("Audio playback failed", error);
  }
}

document.addEventListener("DOMContentLoaded", init);
