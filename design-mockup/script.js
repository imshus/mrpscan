const screenSplash = document.getElementById('screenSplash');
const screenLogin = document.getElementById('screenLogin');
const screenSignup = document.getElementById('screenSignup');
const screenGST = document.getElementById('screenGST');
const screenHome = document.getElementById('screenHome');
const dust = document.getElementById('dust');
const reticleLite = document.getElementById('reticleLite');

function spawnDust() {
  dust.innerHTML = '';
  const positions = [
    [30, 68], [70, 62], [22, 40], [78, 45], [50, 78], [40, 30], [60, 82]
  ];
  positions.forEach(([x, y], i) => {
    const m = document.createElement('span');
    m.className = 'mote';
    m.style.left = x + '%';
    m.style.top = y + '%';
    m.style.setProperty('--md', (0.7 + i * 0.32) + 's');
    dust.appendChild(m);
  });
}

let timers = [];
function clearTimers() { timers.forEach(clearTimeout); timers = []; }
function at(ms, fn) { timers.push(setTimeout(fn, ms)); }

function playSplash() {
  clearTimers();

  screenSplash.classList.remove('exit');
  screenSplash.classList.add('active');
  screenLogin.classList.remove('active', 'enter', 'enter-left');
  screenSignup.classList.remove('active', 'enter-right');

  reticleLite.classList.remove('settle');
  void reticleLite.offsetWidth; // restart CSS animations

  spawnDust();

  at(1500, () => reticleLite.classList.add('settle'));

  at(2300, () => screenSplash.classList.add('exit'));
  at(2700, () => {
    screenSplash.classList.remove('active');
    screenLogin.classList.add('active', 'enter');
  });
}

document.getElementById('replayBtn').addEventListener('click', playSplash);

document.getElementById('goSignup').addEventListener('click', (e) => {
  e.preventDefault();
  screenSignup.classList.remove('exit-right');
  screenSignup.classList.add('active', 'enter-right');
  screenLogin.classList.remove('active');
});

document.getElementById('backToLogin').addEventListener('click', () => {
  screenSignup.classList.add('exit-right');
  setTimeout(() => {
    screenSignup.classList.remove('active', 'enter-right', 'exit-right');
    screenLogin.classList.add('active', 'enter-left');
  }, 320);
});

document.getElementById('goLogin').addEventListener('click', (e) => {
  e.preventDefault();
  screenSignup.classList.add('exit-right');
  setTimeout(() => {
    screenSignup.classList.remove('active', 'enter-right', 'exit-right');
    screenLogin.classList.add('active', 'enter-left');
  }, 320);
});

// ---- test login credentials -> home ----
const TEST_USER_ID = 'demo';
const TEST_PASSWORD = 'demo123';
const loginUserId = document.getElementById('loginUserId');
const loginErrorMsg = document.getElementById('loginErrorMsg');
const loginUserIdField = loginUserId.closest('.field');
const loginPasswordField = document.getElementById('loginPassword').closest('.field');

[loginUserId, document.getElementById('loginPassword')].forEach((input) => {
  input.addEventListener('input', () => {
    loginUserIdField.classList.remove('invalid');
    loginPasswordField.classList.remove('invalid');
    loginErrorMsg.classList.remove('show');
  });
});

document.getElementById('loginForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const loginPasswordInput = document.getElementById('loginPassword');
  const ok = loginUserId.value.trim() === TEST_USER_ID && loginPasswordInput.value === TEST_PASSWORD;
  if (!ok) {
    loginUserIdField.classList.add('invalid');
    loginPasswordField.classList.add('invalid');
    loginErrorMsg.classList.add('show');
    const wrap = loginPasswordField.querySelector('.input-wrap');
    wrap.classList.remove('shake');
    void wrap.offsetWidth;
    wrap.classList.add('shake');
    return;
  }
  loginUserIdField.classList.remove('invalid');
  loginPasswordField.classList.remove('invalid');
  loginErrorMsg.classList.remove('show');
  screenLogin.classList.remove('active');
  screenHome.classList.remove('exit-right');
  screenHome.classList.add('active', 'enter-right');
  updateNavForScreen(screenHome);
});

function wireEyeToggle(buttonId, inputId) {
  const btn = document.getElementById(buttonId);
  const input = document.getElementById(inputId);
  btn.addEventListener('click', () => {
    const showing = btn.classList.toggle('showing');
    input.type = showing ? 'text' : 'password';
    btn.setAttribute('aria-label', showing ? 'Hide password' : 'Show password');
  });
}
wireEyeToggle('togglePassword', 'loginPassword');
wireEyeToggle('toggleSignupPassword', 'signupPassword');

