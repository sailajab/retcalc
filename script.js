// --- Tab switching ---
const tabs = document.querySelectorAll(".tab");
const panels = document.querySelectorAll(".tab-panel");

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("active"));
    panels.forEach((p) => p.classList.remove("active"));
    tab.classList.add("active");
    document.querySelector(`.tab-panel[data-panel="${tab.dataset.tab}"]`).classList.add("active");
  });
});

// --- Result tabs (Overview / Income in Retirement / Year-by-Year) ---
const resultTabs = document.querySelectorAll(".result-tab");
const resultPanels = document.querySelectorAll(".result-tab-panel");

resultTabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    resultTabs.forEach((t) => t.classList.remove("active"));
    resultPanels.forEach((p) => p.classList.remove("active"));
    tab.classList.add("active");
    document.querySelector(`.result-tab-panel[data-rpanel="${tab.dataset.rtab}"]`).classList.add("active");
  });
});

// --- Helpers ---
const num = (id) => {
  const raw = document.getElementById(id).value.replace(/,/g, "");
  const v = parseFloat(raw);
  return isNaN(v) ? 0 : v;
};

const money = (v) =>
  v.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

// --- Persistence via browser localStorage — never sent to a server, survives
// tab/browser close so inputs aren't lost, until the user clears site data ---
const STORAGE_KEY = "retcalc-form-inputs";
const formFields = () => document.querySelectorAll("#calc-form input[id], #calc-form select[id]");

// Snapshot of the form's authored HTML defaults, captured before any saved
// session data overwrites them — lets "Reset for new person" restore the
// generic defaults rather than clearing fields to empty.
const defaultFormValues = {};
formFields().forEach((el) => {
  defaultFormValues[el.id] = el.value;
});

// Returns true when a previous session's inputs were actually found and
// restored, so the caller can decide whether to auto-run the calculation.
function restoreFormState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);
    formFields().forEach((el) => {
      if (Object.prototype.hasOwnProperty.call(data, el.id)) {
        el.value = data[el.id];
      }
    });
    return true;
  } catch (e) {
    // storage unavailable (e.g. private mode) — just skip restoring
    return false;
  }
}

function saveFormState() {
  try {
    const data = {};
    formFields().forEach((el) => {
      data[el.id] = el.value;
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    // storage unavailable — silently skip persisting
  }
}

const hasSavedInputs = restoreFormState();

document.getElementById("calc-form").addEventListener("input", saveFormState);
document.getElementById("calc-form").addEventListener("change", saveFormState);

// --- Spouse fields only matter (and are only shown) when married ---
const marriedSelect = document.getElementById("married");
const spouseFieldEls = document.querySelectorAll(".spouse-field");

function updateSpouseVisibility() {
  const isMarried = marriedSelect.value === "married";
  spouseFieldEls.forEach((el) => el.classList.toggle("hidden", !isMarried));

  // HSA is one shared account per household (no separate spouse HSA field),
  // so it becomes a Family HSA — covering both spouses' medical costs —
  // once married.
  const hsaBalanceLabel = document.getElementById("hsaBalanceLabel");
  const hsaContributionLabel = document.getElementById("hsaContributionLabel");
  if (hsaBalanceLabel) {
    hsaBalanceLabel.textContent = isMarried ? "Family HSA balance (covers you + spouse)" : "HSA balance";
  }
  if (hsaContributionLabel) {
    hsaContributionLabel.textContent = isMarried ? "Family HSA contribution ($/yr)" : "HSA contribution ($/yr)";
  }
}

marriedSelect.addEventListener("change", updateSpouseVisibility);
updateSpouseVisibility();

// --- US state vs. flat tax rate for outside the US ---
const countrySelect = document.getElementById("country");
const usaFieldEls = document.querySelectorAll(".usa-field");
const nonUsaFieldEls = document.querySelectorAll(".non-usa-field");

function updateCountryVisibility() {
  const isUsa = countrySelect.value === "usa";
  usaFieldEls.forEach((el) => el.classList.toggle("hidden", !isUsa));
  nonUsaFieldEls.forEach((el) => el.classList.toggle("hidden", isUsa));
}

countrySelect.addEventListener("change", updateCountryVisibility);
updateCountryVisibility();

// --- Money input formatting ($ prefix + live thousands separators as you type) ---
const moneyInputs = document.querySelectorAll("input.money");

const formatMoneyValue = (raw) => {
  const cleaned = raw.replace(/[^0-9.]/g, "");
  if (cleaned === "") return "";
  const n = parseFloat(cleaned);
  if (isNaN(n)) return "";
  return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
};

// Formats with commas while typing, keeping a trailing "." or partial decimals intact
// (so "1234." or "1,234.5" don't get clobbered mid-entry).
const formatMoneyLive = (raw) => {
  const cleaned = raw.replace(/[^0-9.]/g, "");
  if (cleaned === "") return "";
  const firstDot = cleaned.indexOf(".");
  let intPart = firstDot === -1 ? cleaned : cleaned.slice(0, firstDot);
  let decPart = firstDot === -1 ? null : cleaned.slice(firstDot + 1).replace(/\./g, "").slice(0, 2);
  intPart = intPart.replace(/^0+(?=\d)/, "");
  const withCommas = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return decPart === null ? withCommas : `${withCommas}.${decPart}`;
};

const digitsBefore = (str, pos) => (str.slice(0, pos).match(/[0-9]/g) || []).length;

const caretAfterNDigits = (str, n) => {
  if (n <= 0) return 0;
  let count = 0;
  for (let i = 0; i < str.length; i++) {
    if (/[0-9]/.test(str[i])) {
      count++;
      if (count === n) return i + 1;
    }
  }
  return str.length;
};

moneyInputs.forEach((el) => {
  el.value = formatMoneyValue(el.value) || "0";

  el.addEventListener("focus", () => {
    el.select();
  });

  el.addEventListener("input", () => {
    const caretDigitCount = digitsBefore(el.value, el.selectionStart);
    el.value = formatMoneyLive(el.value);
    const newCaret = caretAfterNDigits(el.value, caretDigitCount);
    el.setSelectionRange(newCaret, newCaret);
  });

  el.addEventListener("blur", () => {
    el.value = formatMoneyValue(el.value) || "0";
  });
});

// --- Minimize/expand the inputs panel (stays side-by-side with results,
// just narrowed to a strip) so the form can be tucked away once it's filled in ---
const layoutEl = document.querySelector(".layout");
const collapseInputsBtn = document.getElementById("collapseInputsBtn");
const expandInputsBtn = document.getElementById("expandInputsBtn");
const INPUTS_COLLAPSED_KEY = "retcalc-inputs-collapsed";

function setInputsCollapsed(collapsed) {
  layoutEl.classList.toggle("inputs-collapsed", collapsed);
  try {
    localStorage.setItem(INPUTS_COLLAPSED_KEY, collapsed ? "1" : "0");
  } catch (e) {
    // storage unavailable — collapse state just won't persist across reloads
  }
}

collapseInputsBtn.addEventListener("click", () => setInputsCollapsed(true));
expandInputsBtn.addEventListener("click", () => setInputsCollapsed(false));

try {
  if (localStorage.getItem(INPUTS_COLLAPSED_KEY) === "1") setInputsCollapsed(true);
} catch (e) {
  // storage unavailable — start expanded
}

let chart;
let incomeChart;

// --- Save inputs to a JSON file on disk each time Calculate is pressed ---
// A plain download triggers silently with no save dialog (as long as the
// browser isn't set to "always ask where to save"), landing directly in the
// default Downloads folder. Trade-off: since JS is never told the real
// absolute path (browsers don't expose that, by design) and can't get
// silent overwrite permission without a dialog, a repeat save may show up
// as "retcalc-inputs (1).json" etc. rather than replacing the prior one —
// the status message below always names the exact file just written.
const INPUTS_FILENAME = "retcalc-inputs.json";

// Nickname is sanitized to safe filename characters and prefixed onto the
// saved file, e.g. "alex-retcalc-inputs.json", so the file is identifiable
// when saved across multiple people/sessions.
function sanitizeNickname(raw) {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function buildInputsFilename() {
  const nickname = sanitizeNickname(document.getElementById("nickname").value);
  return nickname ? `${nickname}-${INPUTS_FILENAME}` : INPUTS_FILENAME;
}

function collectInputsForExport() {
  const data = {};
  formFields().forEach((el) => {
    data[el.id] = el.value;
  });
  data.savedAt = new Date().toISOString();
  return JSON.stringify(data, null, 2);
}

function guessDownloadFolder() {
  const ua = navigator.userAgent;
  if (/Windows/i.test(ua)) return "Downloads (usually C:\\Users\\<you>\\Downloads)";
  if (/Mac OS X/i.test(ua)) return "~/Downloads";
  if (/Linux/i.test(ua)) return "~/Downloads";
  return "your browser's default Downloads folder";
}

function saveInputsToFile() {
  const statusEl = document.getElementById("saveStatus");
  const json = collectInputsForExport();
  const filename = buildInputsFilename();

  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);

  if (statusEl) {
    statusEl.textContent =
      `Saved to ${guessDownloadFolder()} as "${filename}". Use "Load from file" to restore these inputs later ` +
      `— if your browser doesn't overwrite in place, look for the newest "${filename.replace(".json", "")} (n).json".`;
  }
}

// --- Load previously saved inputs back from a JSON file ---
// Repopulates the form (used when localStorage has been cleared, or to
// resume a session saved on another device/browser).
const loadFileBtn = document.getElementById("loadFileBtn");
const loadFileInput = document.getElementById("loadFileInput");

function setLoadStatus(msg) {
  const el = document.getElementById("loadStatus");
  if (el) el.textContent = msg;
}

function applyLoadedInputs(data) {
  formFields().forEach((el) => {
    if (Object.prototype.hasOwnProperty.call(data, el.id)) {
      el.value = data[el.id];
    }
  });
  moneyInputs.forEach((el) => {
    el.value = formatMoneyValue(el.value) || "0";
  });
  updateSpouseVisibility();
  saveFormState();
}

async function loadInputsFromFile() {
  if (window.showOpenFilePicker) {
    try {
      const [handle] = await window.showOpenFilePicker({
        types: [{ description: "JSON file", accept: { "application/json": [".json"] } }],
      });
      const file = await handle.getFile();
      applyLoadedInputs(JSON.parse(await file.text()));
      setLoadStatus(`Loaded inputs from "${handle.name}".`);
    } catch (err) {
      if (err.name === "AbortError") return;
      setLoadStatus("Could not load that file — make sure it's a JSON file previously saved by this app.");
    }
    return;
  }
  // Fallback for browsers without the File System Access API (e.g. Firefox, Safari)
  loadFileInput.click();
}

loadFileInput.addEventListener("change", () => {
  const file = loadFileInput.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      applyLoadedInputs(JSON.parse(reader.result));
      setLoadStatus(`Loaded inputs from "${file.name}".`);
    } catch (err) {
      setLoadStatus("Could not load that file — make sure it's a JSON file previously saved by this app.");
    }
  };
  reader.readAsText(file);
  loadFileInput.value = ""; // allow re-selecting the same file next time
});

