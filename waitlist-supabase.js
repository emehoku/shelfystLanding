import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.4/+esm';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from './supabase-config.js';

const TABLE = 'early_access_users';
const VISITS_TABLE = 'website_visits';
const SOURCE_LANDING = 'landing_page';
const MIN_SUBMIT_MS = 750;
let supabaseClient = null;

function getSupabaseClient() {
  if (
    !SUPABASE_URL ||
    !SUPABASE_ANON_KEY ||
    SUPABASE_ANON_KEY.includes('YOUR_ANON')
  ) {
    return null;
  }

  if (!supabaseClient) {
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
  }

  return supabaseClient;
}

function createSessionId() {
  if (window.crypto && typeof window.crypto.randomUUID === 'function') {
    return window.crypto.randomUUID();
  }

  return (
    Date.now().toString(36) +
    '-' +
    Math.random().toString(36).slice(2, 12)
  );
}

async function trackWebsiteVisit() {
  if (window.location.protocol === 'file:') return;

  const supabase = getSupabaseClient();
  if (!supabase) return;

  const visitorKey = 'shelfyst_visitor_id';
  const trackedDateKey = 'shelfyst_visit_tracked_date';
  const todayKey = new Date().toISOString().slice(0, 10);
  let sessionId = '';
  let canRetryInStorage = false;

  try {
    sessionId = window.localStorage.getItem(visitorKey) || '';
    if (!sessionId) {
      sessionId = createSessionId();
      window.localStorage.setItem(visitorKey, sessionId);
    }

    if (window.localStorage.getItem(trackedDateKey) === todayKey) return;
    window.localStorage.setItem(trackedDateKey, todayKey);
    canRetryInStorage = true;
  } catch (_) {
    sessionId = createSessionId();
  }

  try {
    const result = await supabase.from(VISITS_TABLE).insert({
      session_id: sessionId,
      path: window.location.pathname + window.location.search,
      referrer: document.referrer || null,
      user_agent: navigator.userAgent || null,
      source: SOURCE_LANDING,
    });

    if (result && result.error) {
      if (canRetryInStorage) {
        try {
          window.localStorage.removeItem(trackedDateKey);
        } catch (_) {}
      }
      console.warn('Shelfyst visit tracking failed:', result.error.message);
    }
  } catch (err) {
    if (canRetryInStorage) {
      try {
        window.localStorage.removeItem(trackedDateKey);
      } catch (_) {}
    }
    console.warn('Shelfyst visit tracking failed:', err);
  }
}

function isValidEmail(value) {
  if (!value) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

const COMMON_EMAIL_DOMAINS = [
  'gmail.com',
  'googlemail.com',
  'hotmail.com',
  'outlook.com',
  'live.com',
  'msn.com',
  'yahoo.com',
  'ymail.com',
  'icloud.com',
  'me.com',
  'mac.com',
  'aol.com',
  'proton.me',
  'protonmail.com',
];

const EMAIL_DOMAIN_SUGGESTIONS = {
  'gamil.com': 'gmail.com',
  'gmail.co': 'gmail.com',
  'gmail.con': 'gmail.com',
  'gmial.com': 'gmail.com',
  'gnail.com': 'gmail.com',
  'hotmai.com': 'hotmail.com',
  'hotmial.com': 'hotmail.com',
  'hotmasil.co': 'hotmail.com',
  'hotmal.com': 'hotmail.com',
  'hotmail.co': 'hotmail.com',
  'outlok.com': 'outlook.com',
  'outlook.co': 'outlook.com',
  'yaho.com': 'yahoo.com',
  'yahoo.co': 'yahoo.com',
  'icloud.co': 'icloud.com',
};

function levenshteinDistance(a, b) {
  const rows = Array.from({ length: a.length + 1 }, function (_, i) {
    return [i];
  });
  for (let j = 1; j <= b.length; j += 1) rows[0][j] = j;

  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      rows[i][j] = Math.min(
        rows[i - 1][j] + 1,
        rows[i][j - 1] + 1,
        rows[i - 1][j - 1] + cost
      );
    }
  }

  return rows[a.length][b.length];
}