// ---- signup form refs + per-field validation ----
const signupName = document.getElementById('signupName');
const signupCompany = document.getElementById('signupCompany');
const phoneInput = document.getElementById('signupPhone');
const signupUserId = document.getElementById('signupUserId');
const signupPassword = document.getElementById('signupPassword');
const signupSubmitBtn = document.getElementById('signupSubmitBtn');

function setInvalid(fieldEl, invalid) {
  fieldEl.classList.toggle('invalid', invalid);
}

function shakeField(fieldEl) {
  const target = fieldEl.querySelector('.input-wrap') || fieldEl;
  target.classList.remove('shake');
  void target.offsetWidth;
  target.classList.add('shake');
}

const fieldChecks = {
  name: () => signupName.value.trim().length > 0,
  company: () => signupCompany.value.trim().length > 0,
  phone: () => phoneInput.value.trim().length > 0,
  userId: () => signupUserId.value.trim().length > 0,
  password: () => signupPassword.value.trim().length >= 6,
};

function wireLiveValidation(input, kind) {
  const fieldEl = input.closest('.field');
  input.addEventListener('blur', () => setInvalid(fieldEl, !fieldChecks[kind]()));
  input.addEventListener('input', () => setInvalid(fieldEl, false));
}
wireLiveValidation(signupName, 'name');
wireLiveValidation(signupCompany, 'company');
wireLiveValidation(phoneInput, 'phone');
wireLiveValidation(signupUserId, 'userId');
wireLiveValidation(signupPassword, 'password');

function validateSignupFields() {
  let firstInvalid = null;
  Object.entries(fieldChecks).forEach(([kind, check]) => {
    const input = { name: signupName, company: signupCompany, phone: phoneInput, userId: signupUserId, password: signupPassword }[kind];
    const fieldEl = input.closest('.field');
    const ok = check();
    setInvalid(fieldEl, !ok);
    if (!ok && !firstInvalid) firstInvalid = fieldEl;
  });
  if (firstInvalid) {
    firstInvalid.scrollIntoView({ behavior: 'smooth', block: 'center' });
    shakeField(firstInvalid);
    return false;
  }
  return true;
}

// ---- reusable OTP controller: 6-digit auto-advance + auto-verify + resend timer ----
// Used for the signup phone OTP, and reused as-is for Forgot User ID / Forgot Password below.
function createOtpController({ collapseId, digitsContainerId, timerTextId, timerValId, resendLinkId, onComplete }) {
  const collapse = document.getElementById(collapseId);
  const digits = [...document.querySelectorAll(`#${digitsContainerId} .otp-digit`)];
  const timerText = document.getElementById(timerTextId);
  const timerVal = document.getElementById(timerValId);
  const resendLink = document.getElementById(resendLinkId);
  let interval = null;

  function clear() {
    digits.forEach((d) => { d.value = ''; d.classList.remove('filled'); });
  }

  function startTimer(seconds) {
    clearInterval(interval);
    resendLink.classList.remove('active');
    timerText.style.display = '';
    let remaining = seconds;
    const render = () => {
      const m = Math.floor(remaining / 60);
      const s = String(remaining % 60).padStart(2, '0');
      timerVal.textContent = `${m}:${s}`;
    };
    render();
    interval = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        clearInterval(interval);
        timerText.style.display = 'none';
        resendLink.classList.add('active');
        return;
      }
      render();
    }, 1000);
  }

  function maybeAutoVerify() {
    const code = digits.map((d) => d.value).join('');
    if (code.length < 6) return;
    clearInterval(interval);
    digits.forEach((d) => d.setAttribute('disabled', 'true'));
    setTimeout(onComplete, 450);
  }

  digits.forEach((digit, i) => {
    digit.addEventListener('input', () => {
      digit.value = digit.value.replace(/[^0-9]/g, '').slice(0, 1);
      digit.classList.toggle('filled', digit.value !== '');
      if (digit.value && digits[i + 1]) digits[i + 1].focus();
      maybeAutoVerify();
    });
    digit.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !digit.value && digits[i - 1]) digits[i - 1].focus();
    });
    digit.addEventListener('paste', (e) => {
      const text = (e.clipboardData || window.clipboardData).getData('text').replace(/[^0-9]/g, '');
      if (!text) return;
      e.preventDefault();
      text.slice(0, 6).split('').forEach((ch, j) => {
        if (digits[j]) { digits[j].value = ch; digits[j].classList.add('filled'); }
      });
      const next = digits[Math.min(text.length, 5)];
      if (next) next.focus();
      maybeAutoVerify();
    });
  });

  resendLink.addEventListener('click', (e) => {
    e.preventDefault();
    clear();
    digits[0].focus();
    startTimer(30);
  });

  function send() {
    collapse.classList.add('open');
    clear();
    digits.forEach((d) => d.removeAttribute('disabled'));
    startTimer(30);
  }

  function reset() {
    clearInterval(interval);
    collapse.classList.remove('open');
    clear();
    digits.forEach((d) => d.removeAttribute('disabled'));
  }

  return { digits, send, reset };
}