loadFileBtn.addEventListener("click", loadInputsFromFile);

// --- Reset for a new person: restore the generic defaults, clear the saved
// session, and go back to the placeholder (doesn't touch the Downloads file) ---
document.getElementById("resetBtn").addEventListener("click", () => {
  const confirmed = window.confirm(
    "Reset all inputs to the generic defaults for a new person? This clears your currently saved session in this browser."
  );
  if (!confirmed) return;

  formFields().forEach((el) => {
    if (Object.prototype.hasOwnProperty.call(defaultFormValues, el.id)) {
      el.value = defaultFormValues[el.id];
    }
  });
  moneyInputs.forEach((el) => {
    el.value = formatMoneyValue(el.value) || "0";
  });
  updateSpouseVisibility();

  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    // storage unavailable — nothing to clear
  }

  document.getElementById("results-content").classList.add("hidden");
  document.getElementById("placeholder").classList.remove("hidden");
  setLoadStatus("");
  const saveStatusEl = document.getElementById("saveStatus");
  if (saveStatusEl) saveStatusEl.textContent = "";
});

document.getElementById("calc-form").addEventListener("submit", (e) => {
  e.preventDefault();
  runCalculation();
  saveInputsToFile();
});

// --- Federal income tax model ---
// Deliberately simplified: 2024 federal brackets only (no state/local tax,
// AMT, NIIT, or credits), standard deduction only (no itemizing), and no
// cost-basis tracking (dividends and brokerage withdrawals are both taxed
// at long-term capital-gains rates as a simplification). Bracket thresholds
// and the standard deduction are inflated forward each year like every
// other today's-dollars input in this app. Social Security's taxability
// thresholds are a real exception — by law they've never been inflation-
// indexed since the 1980s/90s, which is why more retirees owe tax on their
// benefits the longer they live — so those stay fixed, not inflated.
const ORDINARY_BRACKETS_SINGLE = [
  [0, 0.1], [11600, 0.12], [47150, 0.22], [100525, 0.24],
  [191950, 0.32], [243725, 0.35], [609350, 0.37],
];
const ORDINARY_BRACKETS_MARRIED = [
  [0, 0.1], [23200, 0.12], [94300, 0.22], [201050, 0.24],
  [383900, 0.32], [487450, 0.35], [731200, 0.37],
];
const LTCG_BRACKETS_SINGLE = [[0, 0], [47025, 0.15], [518900, 0.2]];
const LTCG_BRACKETS_MARRIED = [[0, 0], [94050, 0.15], [583750, 0.2]];
const STANDARD_DEDUCTION_SINGLE = 14600;
const STANDARD_DEDUCTION_MARRIED = 29200;
const SS_TAX_THRESHOLDS_SINGLE = { base: 25000, second: 34000 };
const SS_TAX_THRESHOLDS_MARRIED = { base: 32000, second: 44000 };

// Simplified state income tax: each state's approximate top marginal rate,
// applied as a flat rate on top of the federal calculation (most states
// don't offer a capital-gains preference the way federal tax does). This is
// a deliberate simplification, not each state's actual bracket schedule.
const STATE_TAX_RATES = {
  AL: 0.05, AK: 0, AZ: 0.025, AR: 0.044, CA: 0.133, CO: 0.044, CT: 0.0699,
  DE: 0.066, DC: 0.1075, FL: 0, GA: 0.0539, HI: 0.11, ID: 0.058, IL: 0.0495,
  IN: 0.0305, IA: 0.038, KS: 0.057, KY: 0.04, LA: 0.0425, ME: 0.0715,
  MD: 0.0575, MA: 0.05, MI: 0.0425, MN: 0.0985, MS: 0.047, MO: 0.048,
  MT: 0.059, NE: 0.0584, NV: 0, NH: 0, NJ: 0.1075, NM: 0.059, NY: 0.109,
  NC: 0.045, ND: 0.025, OH: 0.035, OK: 0.0475, OR: 0.099, PA: 0.0307,
  RI: 0.0599, SC: 0.064, SD: 0, TN: 0, TX: 0, UT: 0.0455, VT: 0.0875,
  VA: 0.0575, WA: 0, WV: 0.0512, WI: 0.0765, WY: 0,
};