function emailDomainSuggestion(email) {
  const parts = String(email || '').toLowerCase().split('@');
  if (parts.length !== 2) return '';

  const domain = parts[1];
  if (COMMON_EMAIL_DOMAINS.includes(domain)) return '';
  if (EMAIL_DOMAIN_SUGGESTIONS[domain]) return EMAIL_DOMAIN_SUGGESTIONS[domain];

  let bestDomain = '';
  let bestDistance = Infinity;
  COMMON_EMAIL_DOMAINS.forEach(function (commonDomain) {
    const distance = levenshteinDistance(domain, commonDomain);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestDomain = commonDomain;
    }
  });

  return bestDistance <= 2 ? bestDomain : '';
}

function emailQualityError(email) {
  const suggestion = emailDomainSuggestion(email);
  if (!suggestion) return '';

  const localPart = String(email || '').split('@')[0] || 'you';
  return 'Please check your email address. Did you mean ' + localPart + '@' + suggestion + '?';
}

function friendlyError(error) {
  if (!error) return 'Something went wrong. Please try again.';
  const code = error.code || '';
  const msg = String(error.message || '').toLowerCase();

  if (code === '23505' || msg.includes('duplicate') || msg.includes('unique')) {
    return 'You’re already registered with this email — no need to sign up again.';
  }
  if (msg.includes('network') || msg.includes('fetch')) {
    return 'Network error. Check your connection and try again.';
  }
  return error.message || 'Something went wrong. Please try again.';
}

function getSharePageUrl() {
  var loc = window.location;
  return loc.origin + loc.pathname + loc.search;
}

function getShareBody(pageUrl) {
  return (
    "I’m on Shelfyst’s founding-collector early access list — the social home for premium collectibles. Join me: " +
    pageUrl
  );
}