const otpCollapse = document.getElementById('otpCollapse');
const otpBox = document.getElementById('otpBox');
const signupOtp = createOtpController({
  collapseId: 'otpCollapse',
  digitsContainerId: 'otpDigits',
  timerTextId: 'otpTimerText',
  timerValId: 'otpTimerVal',
  resendLinkId: 'resendOtpLink',
  onComplete: () => {
    screenSignup.classList.remove('active');
    screenGST.classList.remove('exit-right');
    screenGST.classList.add('active', 'enter-right');
  },
});

// ---- Submit: validate -> auto-send OTP -> OTP auto-verifies -> GST screen ----
document.getElementById('signupForm').addEventListener('submit', (e) => {
  e.preventDefault();
  if (!validateSignupFields()) return;

  signupSubmitBtn.disabled = true;
  signupSubmitBtn.textContent = 'Sending OTP…';
  signupOtp.send();
  setTimeout(() => {
    signupOtp.digits[0].focus();
    otpBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, 380);
});

function resetSignupForm() {
  signupOtp.reset();
  signupSubmitBtn.disabled = false;
  signupSubmitBtn.textContent = 'Submit';
}

document.getElementById('backToSignup').addEventListener('click', () => {
  resetSignupForm();
  screenGST.classList.add('exit-right');
  setTimeout(() => {
    screenGST.classList.remove('active', 'enter-right', 'exit-right');
    screenSignup.classList.add('active', 'enter-left');
  }, 320);
});

const gstInput = document.getElementById('gstInput');
const verifyGstBtn = document.getElementById('verifyGstBtn');
const gstCollapse = document.getElementById('gstCollapse');
const gstResultCard = document.getElementById('gstResultCard');
const gstBizName = document.getElementById('gstBizName');
const gstAddress = document.getElementById('gstAddress');
const successToast = document.getElementById('successToast');

verifyGstBtn.addEventListener('click', () => {
  if (!gstInput.value.trim()) { gstInput.focus(); return; }
  gstInput.readOnly = true;
  verifyGstBtn.disabled = true;
  verifyGstBtn.textContent = 'Verifying…';

  setTimeout(() => {
    // mock API response
    gstBizName.textContent = 'Gupta Jewellers Pvt. Ltd.';
    gstAddress.textContent = 'MG Road, Jaipur, Rajasthan';
    verifyGstBtn.textContent = 'Verified';
    gstCollapse.classList.add('open');

    setTimeout(() => gstResultCard.scrollIntoView({ behavior: 'smooth', block: 'center' }), 420);
    setTimeout(() => {
      successToast.classList.add('show');
      successToast.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 700);
    setTimeout(() => {
      screenGST.classList.remove('active');
      screenHome.classList.remove('exit-right');
      screenHome.classList.add('active', 'enter-right');
      updateNavForScreen(screenHome);
    }, 2700);
  }, 900);
});

// ---- Forgot User ID ----
const screenForgotId = document.getElementById('screenForgotId');
const forgotIdPhone = document.getElementById('forgotIdPhone');
const forgotIdPhoneField = forgotIdPhone.closest('.field');
const sendCodeForgotId = document.getElementById('sendCodeForgotId');
const forgotIdResultCollapse = document.getElementById('forgotIdResultCollapse');

const forgotIdOtp = createOtpController({
  collapseId: 'otpCollapseForgotId',
  digitsContainerId: 'otpDigitsForgotId',
  timerTextId: 'otpTimerTextForgotId',
  timerValId: 'otpTimerValForgotId',
  resendLinkId: 'resendOtpForgotId',
  onComplete: () => {
    forgotIdResultCollapse.classList.add('open');
    setTimeout(() => forgotIdResultCollapse.scrollIntoView({ behavior: 'smooth', block: 'center' }), 200);
  },
});

sendCodeForgotId.addEventListener('click', () => {
  if (!forgotIdPhone.value.trim()) {
    setInvalid(forgotIdPhoneField, true);
    shakeField(forgotIdPhoneField);
    forgotIdPhone.focus();
    return;
  }
  setInvalid(forgotIdPhoneField, false);
  forgotIdPhone.readOnly = true;
  sendCodeForgotId.disabled = true;
  sendCodeForgotId.textContent = 'Sent';
  forgotIdOtp.send();
  setTimeout(() => {
    forgotIdOtp.digits[0].focus();
    document.getElementById('otpBoxForgotId').scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, 380);
});
forgotIdPhone.addEventListener('input', () => setInvalid(forgotIdPhoneField, false));

function resetForgotIdScreen() {
  forgotIdOtp.reset();
  forgotIdResultCollapse.classList.remove('open');
  forgotIdPhone.value = '';
  forgotIdPhone.readOnly = false;
  sendCodeForgotId.disabled = false;
  sendCodeForgotId.textContent = 'Send code';
  setInvalid(forgotIdPhoneField, false);
}

document.getElementById('goForgotId').addEventListener('click', (e) => {
  e.preventDefault();
  resetForgotIdScreen();
  screenLogin.classList.remove('active');
  screenForgotId.classList.remove('exit-right');
  screenForgotId.classList.add('active', 'enter-right');
});

function backToLoginFrom(screenEl) {
  screenEl.classList.add('exit-right');
  setTimeout(() => {
    screenEl.classList.remove('active', 'enter-right', 'exit-right');
    screenLogin.classList.add('active', 'enter-left');
  }, 320);
}

document.getElementById('backFromForgotId').addEventListener('click', () => backToLoginFrom(screenForgotId));
document.getElementById('forgotIdDoneBtn').addEventListener('click', () => backToLoginFrom(screenForgotId));

// ---- Forgot Password ----
const screenForgotPassword = document.getElementById('screenForgotPassword');
const forgotPwUserId = document.getElementById('forgotPwUserId');
const forgotPwUserIdField = forgotPwUserId.closest('.field');
const sendCodeForgotPw = document.getElementById('sendCodeForgotPw');
const newPasswordCollapse = document.getElementById('newPasswordCollapse');
const newPassword1 = document.getElementById('newPassword1');
const newPassword2 = document.getElementById('newPassword2');
const resetSuccessToast = document.getElementById('resetSuccessToast');

wireEyeToggle('toggleNewPassword1', 'newPassword1');
wireEyeToggle('toggleNewPassword2', 'newPassword2');

const forgotPwOtp = createOtpController({
  collapseId: 'otpCollapseForgotPw',
  digitsContainerId: 'otpDigitsForgotPw',
  timerTextId: 'otpTimerTextForgotPw',
  timerValId: 'otpTimerValForgotPw',
  resendLinkId: 'resendOtpForgotPw',
  onComplete: () => {
    newPasswordCollapse.classList.add('open');
    setTimeout(() => {
      newPassword1.focus();
      newPasswordCollapse.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 200);
  },
});

sendCodeForgotPw.addEventListener('click', () => {
  if (!forgotPwUserId.value.trim()) {
    setInvalid(forgotPwUserIdField, true);
    shakeField(forgotPwUserIdField);
    forgotPwUserId.focus();
    return;
  }
  setInvalid(forgotPwUserIdField, false);
  forgotPwUserId.readOnly = true;
  sendCodeForgotPw.disabled = true;
  sendCodeForgotPw.textContent = 'Sent';
  forgotPwOtp.send();
  setTimeout(() => {
    forgotPwOtp.digits[0].focus();
    document.getElementById('otpBoxForgotPw').scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, 380);
});
forgotPwUserId.addEventListener('input', () => setInvalid(forgotPwUserIdField, false));

[newPassword1, newPassword2].forEach((input) => {
  input.addEventListener('input', () => setInvalid(input.closest('.field'), false));
});

document.getElementById('resetPasswordBtn').addEventListener('click', () => {
  const pw1Field = newPassword1.closest('.field');
  const pw2Field = newPassword2.closest('.field');
  const pw1Valid = newPassword1.value.trim().length >= 6;
  const pw2Valid = pw1Valid && newPassword2.value === newPassword1.value;

  setInvalid(pw1Field, !pw1Valid);
  setInvalid(pw2Field, !pw2Valid);

  if (!pw1Valid) { pw1Field.scrollIntoView({ behavior: 'smooth', block: 'center' }); shakeField(pw1Field); return; }
  if (!pw2Valid) { pw2Field.scrollIntoView({ behavior: 'smooth', block: 'center' }); shakeField(pw2Field); return; }

  resetSuccessToast.classList.add('show');
  setTimeout(() => backToLoginFrom(screenForgotPassword), 1600);
});

function resetForgotPasswordScreen() {
  forgotPwOtp.reset();
  newPasswordCollapse.classList.remove('open');
  resetSuccessToast.classList.remove('show');
  forgotPwUserId.value = '';
  forgotPwUserId.readOnly = false;
  sendCodeForgotPw.disabled = false;
  sendCodeForgotPw.textContent = 'Send code';
  newPassword1.value = '';
  newPassword2.value = '';
  setInvalid(forgotPwUserIdField, false);
  setInvalid(newPassword1.closest('.field'), false);
  setInvalid(newPassword2.closest('.field'), false);
}

document.getElementById('goForgotPw').addEventListener('click', (e) => {
  e.preventDefault();
  resetForgotPasswordScreen();
  screenLogin.classList.remove('active');
  screenForgotPassword.classList.remove('exit-right');
  screenForgotPassword.classList.add('active', 'enter-right');
});

document.getElementById('backFromForgotPw').addEventListener('click', () => backToLoginFrom(screenForgotPassword));

// ---- Dashboard <-> Scanner flow (Home -> Capture -> Processing -> Review -> Final) ----
const screenSettings = document.getElementById('screenSettings');
const screenDashSettings = document.getElementById('screenDashSettings');
const screenMasters = document.getElementById('screenMasters');
const screenMasterRates = document.getElementById('screenMasterRates');
const screenBizProfile = document.getElementById('screenBizProfile');
const screenWishlist = document.getElementById('screenWishlist');
const screenEmpList = document.getElementById('screenEmpList');
const screenEmpAdd = document.getElementById('screenEmpAdd');
const screenEmpPermissions = document.getElementById('screenEmpPermissions');
const screenEmpPassword = document.getElementById('screenEmpPassword');
const screenEmpDetail = document.getElementById('screenEmpDetail');
const screenScanCapture = document.getElementById('screenScanCapture');
const screenScanProcessing = document.getElementById('screenScanProcessing');
const screenScanReview = document.getElementById('screenScanReview');
const screenScanFinal = document.getElementById('screenScanFinal');

function goForward(fromScreen, toScreen) {
  fromScreen.classList.remove('active');
  toScreen.classList.remove('exit-right');
  toScreen.classList.add('active', 'enter-right');
}
function goBackward(fromScreen, toScreen) {
  fromScreen.classList.add('exit-right');
  setTimeout(() => {
    fromScreen.classList.remove('active', 'enter-right', 'exit-right');
    toScreen.classList.add('active', 'enter-left');
  }, 320);
}

// -- Capture screen state --
const capInstruction = document.getElementById('capInstruction');
const capPreviewOverlay = document.getElementById('capPreviewOverlay');
const capAddMoreBtn = document.getElementById('capAddMoreBtn');
let captureStep = 'first'; // 'first' | 'second'
let hasFrontCapture = false;

function resetCaptureScreen() {
  captureStep = 'first';
  hasFrontCapture = false;
  capInstruction.textContent = 'Align jewellery tag inside frame';
  capPreviewOverlay.classList.remove('show');
}

document.getElementById('capBackBtn').addEventListener('click', () => goBackward(screenScanCapture, screenHome));

document.getElementById('capShutterBtn').addEventListener('click', () => {
  capPreviewOverlay.classList.add('show');
});
document.getElementById('capUploadBtn').addEventListener('click', () => {
  capPreviewOverlay.classList.add('show');
});

document.getElementById('capDeleteBtn').addEventListener('click', () => {
  capPreviewOverlay.classList.remove('show');
});
document.getElementById('capAddMoreBtn').addEventListener('click', () => {
  hasFrontCapture = true;
  captureStep = 'second';
  capInstruction.textContent = 'Align back side of tag inside frame';
  capPreviewOverlay.classList.remove('show');
});
document.getElementById('capCalcBtn').addEventListener('click', () => {
  capPreviewOverlay.classList.remove('show');
  startProcessing();
});

// -- Processing screen: animated progress through real stages --
const procPercent = document.getElementById('procPercent');
const procStage = document.getElementById('procStage');
const PROC_STAGES = [
  { upTo: 28, label: 'Uploading Tags...' },
  { upTo: 82, label: 'Processing Tag Details...' },
  { upTo: 100, label: 'Loading Scanned Results...' },
];
let procInterval = null;

function startProcessing() {
  goForward(screenScanCapture, screenScanProcessing);
  let value = 0;
  procPercent.textContent = '0%';
  procStage.textContent = PROC_STAGES[0].label;
  clearInterval(procInterval);
  procInterval = setInterval(() => {
    value += Math.random() < 0.3 ? 2 : 1;
    if (value > 100) value = 100;
    procPercent.textContent = value + '%';
    const stage = PROC_STAGES.find((s) => value <= s.upTo) || PROC_STAGES[PROC_STAGES.length - 1];
    procStage.textContent = stage.label;
    if (value >= 100) {
      clearInterval(procInterval);
      setTimeout(() => goForward(screenScanProcessing, screenScanReview), 400);
    }
  }, 45);
}

// -- Review screen --
document.getElementById('revBackBtn').addEventListener('click', () => goBackward(screenScanReview, screenHome));
document.getElementById('revRescanBtn').addEventListener('click', () => {
  resetCaptureScreen();
  goBackward(screenScanReview, screenScanCapture);
});
document.getElementById('revContinueBtn').addEventListener('click', () => goForward(screenScanReview, screenScanFinal));

function wireWishlistToggle(id) {
  document.getElementById(id).addEventListener('click', function () {
    this.textContent = '✓ Added to Wishlist';
    this.disabled = true;
  });
}
wireWishlistToggle('revWishlistBtn');
wireWishlistToggle('finWishlistBtn');

// -- "+ Add Other Charges" tile: reveal an amount row on click --
const chargesTile = document.getElementById('chargesTile');
const addChargeBtn = document.getElementById('addChargeBtn');
addChargeBtn.addEventListener('click', () => {
  if (chargesTile.querySelector('.charge-row')) return;
  const row = document.createElement('div');
  row.className = 'charge-row';
  row.innerHTML = '<div class="input-icon"><span>₹</span><input placeholder="Amount" value=""></div>';
  chargesTile.appendChild(row);
  addChargeBtn.textContent = '+ Add Another';
  row.querySelector('input').focus();
});

// -- Final result screen --
document.getElementById('finBackBtn').addEventListener('click', () => goBackward(screenScanFinal, screenScanReview));
document.getElementById('finInvoiceBtn').addEventListener('click', function () {
  this.textContent = 'Invoice Generated ✓';
  setTimeout(() => {
    this.textContent = 'Generate Invoice';
    goBackward(screenScanFinal, screenHome);
  }, 900);
});

// -- Live date / day / time on the home trial tile --
const dashDayEl = document.getElementById('dashDay');
const dashDateEl = document.getElementById('dashDate');
const dashMonthEl = document.getElementById('dashMonth');
const dashTimeEl = document.getElementById('dashTime');
function renderDashClock() {
  const now = new Date();
  if (dashDayEl) dashDayEl.textContent = now.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
  if (dashDateEl) dashDateEl.textContent = String(now.getDate());
  if (dashMonthEl) dashMonthEl.textContent = now.toLocaleDateString('en-US', { month: 'short' });
  if (dashTimeEl) dashTimeEl.textContent = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}
renderDashClock();
setInterval(renderDashClock, 30000);

// -- Floating bottom nav: global element, shown on Home / Review / Final only --
const floatingNav = document.getElementById('floatingNav');
const navHomeBtn = document.getElementById('navHomeBtn');
const navScanBtn = document.getElementById('navScanBtn');
const NAV_VISIBLE_SCREENS = [screenHome, screenScanReview, screenScanFinal, screenSettings, screenDashSettings, screenMasters, screenMasterRates, screenBizProfile, screenWishlist, screenEmpList, screenEmpAdd, screenEmpPermissions, screenEmpPassword, screenEmpDetail];
let currentScreen = screenSplash;

function updateNavForScreen(screen) {
  currentScreen = screen;
  const visible = NAV_VISIBLE_SCREENS.includes(screen);
  floatingNav.classList.toggle('show', visible);
  navHomeBtn.classList.toggle('active', screen === screenHome);
  navScanBtn.classList.toggle('active', screen === screenScanCapture);
}

const _goForward = goForward;
goForward = function (fromScreen, toScreen) {
  _goForward(fromScreen, toScreen);
  updateNavForScreen(toScreen);
};
const _goBackward = goBackward;
goBackward = function (fromScreen, toScreen) {
  _goBackward(fromScreen, toScreen);
  setTimeout(() => updateNavForScreen(toScreen), 330);
};

navHomeBtn.addEventListener('click', () => {
  if (currentScreen === screenHome) return;
  goBackward(currentScreen, screenHome);
});
navScanBtn.addEventListener('click', () => {
  if (currentScreen === screenScanCapture) return;
  resetCaptureScreen();
  goForward(currentScreen, screenScanCapture);
});

// -- Settings / menu screen (hamburger on Home) --
document.getElementById('dashMenuBtn').addEventListener('click', () => {
  goForward(screenHome, screenSettings);
});
document.getElementById('setBackBtn').addEventListener('click', () => {
  goBackward(screenSettings, screenHome);
});
document.getElementById('setLogoutBtn').addEventListener('click', () => {
  goBackward(screenSettings, screenLogin);
});
document.getElementById('setMenuDashboard').addEventListener('click', () => {
  goForward(screenSettings, screenDashSettings);
});
document.getElementById('dashSetBackBtn').addEventListener('click', () => {
  goBackward(screenDashSettings, screenSettings);
});

// -- Bhaw rate: LIVE from the real gold-rate-tracker API -> Home dashboard tile --
// *** This is the exact contract to hand to the backend dev for the real APK: ***
//   GET https://17gdivfex7.execute-api.ap-south-1.amazonaws.com/bhaw
//   -> { source, name, cash_bhaw, rtgs_bhaw, updated_at }   (whichever source is currently active)
// The admin dashboard (https://d2r9p5yl881cyw.cloudfront.net) additionally exposes, on the API root:
//   GET  {ROOT}         -> [{ source, name, selected, ... }]   (full list, for the admin picker)
//   PUT  {ROOT}select   -> { source }                          (admin sets which source is active)
// Dashboard Settings' JMD/Mega Bullion picker below calls those admin endpoints purely so this
// mockup can demo switching sources — MRPscan itself only ever needs the one read-only GET /bhaw.
const BHAW_ROOT_URL = 'https://17gdivfex7.execute-api.ap-south-1.amazonaws.com/';
const BHAW_URL = BHAW_ROOT_URL + 'bhaw';
let bhawPollTimer = null;

function formatBhaw(n) {
  if (n === null || n === undefined || n === '' || Number.isNaN(Number(n))) return '—';
  const num = Number(n);
  return (num < 0 ? '−' : '+') + Math.abs(num).toLocaleString('en-IN');
}

function renderBhaw(data) {
  document.getElementById('dashBhawSourceName').textContent = data.name;
  document.getElementById('dashBhawCash').textContent = formatBhaw(data.cash_bhaw);
  document.getElementById('dashBhawRtgs').textContent = formatBhaw(data.rtgs_bhaw);
  document.getElementById('dashBhawCard').classList.add('show');
}

async function fetchBhaw() {
  const res = await fetch(BHAW_URL);
  if (!res.ok) throw new Error('Bhaw API returned ' + res.status);
  return res.json();
}

function startBhawPolling() {
  if (bhawPollTimer) return;
  bhawPollTimer = setInterval(async () => {
    try {
      renderBhaw(await fetchBhaw());
    } catch (e) {
      console.error('Bhaw live refresh failed', e);
    }
  }, 30000);
}

// Reflect the admin dashboard's real current selection on the two radios whenever Dashboard Settings opens.
async function syncBhawSourceCheckboxes() {
  try {
    const res = await fetch(BHAW_ROOT_URL);
    const sources = await res.json();
    sources.forEach((s) => {
      const input = { jmd_patil: bhawSourceJmd, mega_bullion: bhawSourceMega }[s.source];
      if (input) input.checked = !!s.selected;
    });
  } catch (e) {
    console.error('Could not load live Bhaw sources', e);
  }
}

// Only reveal the Home Bhaw tile once the user actually taps a source here —
// 'click' (not 'change') so re-clicking the already-selected option still reveals it.
async function selectBhawSource(sourceKey) {
  try {
    await fetch(BHAW_ROOT_URL + 'select', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: sourceKey }),
    });
    renderBhaw(await fetchBhaw());
    startBhawPolling();
  } catch (e) {
    console.error('Bhaw source selection failed', e);
  }
}

const bhawSourceJmd = document.getElementById('bhawSourceJmd');
const bhawSourceMega = document.getElementById('bhawSourceMega');
bhawSourceJmd.addEventListener('click', () => selectBhawSource('jmd_patil'));
bhawSourceMega.addEventListener('click', () => selectBhawSource('mega_bullion'));
document.getElementById('setMenuDashboard').addEventListener('click', syncBhawSourceCheckboxes);
document.getElementById('setMenuMasters').addEventListener('click', () => {
  goForward(screenSettings, screenMasters);
});
document.getElementById('mstBackBtn').addEventListener('click', () => {
  goBackward(screenMasters, screenSettings);
});
document.getElementById('mstRatesRow').addEventListener('click', () => {
  goForward(screenMasters, screenMasterRates);
});
document.getElementById('mstRatesBackBtn').addEventListener('click', () => {
  goBackward(screenMasterRates, screenMasters);
});

// -- Employee Manager (list -> add -> permissions -> create-password, plus detail edit shortcuts) --
let empMode = 'add'; // 'add' | 'edit' — edit mode always returns straight to the Detail screen

document.getElementById('setMenuEmployees').addEventListener('click', () => {
  goForward(screenSettings, screenEmpList);
});
document.getElementById('empListBackBtn').addEventListener('click', () => {
  goBackward(screenEmpList, screenSettings);
});
document.querySelectorAll('.emp-card').forEach((card) => {
  card.addEventListener('click', () => goForward(screenEmpList, screenEmpDetail));
});

document.getElementById('empAddFab').addEventListener('click', () => {
  empMode = 'add';
  document.getElementById('empAddTitle').textContent = 'Add New Employee';
  goForward(screenEmpList, screenEmpAdd);
});
document.getElementById('empAddBackBtn').addEventListener('click', () => {
  goBackward(screenEmpAdd, empMode === 'edit' ? screenEmpDetail : screenEmpList);
});
document.getElementById('empAddContinueBtn').addEventListener('click', () => {
  if (empMode === 'edit') {
    goBackward(screenEmpAdd, screenEmpDetail);
  } else {
    goForward(screenEmpAdd, screenEmpPermissions);
  }
});

document.getElementById('empPermBackBtn').addEventListener('click', () => {
  goBackward(screenEmpPermissions, empMode === 'edit' ? screenEmpDetail : screenEmpAdd);
});
document.getElementById('empPermContinueBtn').addEventListener('click', () => {
  if (empMode === 'edit') {
    goBackward(screenEmpPermissions, screenEmpDetail);
  } else {
    document.getElementById('empPasswordTitle').textContent = 'Create Password';
    document.getElementById('empPasswordSubmitBtn').textContent = 'Add Employee';
    goForward(screenEmpPermissions, screenEmpPassword);
  }
});

document.getElementById('empPasswordBackBtn').addEventListener('click', () => {
  goBackward(screenEmpPassword, empMode === 'edit' ? screenEmpDetail : screenEmpPermissions);
});
document.getElementById('empPasswordSubmitBtn').addEventListener('click', () => {
  goBackward(screenEmpPassword, empMode === 'edit' ? screenEmpDetail : screenEmpList);
});
wireEyeToggle('toggleEmpPassword1', 'empPassword1');
wireEyeToggle('toggleEmpPassword2', 'empPassword2');

document.getElementById('empDetailBackBtn').addEventListener('click', () => {
  goBackward(screenEmpDetail, screenEmpList);
});
document.getElementById('empEditBtn').addEventListener('click', () => {
  empMode = 'edit';
  document.getElementById('empAddTitle').textContent = 'Edit Employee';
  goForward(screenEmpDetail, screenEmpAdd);
});
document.getElementById('empPasswordEditBtn').addEventListener('click', () => {
  empMode = 'edit';
  document.getElementById('empPasswordTitle').textContent = 'Update Password';
  document.getElementById('empPasswordSubmitBtn').textContent = 'Update Password';
  goForward(screenEmpDetail, screenEmpPassword);
});
document.getElementById('empPermEditBtn').addEventListener('click', () => {
  empMode = 'edit';
  goForward(screenEmpDetail, screenEmpPermissions);
});
document.getElementById('empDeleteBtn').addEventListener('click', () => {
  if (confirm('Are you sure you want to delete this employee? This will permanently remove their details.')) {
    goBackward(screenEmpDetail, screenEmpList);
  }
});
document.getElementById('empStatusToggle').addEventListener('change', function () {
  const title = document.getElementById('empStatusTitle');
  const sub = document.getElementById('empStatusSub');
  if (this.checked) {
    title.textContent = 'Active Account';
    sub.textContent = 'Employee can log in and use the app.';
  } else {
    title.textContent = 'Account Revoked';
    sub.textContent = 'Employee cannot log in until reactivated.';
  }
});

// -- Business Profile (from Settings screen's profile banner) --
document.getElementById('setProfileBanner').addEventListener('click', () => {
  goForward(screenSettings, screenBizProfile);
});
document.getElementById('bizProfileBackBtn').addEventListener('click', () => {
  goBackward(screenBizProfile, screenSettings);
});

// -- Wishlist (from Home's Wishlist button) --
document.getElementById('dashWishlistBtn').addEventListener('click', () => {
  goForward(currentScreen, screenWishlist);
});
document.getElementById('wishlistCloseBtn').addEventListener('click', () => {
  goBackward(screenWishlist, screenHome);
});

const wishlistList = document.getElementById('wishlistList');
const wishlistEmpty = document.getElementById('wishlistEmpty');

function checkWishlistEmpty() {
  wishlistEmpty.classList.toggle('show', wishlistList.querySelectorAll('.wl-card').length === 0);
}

wishlistList.querySelectorAll('.wl-card').forEach((card) => {
  card.addEventListener('click', () => goForward(screenWishlist, screenScanFinal));
  card.querySelector('.wl-delete-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to remove this item from your wishlist?')) {
      card.remove();
      checkWishlistEmpty();
    }
  });
});

document.getElementById('wishlistClearLink').addEventListener('click', (e) => {
  e.preventDefault();
  if (!wishlistList.querySelector('.wl-card')) return;
  if (confirm('Are you sure you want to remove all items from your wishlist?')) {
    wishlistList.innerHTML = '';
    checkWishlistEmpty();
  }
});

window.addEventListener('load', playSplash);