// Marginal tax on `taxableIncome` under a progressive bracket table of
// [thresholdStart, rate] pairs sorted ascending.
function progressiveTax(taxableIncome, brackets) {
  if (taxableIncome <= 0) return 0;
  let tax = 0;
  for (let i = 0; i < brackets.length; i++) {
    const [start, rate] = brackets[i];
    if (taxableIncome <= start) break;
    const next = i + 1 < brackets.length ? brackets[i + 1][0] : Infinity;
    tax += (Math.min(taxableIncome, next) - start) * rate;
  }
  return tax;
}

// Tax on an additional slice of income that stacks on top of `baseIncome`
// within the same bracket table — used for capital gains, which are taxed
// at the rate corresponding to total income, not from $0.
function stackedTax(baseIncome, additionalAmount, brackets) {
  if (additionalAmount <= 0) return 0;
  return progressiveTax(baseIncome + additionalAmount, brackets) - progressiveTax(baseIncome, brackets);
}

// IRS "provisional income" approximation for how much of a Social Security
// benefit is taxable (0%, up to 50%, or up to 85%), based on other income.
function taxableSocialSecurity(ssBenefit, otherIncome, isMarried) {
  if (ssBenefit <= 0) return 0;
  const { base, second } = isMarried ? SS_TAX_THRESHOLDS_MARRIED : SS_TAX_THRESHOLDS_SINGLE;
  const combinedIncome = otherIncome + 0.5 * ssBenefit;
  if (combinedIncome <= base) return 0;
  if (combinedIncome <= second) {
    return Math.min(0.5 * ssBenefit, 0.5 * (combinedIncome - base));
  }
  const tier1 = Math.min(0.5 * ssBenefit, 0.5 * (second - base));
  const tier2 = 0.85 * (combinedIncome - second);
  return Math.min(0.85 * ssBenefit, tier1 + tier2);
}