function initWaitlistSupabase() {
  const waitlistForm = document.getElementById('waitlistForm');
  const waitlistSuccess = document.getElementById('waitlistSuccess');
  const shareWrap = document.getElementById('waitlistShareWrap');
  const shareWhatsApp = document.getElementById('waitlistShareWhatsApp');
  const shareFacebook = document.getElementById('waitlistShareFacebook');
  const shareMessenger = document.getElementById('waitlistShareMessenger');
  const copyLinkBtn = document.getElementById('waitlistCopyLink');
  if (!waitlistForm) return;

  function hideShareWrap() {
    if (!shareWrap) return;
    shareWrap.hidden = true;
  }

  function showShareWrap() {
    if (!shareWrap) return;
    refreshShareTargets();
    shareWrap.hidden = false;
  }

  function refreshShareTargets() {
    var pageUrl = getSharePageUrl();
    var body = getShareBody(pageUrl);
    if (shareWhatsApp) {
      shareWhatsApp.href =
        'https://api.whatsapp.com/send?text=' + encodeURIComponent(body);
    }
    if (shareFacebook) {
      shareFacebook.href =
        'https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(pageUrl);
    }
  }

  if (shareMessenger) {
    shareMessenger.addEventListener('click', function (e) {
      e.preventDefault();
      var pageUrl = getSharePageUrl();
      var ua = navigator.userAgent || '';
      var looksMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
      if (looksMobile) {
        window.location.href =
          'fb-messenger://share/?link=' + encodeURIComponent(pageUrl);
      } else {
        window.open(
          'https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(pageUrl),
          '_blank',
          'noopener,noreferrer'
        );
      }
    });
  }

  if (copyLinkBtn) {
    var copyDefaultHtml = copyLinkBtn.innerHTML;
    var copyDefaultLabel = copyLinkBtn.getAttribute('aria-label') || 'Copy page link';
    copyLinkBtn.addEventListener('click', async function () {
      var url = getSharePageUrl();
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(url);
        } else {
          throw new Error('no_clipboard');
        }
      } catch (_) {
        try {
          var ta = document.createElement('textarea');
          ta.value = url;
          ta.setAttribute('readonly', '');
          ta.style.position = 'fixed';
          ta.style.left = '-9999px';
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          document.body.removeChild(ta);
        } catch (err2) {
          window.prompt('Copy this link:', url);
          return;
        }
      }
      copyLinkBtn.classList.add('is-copied');
      copyLinkBtn.textContent = '✓';
      copyLinkBtn.setAttribute('aria-label', 'Copied page link');
      window.setTimeout(function () {
        copyLinkBtn.classList.remove('is-copied');
        copyLinkBtn.innerHTML = copyDefaultHtml;
        copyLinkBtn.setAttribute('aria-label', copyDefaultLabel);
      }, 2200);
    });
  }

  refreshShareTargets();

  if (
    !SUPABASE_URL ||
    !SUPABASE_ANON_KEY ||
    SUPABASE_ANON_KEY.includes('YOUR_ANON')
  ) {
    if (waitlistSuccess) {
      waitlistSuccess.textContent =
        'Signup is temporarily unavailable (missing Supabase configuration).';
      waitlistSuccess.classList.add('show');
    }
    hideShareWrap();
    return;
  }

  const supabase = getSupabaseClient();
  if (!supabase) return;

  const submitBtn = waitlistForm.querySelector('button[type="submit"]');
  const submitLabelEl = waitlistForm.querySelector('.waitlist-submit-label');

  let isSubmitting = false;

  function setSubmitLoading(on) {
    if (!submitBtn) return;
    if (on) {
      submitBtn.classList.add('is-loading');
      submitBtn.disabled = true;
      submitBtn.setAttribute('aria-busy', 'true');
    } else {
      submitBtn.classList.remove('is-loading');
      submitBtn.disabled = false;
      submitBtn.removeAttribute('aria-busy');
    }
  }

  waitlistForm.addEventListener('submit', async function (e) {
    e.preventDefault();
    if (isSubmitting) return;

    const name = String(document.getElementById('wlName')?.value || '').trim();
    const email = String(document.getElementById('wlEmail')?.value || '').trim();
    const country = String(document.getElementById('wlCountry')?.value || '').trim();
    const stateEl = document.getElementById('wlState');
    const stateFieldEl = document.getElementById('wlStateField');
    const stateVisible = !!(stateFieldEl && !stateFieldEl.hasAttribute('hidden'));
    const state = stateVisible ? String(stateEl?.value || '').trim() : '';
    const feedback = String(document.getElementById('wlComment')?.value || '').trim();

    function showMessage(msg) {
      if (!waitlistSuccess) return;
      waitlistSuccess.textContent = msg;
      waitlistSuccess.classList.toggle('show', !!msg);
    }

    hideShareWrap();

    if (!name) {
      showMessage('Please enter your name.');
      return;
    }
    if (!email) {
      showMessage('Please enter an email address.');
      return;
    }
    if (!isValidEmail(email)) {
      showMessage('Please enter a valid email address.');
      return;
    }
    const emailTypoMessage = emailQualityError(email);
    if (emailTypoMessage) {
      showMessage(emailTypoMessage);
      return;
    }
    if (!country) {
      showMessage('Please select your country.');
      return;
    }
    if (stateVisible && !state) {
      showMessage('Please select your state.');
      return;
    }

    const countryPayload =
      stateVisible && state ? country + ' (' + state + ')' : country;

    isSubmitting = true;
    setSubmitLoading(true);
    showMessage('');

    try {
      const insertPromise = supabase.from(TABLE).insert({
        name,
        email,
        country: countryPayload,
        feedback: feedback || null,
        source: SOURCE_LANDING,
      });

      const [result] = await Promise.all([
        insertPromise,
        new Promise(function (resolve) {
          window.setTimeout(resolve, MIN_SUBMIT_MS);
        }),
      ]);

      const error = result && result.error;

      if (error) {
        showMessage(friendlyError(error));
        return;
      }

      waitlistForm.reset();
      const _stateField = document.getElementById('wlStateField');
      const _countryField = document.getElementById('wlCountryField');
      if (_stateField) _stateField.setAttribute('hidden', '');
      if (_countryField) _countryField.style.gridColumn = '1 / -1';

      showMessage(
        'You’re in. Welcome aboard, founding collector — we’ll email you when early access opens.'
      );
      showShareWrap();
    } catch (err) {
      showMessage(friendlyError(err));
    } finally {
      isSubmitting = false;
      setSubmitLoading(false);
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function () {
    initWaitlistSupabase();
    trackWebsiteVisit();
  });
} else {
  initWaitlistSupabase();
  trackWebsiteVisit();
}
