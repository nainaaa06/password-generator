/**
 * script.js — SecurePass Password Generator
 * Author  : Naina (raghuvanshinaina06@gmail.com)
 * Built for Digital Heroes — https://digitalheroesco.com
 *
 * Features:
 *   - Cryptographically-secure password generation (Web Crypto API)
 *   - Length slider with live visual fill
 *   - Uppercase / Lowercase / Numbers / Symbols toggles
 *   - Real-time password strength evaluation
 *   - Copy-to-clipboard with animated feedback
 *   - Toast notification
 *   - Full accessibility (keyboard nav, ARIA live regions)
 */

'use strict';

/* ═══════════════════════════════════════════════════════════
   1. CHARACTER POOLS
═══════════════════════════════════════════════════════════ */

/** Available character sets mapped to checkbox IDs */
const CHAR_SETS = {
  upper:   'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  lower:   'abcdefghijklmnopqrstuvwxyz',
  numbers: '0123456789',
  symbols: '!@#$%^&*()_+-=[]{}|;:,.<>?',
};

/* ═══════════════════════════════════════════════════════════
   2. DOM REFERENCES
═══════════════════════════════════════════════════════════ */

const els = {
  // Password display
  passwordBox:     document.getElementById('passwordBox'),
  passwordDisplay: document.getElementById('passwordDisplay'),

  // Slider
  lengthSlider:    document.getElementById('lengthSlider'),
  lengthValue:     document.getElementById('lengthValue'),
  sliderFill:      document.getElementById('sliderFill'),

  // Checkboxes
  includeUpper:    document.getElementById('includeUpper'),
  includeLower:    document.getElementById('includeLower'),
  includeNumbers:  document.getElementById('includeNumbers'),
  includeSymbols:  document.getElementById('includeSymbols'),

  // Strength
  strengthBar:     document.querySelector('.strength-bar'),
  strengthName:    document.getElementById('strengthName'),
  segments:        [
    document.getElementById('seg1'),
    document.getElementById('seg2'),
    document.getElementById('seg3'),
    document.getElementById('seg4'),
  ],

  // Buttons
  generateBtn:     document.getElementById('generateBtn'),
  copyBtn:         document.getElementById('copyBtn'),
  copyBtnMain:     document.getElementById('copyBtnMain'),

  // Toast
  toast:           document.getElementById('toast'),
};

/* ═══════════════════════════════════════════════════════════
   3. STATE
═══════════════════════════════════════════════════════════ */

/** Holds the most recently generated password string */
let currentPassword = '';

/** Timer ID for the toast auto-hide */
let toastTimer = null;

/** Timer ID for the copy-icon reset */
let copyIconTimer = null;

/* ═══════════════════════════════════════════════════════════
   4. UTILITIES
═══════════════════════════════════════════════════════════ */

/**
 * Generates a cryptographically-secure random integer
 * in the range [0, max) using the Web Crypto API.
 *
 * Fallback to Math.random() for environments without crypto support.
 *
 * @param {number} max - Upper bound (exclusive)
 * @returns {number}
 */
function secureRandom(max) {
  if (window.crypto && window.crypto.getRandomValues) {
    const array = new Uint32Array(1);
    window.crypto.getRandomValues(array);
    return array[0] % max;
  }
  // Fallback (not cryptographically secure)
  return Math.floor(Math.random() * max);
}

/**
 * Shuffles an array in-place using the Fisher-Yates algorithm
 * with cryptographically-secure randomness.
 *
 * @param {Array} array - The array to shuffle
 * @returns {Array} The shuffled array (same reference)
 */
function secureShuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = secureRandom(i + 1);
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

/**
 * Returns the percentage fill for the slider track overlay.
 * Maps the slider value to a 0–100% range.
 *
 * @param {number} value - Current slider value
 * @param {number} min   - Slider minimum
 * @param {number} max   - Slider maximum
 * @returns {number} Percentage (0–100)
 */