function runCalculation() {
  // Personal
  const currentAge = num("currentAge");
  const retireAge = num("retireAge");
  const lifeExpectancy = num("lifeExpectancy");
  const isMarried = document.getElementById("married").value === "married";
  const spouseAge = isMarried ? num("spouseAge") : null;

  // Wealth sources (liquid net worth, excludes retirement accounts)
  const stocks = num("stocks");
  const cash = num("cash");
  const business = num("business");
  const investmentProperties = num("investmentProperties");
  const realEstateAppreciation = num("realEstateAppreciation") / 100;
  const loans = num("loans");

  // Debts (monthly payment + months remaining until each is paid off)
  const debts = [
    { label: "Mortgage", payment: num("mortgagePayment"), monthsLeft: num("mortgageMonthsLeft") },
    { label: "Car loan", payment: num("carLoanPayment"), monthsLeft: num("carLoanMonthsLeft") },
    { label: "Student loan", payment: num("studentLoanPayment"), monthsLeft: num("studentLoanMonthsLeft") },
    { label: "Consumer debt", payment: num("consumerDebtPayment"), monthsLeft: num("consumerDebtMonthsLeft") },
  ];
  // Debts still active (not yet paid off) at a point `yearsElapsed` years
  // from now, i.e. at the start of that year.
  const activeDebtsAt = (yearsElapsed) =>
    debts
      .filter((d) => d.payment > 0 && d.monthsLeft > yearsElapsed * 12)
      .map((d) => ({ label: d.label, amount: d.payment * 12 }));

  // Income / savings
  const w2Income = num("w2Income");
  const rentalIncome = num("rentalIncome");
  const dividends = num("dividends");
  const otherIncome = num("otherIncome");
  const annualSavings = num("annualSavings");
  const currentLivingCost = num("currentLivingCost");
  // Only W2 income stops at retirement — rental, dividends, and other income
  // keep coming in and continue to offset the withdrawal need afterward.
  const continuingIncome = rentalIncome + dividends + otherIncome;
  const totalAnnualIncome = w2Income + continuingIncome;

  // Retirement accounts
  const k401Balance = num("k401Balance");
  const k401Contribution = num("k401Contribution");
  const rothBalance = num("rothBalance");
  const rothContribution = num("rothContribution");
  const iraBalance = num("iraBalance");
  const iraContribution = num("iraContribution");
  const hsaBalance = num("hsaBalance");
  const hsaContribution = num("hsaContribution");
  const ssMonthly = num("ssMonthly");
  const ssStartAge = num("ssStartAge");

  // Spouse retirement accounts (household retires together at retireAge; only
  // counted when married — the fields are hidden and ignored otherwise)
  const spouse401kBalance = isMarried ? num("spouse401kBalance") : 0;
  const spouse401kContribution = isMarried ? num("spouse401kContribution") : 0;
  const spouseRothBalance = isMarried ? num("spouseRothBalance") : 0;
  const spouseRothContribution = isMarried ? num("spouseRothContribution") : 0;
  const spouseIraBalance = isMarried ? num("spouseIraBalance") : 0;
  const spouseIraContribution = isMarried ? num("spouseIraContribution") : 0;
  const spouseSsMonthly = isMarried ? num("spouseSsMonthly") : 0;
  const spouseSsStartAge = num("spouseSsStartAge");

  // Healthcare (per-person defaults; applied per spouse based on their own age)
  const preMedicareHealth = num("preMedicareHealth");
  const medicareAge = num("medicareAge") || 65;
  const medicareMonthly = num("medicareMonthly");

  // Goals
  const monthlyIncomeNeeded = num("monthlyIncomeNeeded");
  const preReturn = num("preReturn") / 100;
  const postReturn = num("postReturn") / 100;
  const inflation = num("inflation") / 100;
  const travelBudget = num("travelBudget");
  const travelYears = num("travelYears");

  // Tax brackets/deduction selected by filing status (married => joint).
  const ordinaryBrackets = isMarried ? ORDINARY_BRACKETS_MARRIED : ORDINARY_BRACKETS_SINGLE;
  const ltcgBrackets = isMarried ? LTCG_BRACKETS_MARRIED : LTCG_BRACKETS_SINGLE;
  const standardDeductionBase = isMarried ? STANDARD_DEDUCTION_MARRIED : STANDARD_DEDUCTION_SINGLE;

  // Tax jurisdiction: US federal + state brackets, or a flat rate for
  // everywhere else (the federal/state bracket model is US-specific).
  const country = document.getElementById("country").value;
  const state = document.getElementById("state").value;
  const isUsa = country === "usa";
  const stateTaxRate = STATE_TAX_RATES[state] || 0;
  const flatTaxRate = num("flatTaxRate") / 100;

  // Tax for one year, given that year's ordinary-rate and capital-gains-rate
  // income and how many years of inflation to apply to brackets/deduction.
  // Returns a total plus an ordinary/capital-gains split (state tax is
  // folded proportionally into that split for the per-source tooltip).
  function computeYearTax(ordinaryIncome, capGainsIncome, inflationFactor) {
    if (!isUsa) {
      // No federal/state model applies outside the US — just the flat rate
      // you provided, on total income.
      const totalIncome = ordinaryIncome + capGainsIncome;
      const tax = totalIncome * flatTaxRate;
      const ordinaryShare = totalIncome > 0 ? ordinaryIncome / totalIncome : 0;
      return { tax, taxOrdinary: tax * ordinaryShare, taxCapGains: tax * (1 - ordinaryShare) };
    }
    const inflatedOrdinary = ordinaryBrackets.map(([t, rr]) => [t * inflationFactor, rr]);
    const inflatedLtcg = ltcgBrackets.map(([t, rr]) => [t * inflationFactor, rr]);
    const inflatedStdDeduction = standardDeductionBase * inflationFactor;
    const ordinaryTaxable = Math.max(0, ordinaryIncome - inflatedStdDeduction);
    const federalOrdinary = progressiveTax(ordinaryTaxable, inflatedOrdinary);
    const federalCapGains = stackedTax(ordinaryTaxable, capGainsIncome, inflatedLtcg);
    // State tax approximated as a flat rate on the same taxable base — most
    // states tax capital gains as ordinary income, unlike federal.
    const stateBase = ordinaryTaxable + capGainsIncome;
    const stateTax = stateTaxRate * stateBase;
    const stateOrdinaryShare = stateBase > 0 ? ordinaryTaxable / stateBase : 0;
    return {
      tax: federalOrdinary + federalCapGains + stateTax,
      taxOrdinary: federalOrdinary + stateTax * stateOrdinaryShare,
      taxCapGains: federalCapGains + stateTax * (1 - stateOrdinaryShare),
    };
  }

  const netWorthToday =
    stocks + cash + business + investmentProperties +
    k401Balance + rothBalance + iraBalance + hsaBalance +
    spouse401kBalance + spouseRothBalance + spouseIraBalance - loans;

  // --- Withdrawal-order buckets ---
  // Business equity and investment-property equity are part of net worth but
  // are treated as illiquid — not available to fund year-to-year retirement
  // withdrawals — so they're excluded from these buckets and from the
  // spendable-balance simulation below. Traditional 401(k) and IRA balances
  // are combined into one "tax-deferred" bucket since both are taxed as
  // ordinary income and share the same place in the withdrawal order.
  // Not clamped at 0: if loans exceed cash, that excess debt should still
  // drag down the total spendable balance (matching how netWorthToday
  // subtracts the full loan amount above) rather than quietly vanishing.
  let cashBucket = cash - loans;
  let brokerageBucket = stocks;
  let taxDeferredBucket = k401Balance + iraBalance + spouse401kBalance + spouseIraBalance;
  let rothBucket = rothBalance + spouseRothBalance;
  let hsaBucket = hsaBalance;

  // Investment property equity stays illiquid (excluded from the spendable
  // buckets above) but still appreciates every year, unlike business equity
  // which is assumed to stay flat.
  let investmentPropertiesValue = investmentProperties;

  // --- Accumulation phase: currentAge -> retireAge ---
  let balance = cashBucket + brokerageBucket + taxDeferredBucket + rothBucket + hsaBucket;
  const ages = [];
  const balances = [];
  const yearRows = [];
  ages.push(currentAge);
  balances.push(balance);

  const yearsToRetirement = Math.max(0, retireAge - currentAge);
  const taxDeferredContribution = k401Contribution + iraContribution + spouse401kContribution + spouseIraContribution;
  const rothContributionTotal = rothContribution + spouseRothContribution;
  const totalAnnualContribution =
    annualSavings + taxDeferredContribution + rothContributionTotal + hsaContribution;

  for (let i = 1; i <= yearsToRetirement; i++) {
    const age = currentAge + i;
    const startBalance = balance;
    const growth = startBalance * preReturn;
    investmentPropertiesValue = investmentPropertiesValue * (1 + realEstateAppreciation);
    const bucketsStart = {
      cash: cashBucket,
      brokerage: brokerageBucket,
      taxDeferred: taxDeferredBucket,
      roth: rothBucket,
      hsa: hsaBucket,
    };

    // annualSavings ("amount invested/saved per year") is treated as going
    // into the taxable brokerage bucket.
    brokerageBucket = brokerageBucket * (1 + preReturn) + annualSavings;
    taxDeferredBucket = taxDeferredBucket * (1 + preReturn) + taxDeferredContribution;
    rothBucket = rothBucket * (1 + preReturn) + rothContributionTotal;
    hsaBucket = hsaBucket * (1 + preReturn) + hsaContribution;
    cashBucket = cashBucket * (1 + preReturn);

    balance = cashBucket + brokerageBucket + taxDeferredBucket + rothBucket + hsaBucket;

    // Living costs and debt payments don't reduce the balance here —
    // annualSavings is already the net amount set aside. Shown for reference
    // only (debt drops out of this once each loan's months remaining is up).
    const livingCost = currentLivingCost * 12 * Math.pow(1 + inflation, i);
    const debtBreakdown = activeDebtsAt(i - 1);
    const debtPayment = debtBreakdown.reduce((sum, d) => sum + d.amount, 0);

    // Reference-only tax estimate on this year's working income (doesn't
    // reduce contributions/balance — same convention as Living costs above).
    // W2/rental/other are ordinary income; dividends get LTCG treatment.
    const taxInflationAccum = Math.pow(1 + inflation, i);
    const ordinaryIncomeAccum = w2Income + rentalIncome + otherIncome;
    const { tax: taxAccum, taxOrdinary: taxOrdinaryAccum, taxCapGains: taxCapGainsAccum } = computeYearTax(
      ordinaryIncomeAccum,
      dividends,
      taxInflationAccum
    );

    ages.push(age);
    balances.push(balance);
    yearRows.push({
      age,
      phase: "accumulation",
      startBalance,
      income: totalAnnualIncome,
      continuingIncome,
      contribution: totalAnnualContribution,
      livingCost,
      travelCost: 0,
      debtPayment,
      debtBreakdown,
      healthCost: 0,
      healthCostSelf: 0,
      healthCostSpouse: 0,
      ssIncome: 0,
      growth,
      withdrawal: 0,
      tax: taxAccum,
      taxOrdinary: taxOrdinaryAccum,
      taxCapGains: taxCapGainsAccum,
      endBalance: balance,
      burnRate: 0,
      bucketsStart,
      bucketsEnd: {
        cash: cashBucket,
        brokerage: brokerageBucket,
        taxDeferred: taxDeferredBucket,
        roth: rothBucket,
        hsa: hsaBucket,
      },
    });
  }

  const balanceAtRetirement = balance;

  // --- Decumulation phase: retireAge -> lifeExpectancy ---
  let monthlyNeed = monthlyIncomeNeeded * Math.pow(1 + inflation, yearsToRetirement);
  const monthlyNeedAtRetirement = monthlyNeed;

  let depletedAge = null;
  const yearsInRetirement = Math.max(0, lifeExpectancy - retireAge);

  for (let i = 1; i <= yearsInRetirement; i++) {
    const age = retireAge + i - 1; // age at start of this year
    const yearsElapsed = age - currentAge;
    const spouseAgeNow = isMarried ? spouseAge + yearsElapsed : null;
    investmentPropertiesValue = investmentPropertiesValue * (1 + realEstateAppreciation);

    const ssSelfMonthly = age >= ssStartAge ? ssMonthly : 0;
    const ssSpouseMonthly = isMarried && spouseAgeNow >= spouseSsStartAge ? spouseSsMonthly : 0;
    const ss = ssSelfMonthly + ssSpouseMonthly;

    // Health coverage: private/COBRA-style premiums until Medicare eligibility, then Medicare + supplemental.
    // Applied per person, each checked against their own age.
    const healthInflation = Math.pow(1 + inflation, yearsElapsed);
    const personHealthMonthly = (personAge) =>
      (personAge < medicareAge ? preMedicareHealth : medicareMonthly) * healthInflation;
    const healthMonthly =
      personHealthMonthly(age) + (isMarried ? personHealthMonthly(spouseAgeNow) : 0);

    const livingMonthly = monthlyNeed;
    const debtBreakdown = activeDebtsAt(yearsElapsed);
    const annualDebtPayment = debtBreakdown.reduce((sum, d) => sum + d.amount, 0);
    const debtMonthly = annualDebtPayment / 12;
    // Go-go years: extra travel spending for the first `travelYears` years of
    // retirement, then it drops to $0 — people tend to slow down and spend
    // less (especially on travel) later in retirement.
    const travelMonthly = i <= travelYears ? (travelBudget / 12) * healthInflation : 0;
    const totalMonthlyNeed = livingMonthly + healthMonthly + debtMonthly + travelMonthly;
    // W2 income stops at retirement, but rental, dividends, and other income
    // keep coming in and offset the withdrawal need just like Social Security.
    const continuingIncomeMonthly = continuingIncome / 12;
    const annualWithdrawal = Math.max(0, (totalMonthlyNeed - ss - continuingIncomeMonthly) * 12);
    const annualHealthCost = healthMonthly * 12;
    const annualTravelCost = travelMonthly * 12;

    const startBalance = balance;
    const growth = startBalance * postReturn;
    const bucketsStart = {
      cash: cashBucket,
      brokerage: brokerageBucket,
      taxDeferred: taxDeferredBucket,
      roth: rothBucket,
      hsa: hsaBucket,
    };

    // Tax-efficient withdrawal order: HSA is earmarked for this year's
    // healthcare cost specifically (the only tax-free use of HSA funds);
    // remaining need is drawn from cash first, then the taxable brokerage
    // account, then tax-deferred accounts (401k/IRA), and Roth last since
    // it's tax-free and has no required distributions — the accounts you'd
    // most want to keep compounding as long as possible.
    // Growth is applied to each bucket's own start-of-year balance, then the
    // draw is subtracted — same order the original single-balance model
    // used (start * (1 + r) - withdrawal), just split across buckets.
    let remainingNeed = annualWithdrawal;

    let hsaDraw = Math.min(hsaBucket, Math.min(annualHealthCost, remainingNeed));
    hsaBucket = hsaBucket * (1 + postReturn) - hsaDraw;
    remainingNeed -= hsaDraw;

    let cashDraw = Math.min(cashBucket, remainingNeed);
    cashBucket = cashBucket * (1 + postReturn) - cashDraw;
    remainingNeed -= cashDraw;

    let brokerageDraw = Math.min(brokerageBucket, remainingNeed);
    brokerageBucket = brokerageBucket * (1 + postReturn) - brokerageDraw;
    remainingNeed -= brokerageDraw;

    let taxDeferredDraw = Math.min(taxDeferredBucket, remainingNeed);
    taxDeferredBucket = taxDeferredBucket * (1 + postReturn) - taxDeferredDraw;
    remainingNeed -= taxDeferredDraw;

    // Roth absorbs whatever is left, even if it runs the bucket negative —
    // that's how a plan-wide shortfall shows up in the projection below.
    let rothDraw = remainingNeed;
    rothBucket = rothBucket * (1 + postReturn) - rothDraw;
    remainingNeed = 0;

    // --- Tax on this year's income, by source ---
    // Ordinary rates: rental/other income, taxable Social Security, and the
    // 401(k)/Traditional IRA withdrawal above. LTCG rates: dividends and the
    // brokerage withdrawal (simplification — no cost-basis tracking, so the
    // full withdrawal is treated as gain). Cash, Roth, and HSA withdrawals
    // are tax-free. Thresholds/deduction inflated forward; SS thresholds
    // are not (see note above the tax model). Outside the US, the partial-
    // taxability rule for Social Security is a US-specific quirk — the full
    // benefit is just treated as ordinary income for the flat-rate calc.
    const rentalOtherIncome = rentalIncome + otherIncome;
    const capGainsIncome = dividends + brokerageDraw;
    // The IRS "combined income" test for SS taxability counts ALL other
    // income, including capital gains/dividends — not just ordinary income.
    const ssTaxable = isUsa
      ? taxableSocialSecurity(ss * 12, rentalOtherIncome + taxDeferredDraw + capGainsIncome, isMarried)
      : ss * 12;
    const ordinaryIncome = rentalOtherIncome + taxDeferredDraw + ssTaxable;
    const { tax, taxOrdinary, taxCapGains } = computeYearTax(ordinaryIncome, capGainsIncome, healthInflation);

    // Draw the tax bill itself from the same buckets in the same priority
    // order — skipping HSA, since using it for anything but qualified
    // medical expenses would trigger its own tax (and a penalty pre-65).
    // These are plain subtractions, not a second year of growth — this
    // year's growth was already applied once, above.
    // Note: this is a single pass, not a fully-converged gross-up — the
    // extra 401(k)/IRA withdrawal drawn here to cover the tax bill would
    // itself generate a little more tax that isn't re-taxed.
    let remainingTax = tax;

    const cashDrawForTax = Math.min(cashBucket, remainingTax);
    cashBucket -= cashDrawForTax;
    remainingTax -= cashDrawForTax;
    cashDraw += cashDrawForTax;

    const brokerageDrawForTax = Math.min(brokerageBucket, remainingTax);
    brokerageBucket -= brokerageDrawForTax;
    remainingTax -= brokerageDrawForTax;
    brokerageDraw += brokerageDrawForTax;

    const taxDeferredDrawForTax = Math.min(taxDeferredBucket, remainingTax);
    taxDeferredBucket -= taxDeferredDrawForTax;
    remainingTax -= taxDeferredDrawForTax;
    taxDeferredDraw += taxDeferredDrawForTax;

    const rothDrawForTax = remainingTax;
    rothBucket -= rothDrawForTax;
    rothDraw += rothDrawForTax;

    const totalWithdrawal = annualWithdrawal + tax;

    balance = cashBucket + brokerageBucket + taxDeferredBucket + rothBucket + hsaBucket;
    monthlyNeed = monthlyNeed * (1 + inflation);

    const endAge = retireAge + i;
    ages.push(endAge);
    balances.push(balance);

    const burnRate = startBalance > 0 ? (totalWithdrawal / startBalance) * 100 : 0;

    yearRows.push({
      age: endAge,
      phase: "retirement",
      startBalance,
      income: ss * 12 + continuingIncome + totalWithdrawal,
      continuingIncome,
      contribution: 0,
      livingCost: livingMonthly * 12,
      travelCost: annualTravelCost,
      debtPayment: annualDebtPayment,
      debtBreakdown,
      healthCost: annualHealthCost,
      healthCostSelf: personHealthMonthly(age) * 12,
      healthCostSpouse: isMarried ? personHealthMonthly(spouseAgeNow) * 12 : 0,
      ssIncome: ss * 12,
      ssIncomeSelf: ssSelfMonthly * 12,
      ssIncomeSpouse: ssSpouseMonthly * 12,
      growth,
      withdrawal: totalWithdrawal,
      tax,
      taxOrdinary,
      taxCapGains,
      ssTaxable,
      endBalance: balance,
      burnRate,
      hsaDraw,
      cashDraw,
      brokerageDraw,
      taxDeferredDraw,
      rothDraw,
      bucketsStart,
      bucketsEnd: {
        cash: cashBucket,
        brokerage: brokerageBucket,
        taxDeferred: taxDeferredBucket,
        roth: rothBucket,
        hsa: hsaBucket,
      },
    });

    if (balance <= 0 && depletedAge === null) {
      depletedAge = endAge;
    }
  }

  renderResults({
    netWorthToday,
    balanceAtRetirement,
    monthlyNeedAtRetirement,
    depletedAge,
    lifeExpectancy,
    retireAge,
    ages,
    balances,
    yearRows,
    isMarried,
    remainingBuckets: {
      cash: cashBucket,
      brokerage: brokerageBucket,
      taxDeferred: taxDeferredBucket,
      roth: rothBucket,
      hsa: hsaBucket,
    },
    illiquid: { business, investmentProperties: investmentPropertiesValue },
    ssStartAge,
    spouseSsStartAge,
    continuingIncome,
    // Raw inputs kept around purely to build per-cell tooltip breakdowns —
    // these don't vary year to year, unlike the fields already on yearRows.
    currentAge,
    w2Income,
    rentalIncome,
    dividends,
    otherIncome,
    annualSavings,
    taxDeferredContribution,
    rothContributionTotal,
    hsaContribution,
    preReturn,
    postReturn,
    inflation,
    currentLivingCost,
    monthlyIncomeNeeded,
    travelBudget,
    travelYears,
  });
}

function renderResults(r) {
  document.getElementById("placeholder").classList.add("hidden");
  document.getElementById("results-content").classList.remove("hidden");

  document.getElementById("statNetWorth").textContent = money(r.netWorthToday);
  document.getElementById("statAtRetirement").textContent = money(Math.max(0, r.balanceAtRetirement));
  document.getElementById("statMonthlyNeed").textContent = money(r.monthlyNeedAtRetirement);

  const verdictEl = document.getElementById("verdict");
  if (r.depletedAge === null) {
    const leftover = r.balances[r.balances.length - 1];
    verdictEl.className = "verdict good";
    verdictEl.textContent =
      `On track — your money is projected to last through age ${r.lifeExpectancy}` +
      (leftover > 0 ? `, with about ${money(leftover)} remaining.` : ".");
  } else {
    verdictEl.className = "verdict bad";
    verdictEl.textContent =
      `Shortfall — at this rate your money runs out around age ${r.depletedAge}, ` +
      `${r.lifeExpectancy - r.depletedAge} year(s) before your target of ${r.lifeExpectancy}. ` +
      `Consider saving more, retiring later, or reducing planned spending.`;
  }

  renderYearTable(r);
  drawChart(r);
  renderIncomeSources(r);
  renderMonthlyTable(r);
  renderRemainingBreakdown(r);
}