function sliderFillPercent(value, min, max) {
  return ((value - min) / (max - min)) * 100;
}

/* ═══════════════════════════════════════════════════════════
   5. SLIDER — LENGTH DISPLAY & FILL
═══════════════════════════════════════════════════════════ */

/**
 * Updates the length display badge and the gradient track-fill
 * overlay whenever the slider value changes.
 */
function updateSliderUI() {
  const { lengthSlider, lengthValue, sliderFill } = els;
  const value = parseInt(lengthSlider.value, 10);

  // Update numeric label with a brief scale animation
  if (lengthValue.textContent !== String(value)) {
    lengthValue.textContent = value;
    triggerBumpAnimation(lengthValue);
  }

  // Update gradient fill bar width
  const percent = sliderFillPercent(value, lengthSlider.min, lengthSlider.max);
  sliderFill.style.width = `${percent}%`;
}

/**
 * Temporarily adds a CSS class to create a pop / scale animation,
 * then removes it so it can be triggered again.
 *
 * @param {HTMLElement} el - Target element
 */
function triggerBumpAnimation(el) {
  el.classList.remove('bump');
  // Force a reflow so the class removal is committed before re-adding
  void el.offsetWidth;
  el.classList.add('bump');
  setTimeout(() => el.classList.remove('bump'), 300);
}

/* ═══════════════════════════════════════════════════════════
   6. PASSWORD GENERATION
═══════════════════════════════════════════════════════════ */

/**
 * Reads the current control state and generates a secure password.
 *
 * Strategy:
 *   1. Build the full character pool from selected sets.
 *   2. Guarantee at least one character from each selected set
 *      (so the password always satisfies every checked rule).
 *   3. Fill the remaining length from the combined pool.
 *   4. Shuffle the result to prevent the guaranteed chars from
 *      always appearing at fixed positions.
 *
 * @returns {string} The generated password, or '' if no sets selected
 */
function generatePassword() {
  const length = parseInt(els.lengthSlider.value, 10);

  // Collect selected character sets
  const selectedSets = [];
  if (els.includeUpper.checked)   selectedSets.push(CHAR_SETS.upper);
  if (els.includeLower.checked)   selectedSets.push(CHAR_SETS.lower);
  if (els.includeNumbers.checked) selectedSets.push(CHAR_SETS.numbers);
  if (els.includeSymbols.checked) selectedSets.push(CHAR_SETS.symbols);

  // Guard: at least one type must be selected
  if (selectedSets.length === 0) return '';

  // Combined pool of all allowed characters
  const pool = selectedSets.join('');

  // Start with one guaranteed character from each selected set
  const guaranteed = selectedSets.map(set => set[secureRandom(set.length)]);

  // Fill remaining slots from the full pool
  const remaining = length - guaranteed.length;
  const extra = Array.from({ length: remaining }, () => pool[secureRandom(pool.length)]);

  // Merge and shuffle
  const passwordChars = secureShuffleArray([...guaranteed, ...extra]);
  return passwordChars.join('');
}

/* ═══════════════════════════════════════════════════════════
   7. STRENGTH EVALUATION
═══════════════════════════════════════════════════════════ */

/**
 * Evaluates the strength of the given password on a 0–4 scale.
 *
 * Scoring criteria:
 *   +1  if length ≥ 10
 *   +1  if length ≥ 16
 *   +1  if it contains both letters and digits
 *   +1  if it contains a symbol character
 *
 * @param {string} password - The password to evaluate
 * @returns {{ level: number, label: string, color: string }}
 */