// --- Overview tab: what's left of each wealth source and income source ---
function renderRemainingBreakdown(r) {
  const headingEl = document.getElementById("remainingHeading");
  if (headingEl) headingEl.textContent = `What's left at age ${r.lifeExpectancy}`;

  const b = r.remainingBuckets;
  const wealthRows = [
    ["Cash / savings", Math.max(0, b.cash)],
    ["Brokerage (stocks)", Math.max(0, b.brokerage)],
    ["401(k) / Traditional IRA", Math.max(0, b.taxDeferred)],
    ["Roth IRA", Math.max(0, b.roth)],
    ["HSA", Math.max(0, b.hsa)],
    ["Business equity (untouched)", r.illiquid.business],
    ["Investment properties (appreciated, untouched)", r.illiquid.investmentProperties],
  ];
  const totalRemaining = wealthRows.reduce((sum, [, v]) => sum + v, 0);

  const wealthBody = document.getElementById("remainingWealthTableBody");
  wealthBody.innerHTML =
    wealthRows.map(([label, v]) => `<tr><td>${label}</td><td>${money(v)}</td></tr>`).join("") +
    `<tr><td><strong>Total</strong></td><td><strong>${money(totalRemaining)}</strong></td></tr>`;

  const lastRetirementRow = r.yearRows.filter((row) => row.phase === "retirement").slice(-1)[0];

  const incomeRows = [
    ["W2 income", `Stopped at retirement (age ${r.retireAge})`],
    [
      "Rental / dividends / other income",
      r.continuingIncome > 0 ? `${money(r.continuingIncome)}/yr — continues into retirement` : "$0",
    ],
  ];

  if (lastRetirementRow) {
    incomeRows.push([
      "Social Security (you)",
      lastRetirementRow.ssIncomeSelf > 0
        ? `${money(lastRetirementRow.ssIncomeSelf)}/yr (started at age ${r.ssStartAge})`
        : `Not started by age ${r.lifeExpectancy}`,
    ]);
    if (r.isMarried) {
      incomeRows.push([
        "Social Security (spouse)",
        lastRetirementRow.ssIncomeSpouse > 0
          ? `${money(lastRetirementRow.ssIncomeSpouse)}/yr (started at age ${r.spouseSsStartAge})`
          : `Not started by age ${r.lifeExpectancy}`,
      ]);
    }
    incomeRows.push([
      "Portfolio withdrawal",
      lastRetirementRow.withdrawal > 0
        ? `${money(lastRetirementRow.withdrawal)}/yr in the final year`
        : "$0 — Social Security fully covers expenses",
    ]);
  } else {
    incomeRows.push(["Social Security / portfolio withdrawal", "Plan doesn't reach retirement"]);
  }

  const incomeBody = document.getElementById("remainingIncomeTableBody");
  incomeBody.innerHTML = incomeRows
    .map(([label, status]) => `<tr><td>${label}</td><td>${status}</td></tr>`)
    .join("");
}

// Builds a "Label: $X + Label: $Y = $Total" tooltip string from a list of
// [label, value] parts. Used to explain how a cell's total was made up.
function breakdownTooltip(parts, total) {
  const line = parts.map(([label, v]) => `${label}: ${money(v)}`).join(" + ");
  return `${line} = ${money(total)}`;
}

function rowCellTooltips(r, row) {
  const isAccum = row.phase === "accumulation";
  const yearsSinceStart = row.age - r.currentAge;
  const rate = isAccum ? r.preReturn : r.postReturn;

  const age = isAccum
    ? `Accumulation year ${yearsSinceStart} of ${r.retireAge - r.currentAge}, until retirement at age ${r.retireAge}.`
    : `Retirement year ${row.age - r.retireAge} of ${r.lifeExpectancy - r.retireAge}, planned to last until age ${r.lifeExpectancy}.`;

  const balanceStart = breakdownTooltip(
    [
      ["Cash", row.bucketsStart.cash],
      ["Brokerage", row.bucketsStart.brokerage],
      ["401(k)/IRA", row.bucketsStart.taxDeferred],
      ["Roth IRA", row.bucketsStart.roth],
      ["HSA", row.bucketsStart.hsa],
    ],
    row.startBalance
  );

  const income = isAccum
    ? breakdownTooltip(
        [
          ["W2", r.w2Income],
          ["Rental", r.rentalIncome],
          ["Dividends", r.dividends],
          ["Other", r.otherIncome],
        ],
        row.income
      )
    : breakdownTooltip(
        [
          ["Social Security (you)", row.ssIncomeSelf],
          ...(r.isMarried ? [["Social Security (spouse)", row.ssIncomeSpouse]] : []),
          ["Rental/dividends/other", row.continuingIncome],
          ["Portfolio withdrawal", row.withdrawal],
        ],
        row.income
      );

  const continuingIncome = breakdownTooltip(
    [
      ["Rental", r.rentalIncome],
      ["Dividends", r.dividends],
      ["Other", r.otherIncome],
    ],
    row.continuingIncome
  );

  const contribution = isAccum
    ? breakdownTooltip(
        [
          ["Annual savings", r.annualSavings],
          ["401(k)/IRA", r.taxDeferredContribution],
          ["Roth IRA", r.rothContributionTotal],
          ["HSA", r.hsaContribution],
        ],
        row.contribution
      )
    : "No new contributions during retirement.";

  // Accumulation years show currentLivingCost (Income tab, reference only —
  // doesn't drive the balance). Retirement years actually spend from
  // monthlyIncomeNeeded (Goals tab), inflated continuously from today —
  // one year less than yearsSinceStart, since it's compounded once before
  // the first retirement year even starts.
  const livingCost = isAccum
    ? `${money(r.currentLivingCost)}/mo today (Income tab) x 12 months, inflated at ${(r.inflation * 100).toFixed(1)}%/yr for ${yearsSinceStart} year(s) = ${money(row.livingCost)}`
    : `${money(r.monthlyIncomeNeeded)}/mo needed in retirement, today's dollars (Goals tab) x 12 months, inflated at ${(r.inflation * 100).toFixed(1)}%/yr for ${yearsSinceStart - 1} year(s) = ${money(row.livingCost)}`;

  const retirementYearIndex = row.age - r.retireAge;
  // Travel cost is inflated using yearsElapsed = (start-of-year age) -
  // currentAge, same one-year offset from yearsSinceStart as living costs.
  const travel = isAccum
    ? "No travel budget before retirement."
    : row.travelCost > 0
    ? `Go-go year ${retirementYearIndex} of ${r.travelYears}: ${money(r.travelBudget)}/yr today, inflated for ${yearsSinceStart - 1} year(s) = ${money(row.travelCost)}`
    : `Go-go years (${r.travelYears}) are over — no travel budget this year.`;

  const debtPayment = row.debtBreakdown.length
    ? breakdownTooltip(row.debtBreakdown.map((d) => [d.label, d.amount]), row.debtPayment)
    : "No active loan payments this year.";

  const healthCost = isAccum
    ? "Employer-provided coverage assumed while working — no cost modeled."
    : breakdownTooltip(
        [["You", row.healthCostSelf], ...(r.isMarried ? [["Spouse", row.healthCostSpouse]] : [])],
        row.healthCost
      );

  const ssIncome = isAccum
    ? "Not started — you're still working."
    : breakdownTooltip(
        [["You", row.ssIncomeSelf], ...(r.isMarried ? [["Spouse", row.ssIncomeSpouse]] : [])],
        row.ssIncome
      );

  const growth = `${money(row.startBalance)} start balance x ${(rate * 100).toFixed(1)}% expected return = ${money(row.growth)}`;

  const withdrawal = isAccum
    ? "No withdrawals — still accumulating."
    : breakdownTooltip(
        [
          ["HSA", row.hsaDraw],
          ["Cash", row.cashDraw],
          ["Brokerage", row.brokerageDraw],
          ["401(k)/IRA", row.taxDeferredDraw],
          ["Roth IRA", row.rothDraw],
        ],
        row.withdrawal
      );

  // Tax is allocated back to each income source proportional to that
  // source's share of the ordinary (or capital-gains) income base — a
  // progressive bracket doesn't have one single "correct" per-source split,
  // so this is a reasonable convention that still sums exactly to the total.
  const ordinarySources = isAccum
    ? [["W2 income", r.w2Income], ["Rental income", r.rentalIncome], ["Other income", r.otherIncome]]
    : [
        ["Rental income", r.rentalIncome],
        ["Other income", r.otherIncome],
        ["Taxable Social Security", row.ssTaxable],
        ["401(k)/IRA withdrawal", row.taxDeferredDraw],
      ];
  const capGainsSources = isAccum
    ? [["Dividends", r.dividends]]
    : [["Dividends", r.dividends], ["Brokerage withdrawal", row.brokerageDraw]];

  const allocateBySource = (sources, taxAmount) => {
    const base = sources.reduce((sum, [, v]) => sum + v, 0);
    return sources
      .filter(([, v]) => v > 0)
      .map(([label, v]) => [label, base > 0 ? (v / base) * taxAmount : 0]);
  };

  const tax =
    row.tax > 0
      ? breakdownTooltip(
          [...allocateBySource(ordinarySources, row.taxOrdinary), ...allocateBySource(capGainsSources, row.taxCapGains)],
          row.tax
        )
      : "No tax owed this year.";

  const endBalance =
    breakdownTooltip(
      [
        ["Cash", row.bucketsEnd.cash],
        ["Brokerage", row.bucketsEnd.brokerage],
        ["401(k)/IRA", row.bucketsEnd.taxDeferred],
        ["Roth IRA", row.bucketsEnd.roth],
        ["HSA", row.bucketsEnd.hsa],
      ],
      row.endBalance
    ) + (row.endBalance < 0 ? " (shown as $0 — plan has run out of money)" : "");

  const burnRate = isAccum
    ? "No withdrawals during accumulation."
    : `${money(row.withdrawal)} withdrawn / ${money(row.startBalance)} start balance x 100 = ${row.burnRate.toFixed(1)}%`;

  return {
    age,
    balanceStart,
    income,
    continuingIncome,
    contribution,
    livingCost,
    travel,
    debtPayment,
    healthCost,
    ssIncome,
    growth,
    withdrawal,
    tax,
    endBalance,
    burnRate,
  };
}

function renderYearTable(r) {
  const body = document.getElementById("yearTableBody");

  body.innerHTML = r.yearRows
    .map((row) => {
      const rowClasses = [];
      if (row.phase === "retirement" && row.age === r.retireAge + 1) rowClasses.push("retire-marker");
      if (row.endBalance <= 0) rowClasses.push("depleted");
      const t = rowCellTooltips(r, row);

      return `<tr class="${rowClasses.join(" ")}">
        <td data-tooltip="${t.age}">${row.age}</td>
        <td data-tooltip="${t.balanceStart}">${money(row.startBalance)}</td>
        <td data-tooltip="${t.income}">${money(row.income)}</td>
        <td data-tooltip="${t.continuingIncome}">${money(row.continuingIncome)}</td>
        <td data-tooltip="${t.contribution}">${money(row.contribution)}</td>
        <td data-tooltip="${t.livingCost}">${money(row.livingCost)}</td>
        <td data-tooltip="${t.travel}">${money(row.travelCost)}</td>
        <td data-tooltip="${t.debtPayment}">${money(row.debtPayment)}</td>
        <td data-tooltip="${t.healthCost}">${money(row.healthCost)}</td>
        <td data-tooltip="${t.ssIncome}">${money(row.ssIncome)}</td>
        <td data-tooltip="${t.growth}">${money(row.growth)}</td>
        <td data-tooltip="${t.withdrawal}">${money(row.withdrawal)}</td>
        <td data-tooltip="${t.tax}">${money(row.tax)}</td>
        <td data-tooltip="${t.endBalance}">${money(Math.max(0, row.endBalance))}</td>
        <td data-tooltip="${t.burnRate}">${row.burnRate.toFixed(1)}%</td>
      </tr>`;
    })
    .join("");
}

function renderMonthlyTable(r) {
  const body = document.getElementById("monthlyTableBody");

  body.innerHTML = r.yearRows
    .map((row) => {
      const rowClasses = [];
      if (row.phase === "retirement" && row.age === r.retireAge + 1) rowClasses.push("retire-marker");
      if (row.endBalance <= 0) rowClasses.push("depleted");

      const yearlyExpenses = row.livingCost + row.travelCost + row.healthCost + row.debtPayment + row.tax;
      const monthlyExpenses = yearlyExpenses / 12;
      // W2 income stops at retirement; rental/dividends/other income continues.
      const w2Monthly = row.phase === "accumulation" ? (row.income - row.continuingIncome) / 12 : 0;
      const otherIncomeMonthly = row.continuingIncome / 12;
      const ssMonthly = row.ssIncome / 12;
      const withdrawalMonthly = row.withdrawal / 12;
      const monthlyIncome = row.income / 12;

      return `<tr class="${rowClasses.join(" ")}">
        <td>${row.age}</td>
        <td>${money(row.livingCost / 12)}</td>
        <td>${money(row.travelCost / 12)}</td>
        <td>${money(row.healthCost / 12)}</td>
        <td>${money(row.debtPayment / 12)}</td>
        <td>${money(monthlyExpenses)}</td>
        <td>${money(w2Monthly)}</td>
        <td>${money(otherIncomeMonthly)}</td>
        <td>${money(ssMonthly)}</td>
        <td>${money(withdrawalMonthly)}</td>
        <td>${money(monthlyIncome)}</td>
        <td>${money(yearlyExpenses)}</td>
        <td>${money(row.income)}</td>
      </tr>`;
    })
    .join("");
}