function evaluateStrength(password) {
  if (!password) return { level: 0, label: '—', color: '' };

  let score = 0;

  if (password.length >= 10) score++;
  if (password.length >= 16) score++;
  if (/[A-Za-z]/.test(password) && /\d/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  const levels = [
    { label: '—',        color: '' },
    { label: 'Weak',     color: '#ef4444' },
    { label: 'Fair',     color: '#f97316' },
    { label: 'Good',     color: '#eab308' },
    { label: 'Strong',   color: '#22c55e' },
  ];

  return { level: score, ...levels[score] };
}

/**
 * Updates the strength bar segments and label text
 * to reflect the evaluated strength level.
 *
 * @param {number} level - Strength level 0–4
 * @param {string} label - Human-readable label
 * @param {string} color - CSS color for the strength name text
 */
function updateStrengthUI(level, label, color) {
  const { strengthBar, strengthName, segments } = els;

  // Update data attribute used by CSS selectors for coloring segments
  strengthBar.setAttribute('data-level', level);
  strengthBar.setAttribute('aria-valuenow', level);

  // Update label text and color
  strengthName.textContent = label;
  strengthName.style.color = color || '#94a3b8';

  // Update segment active class for scale animation
  segments.forEach((seg, i) => {
    seg.classList.toggle('active', i < level);
  });
}

/* ═══════════════════════════════════════════════════════════
   8. COPY TO CLIPBOARD
═══════════════════════════════════════════════════════════ */

/**
 * Copies the current password to the user's clipboard.
 * Uses the modern Clipboard API with a graceful fallback
 * to document.execCommand for older browsers.
 */
async function copyToClipboard() {
  if (!currentPassword) return;

  try {
    await navigator.clipboard.writeText(currentPassword);
    onCopySuccess();
  } catch (err) {
    // Fallback for browsers without Clipboard API
    legacyCopy(currentPassword);
  }
}

/**
 * Fallback copy using a temporary textarea element.
 *
 * @param {string} text - Text to copy
 */
function legacyCopy(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0;';
  document.body.appendChild(ta);
  ta.select();

  try {
    const success = document.execCommand('copy');
    if (success) onCopySuccess();
  } finally {
    document.body.removeChild(ta);
  }
}

/**
 * Called after a successful clipboard copy.
 * Triggers icon swap animations and shows the toast.
 */
function onCopySuccess() {
  // Animate the inline copy icon
  els.copyBtn.classList.add('copied');

  // Clear any existing reset timer
  clearTimeout(copyIconTimer);
  copyIconTimer = setTimeout(() => {
    els.copyBtn.classList.remove('copied');
  }, 2200);

  // Show toast
  showToast();
}

/* ═══════════════════════════════════════════════════════════
   9. TOAST NOTIFICATION
═══════════════════════════════════════════════════════════ */

/**
 * Shows the "copied" toast notification for 2.5 seconds,
 * then fades it out. Resets any active timer before showing.
 */
function showToast() {
  const { toast } = els;

  // Reset any running hide timer
  clearTimeout(toastTimer);

  // Trigger show
  toast.classList.add('show');

  // Auto-hide after delay
  toastTimer = setTimeout(() => {
    toast.classList.remove('show');
  }, 2500);
}

/* ═══════════════════════════════════════════════════════════
   10. PASSWORD DISPLAY UPDATE
═══════════════════════════════════════════════════════════ */

/**
 * Renders the generated password in the display box,
 * updates button states, and refreshes the strength meter.
 *
 * @param {string} password - The password to display
 */
function displayPassword(password) {
  const { passwordBox, passwordDisplay, copyBtn, copyBtnMain } = els;

  if (!password) {
    // No valid password (no character types selected)
    passwordDisplay.textContent = 'Select at least one character type.';
    passwordDisplay.classList.add('placeholder');
    passwordBox.classList.remove('has-password');
    copyBtn.disabled = true;
    copyBtnMain.disabled = true;
    currentPassword = '';
    updateStrengthUI(0, '—', '');
    return;
  }

  // Update display
  passwordDisplay.textContent = password;
  passwordDisplay.classList.remove('placeholder');
  passwordBox.classList.add('has-password');

  // Enable copy buttons
  copyBtn.disabled = false;
  copyBtnMain.disabled = false;

  // Reset copy icon state (in case it was in "copied" mode)
  els.copyBtn.classList.remove('copied');

  // Save to state
  currentPassword = password;

  // Evaluate and display strength
  const { level, label, color } = evaluateStrength(password);
  updateStrengthUI(level, label, color);
}

/* ═══════════════════════════════════════════════════════════
   11. GENERATE BUTTON — HANDLER & ANIMATION
═══════════════════════════════════════════════════════════ */

/**
 * Handles the Generate button click:
 *   1. Applies a spin animation to the button icon.
 *   2. Generates the password.
 *   3. Updates the UI.
 */
function handleGenerate() {
  const { generateBtn } = els;

  // Spin animation on the button icon
  generateBtn.classList.remove('generating');
  void generateBtn.offsetWidth; // reflow
  generateBtn.classList.add('generating');
  setTimeout(() => generateBtn.classList.remove('generating'), 600);

  // Generate and display
  const password = generatePassword();
  displayPassword(password);
}

/* ═══════════════════════════════════════════════════════════
   12. CHECKBOX VALIDATION
═══════════════════════════════════════════════════════════ */

/**
 * Ensures at least one checkbox remains checked.
 * If a user tries to uncheck the last active checkbox,
 * it is silently re-checked to prevent an empty character pool.
 *
 * @param {HTMLInputElement} changedCheckbox - The checkbox that was clicked
 */
function enforceAtLeastOneCheckbox(changedCheckbox) {
  const checkboxes = [
    els.includeUpper,
    els.includeLower,
    els.includeNumbers,
    els.includeSymbols,
  ];

  const anyChecked = checkboxes.some(cb => cb.checked);

  if (!anyChecked) {
    // Re-check the one that was just unchecked
    changedCheckbox.checked = true;
  }
}

/* ═══════════════════════════════════════════════════════════
   13. EVENT LISTENERS
═══════════════════════════════════════════════════════════ */

/**
 * Attaches all interactive event listeners.
 * Called once on DOMContentLoaded.
 */
function attachEventListeners() {
  // ── Slider ──────────────────────────────────────────────
  els.lengthSlider.addEventListener('input', () => {
    updateSliderUI();
    // Live-regenerate if a password already exists
    if (currentPassword) handleGenerate();
  });

  // ── Checkboxes ──────────────────────────────────────────
  [els.includeUpper, els.includeLower, els.includeNumbers, els.includeSymbols]
    .forEach(cb => {
      cb.addEventListener('change', () => {
        enforceAtLeastOneCheckbox(cb);
        // Live-regenerate when a type toggle changes
        if (currentPassword) handleGenerate();
      });
    });

  // ── Generate Button ─────────────────────────────────────
  els.generateBtn.addEventListener('click', handleGenerate);

  // ── Copy Buttons ─────────────────────────────────────────
  els.copyBtn.addEventListener('click', copyToClipboard);
  els.copyBtnMain.addEventListener('click', copyToClipboard);

  // ── Keyboard shortcut: Ctrl/Cmd + G → Generate ──────────
  document.addEventListener('keydown', (e) => {
    const isGenerate = (e.ctrlKey || e.metaKey) && e.key === 'g';
    const isCopy     = (e.ctrlKey || e.metaKey) && e.key === 'c' && document.activeElement === els.generateBtn;

    if (isGenerate) {
      e.preventDefault();
      handleGenerate();
    }
  });
}

/* ═══════════════════════════════════════════════════════════
   14. INITIALISATION
═══════════════════════════════════════════════════════════ */

/**
 * Bootstraps the application:
 *   1. Initialises the slider fill and label.
 *   2. Attaches all event listeners.
 *   3. Generates an initial password automatically.
 */
function init() {
  updateSliderUI();      // Set slider fill percentage on load
  attachEventListeners();
  handleGenerate();      // Show a password immediately on page load
}

// Run when the DOM is fully parsed
document.addEventListener('DOMContentLoaded', init);