function drawChart(r) {
  const ctx = document.getElementById("chart").getContext("2d");
  const clipped = r.balances.map((b) => Math.max(b, 0));

  const retireIndex = r.ages.indexOf(r.retireAge);

  if (chart) chart.destroy();

  chart = new Chart(ctx, {
    type: "line",
    data: {
      labels: r.ages,
      datasets: [
        {
          label: "Projected balance",
          data: clipped,
          borderColor: "#5b8def",
          backgroundColor: "rgba(91, 141, 239, 0.15)",
          fill: true,
          tension: 0.25,
          pointRadius: 0,
          borderWidth: 2.5,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: (items) => `Age ${items[0].label}`,
            label: (item) => `Balance: ${money(item.raw)}`,
          },
        },
        annotation: undefined,
      },
      scales: {
        x: {
          title: { display: true, text: "Age", color: "#9aa4bf" },
          ticks: { color: "#9aa4bf" },
          grid: { color: "rgba(255,255,255,0.05)" },
        },
        y: {
          title: { display: true, text: "Balance ($)", color: "#9aa4bf" },
          ticks: {
            color: "#9aa4bf",
            callback: (v) => "$" + Number(v).toLocaleString(),
          },
          grid: { color: "rgba(255,255,255,0.05)" },
        },
      },
    },
    plugins: [
      {
        id: "retirementLine",
        afterDraw(c) {
          if (retireIndex === -1) return;
          const xScale = c.scales.x;
          const yScale = c.scales.y;
          const x = xScale.getPixelForValue(retireIndex);
          const ctx2 = c.ctx;
          ctx2.save();
          ctx2.strokeStyle = "rgba(255,255,255,0.25)";
          ctx2.setLineDash([4, 4]);
          ctx2.beginPath();
          ctx2.moveTo(x, yScale.top);
          ctx2.lineTo(x, yScale.bottom);
          ctx2.stroke();
          ctx2.setLineDash([]);
          ctx2.fillStyle = "#9aa4bf";
          ctx2.font = "11px sans-serif";
          ctx2.fillText("Retirement", x + 6, yScale.top + 12);
          ctx2.restore();
        },
      },
    ],
  });
}

// --- Income Sources tab: where retirement spending is actually paid from ---
function renderIncomeSources(r) {
  const retirementRows = r.yearRows.filter((row) => row.phase === "retirement");

  const totalSSSelf = retirementRows.reduce((sum, row) => sum + row.ssIncomeSelf, 0);
  const totalSSSpouse = retirementRows.reduce((sum, row) => sum + row.ssIncomeSpouse, 0);
  const totalSS = totalSSSelf + totalSSSpouse;
  const totalOtherIncome = retirementRows.reduce((sum, row) => sum + row.continuingIncome, 0);
  const totalWithdrawal = retirementRows.reduce((sum, row) => sum + row.withdrawal, 0);
  // Total income must include rental/dividends/other income too — it keeps
  // coming in through retirement (unlike W2), same as row.income does.
  const totalIncome = totalSS + totalOtherIncome + totalWithdrawal;
  const guaranteedShare = totalIncome > 0 ? ((totalSS + totalOtherIncome) / totalIncome) * 100 : 0;

  document.getElementById("statTotalSS").textContent = money(totalSS);
  document.getElementById("statTotalOtherIncome").textContent = money(totalOtherIncome);
  document.getElementById("statTotalWithdrawal").textContent = money(totalWithdrawal);
  document.getElementById("statSSShare").textContent = `${guaranteedShare.toFixed(0)}%`;

  drawIncomeChart(r, retirementRows);
  renderWithdrawalSourceTable(retirementRows, { totalSSSelf, totalSSSpouse, totalOtherIncome }, r.isMarried);
}

function renderWithdrawalSourceTable(retirementRows, ssTotals, isMarried) {
  const sum = (key) => retirementRows.reduce((s, row) => s + row[key], 0);

  const rows = [
    ["Social Security (you)", ssTotals.totalSSSelf],
    ...(isMarried ? [["Social Security (spouse)", ssTotals.totalSSSpouse]] : []),
    ["Rental / dividends / other income", ssTotals.totalOtherIncome],
    ["HSA (healthcare costs)", sum("hsaDraw")],
    ["Cash / savings", sum("cashDraw")],
    ["Brokerage (stocks)", sum("brokerageDraw")],
    ["401(k) / Traditional IRA", sum("taxDeferredDraw")],
    ["Roth IRA", sum("rothDraw")],
  ];

  const body = document.getElementById("withdrawalSourceTableBody");
  body.innerHTML = rows
    .map(([label, total]) => `<tr><td>${label}</td><td>${money(total)}</td></tr>`)
    .join("");
}

function drawIncomeChart(r, retirementRows) {
  const ctx = document.getElementById("incomeChart").getContext("2d");
  if (incomeChart) incomeChart.destroy();

  const labels = retirementRows.map((row) => row.age);
  const datasets = [
    {
      label: "Social Security (you)",
      data: retirementRows.map((row) => row.ssIncomeSelf),
      backgroundColor: "#5b8def",
      stack: "income",
    },
  ];

  if (r.isMarried) {
    datasets.push({
      label: "Social Security (spouse)",
      data: retirementRows.map((row) => row.ssIncomeSpouse),
      backgroundColor: "#8b6bf0",
      stack: "income",
    });
  }

  datasets.push(
    {
      label: "Rental/dividends/other",
      data: retirementRows.map((row) => row.continuingIncome),
      backgroundColor: "#2dd4bf",
      stack: "income",
    },
    {
      label: "HSA (healthcare)",
      data: retirementRows.map((row) => row.hsaDraw),
      backgroundColor: "#34d399",
      stack: "income",
    },
    {
      label: "Cash / savings",
      data: retirementRows.map((row) => row.cashDraw),
      backgroundColor: "#f5d76e",
      stack: "income",
    },
    {
      label: "Brokerage (stocks)",
      data: retirementRows.map((row) => row.brokerageDraw),
      backgroundColor: "#f5a35b",
      stack: "income",
    },
    {
      label: "401(k) / Traditional IRA",
      data: retirementRows.map((row) => row.taxDeferredDraw),
      backgroundColor: "#f87171",
      stack: "income",
    },
    {
      label: "Roth IRA",
      data: retirementRows.map((row) => row.rothDraw),
      backgroundColor: "#c084fc",
      stack: "income",
    }
  );

  incomeChart = new Chart(ctx, {
    type: "bar",
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { labels: { color: "#9aa4bf" } },
        tooltip: {
          callbacks: {
            title: (items) => `Age ${items[0].label}`,
            label: (item) => `${item.dataset.label}: ${money(item.raw)}`,
          },
        },
      },
      scales: {
        x: {
          stacked: true,
          title: { display: true, text: "Age", color: "#9aa4bf" },
          ticks: { color: "#9aa4bf" },
          grid: { color: "rgba(255,255,255,0.05)" },
        },
        y: {
          stacked: true,
          title: { display: true, text: "Annual income ($)", color: "#9aa4bf" },
          ticks: {
            color: "#9aa4bf",
            callback: (v) => "$" + Number(v).toLocaleString(),
          },
          grid: { color: "rgba(255,255,255,0.05)" },
        },
      },
    },
  });
}

// If a previous session's inputs were restored from browser storage, show
// the projection right away instead of making the user press Calculate
// again. Doesn't write the auto-save file — that only happens on an actual
// Calculate click.
if (hasSavedInputs) {
  runCalculation();
}
