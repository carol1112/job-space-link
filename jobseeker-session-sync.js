/* ============================================================
   jobseeker-session-sync.js
   Job Space Link | Shared Jobseeker Login / Logout Sync
   Use this same file in all 3 pages.
============================================================ */
(function () {
  "use strict";

  const CHANNEL_NAME = "jobSpaceLink_jobseeker_auth_channel_v1";
  const SESSION_KEY = "jobSpaceLink_jobseeker_session";
  const LOGIN_EVENT_KEY = "jobSpaceLink_jobseeker_login_event";
  const LOGOUT_EVENT_KEY = "jobSpaceLink_jobseeker_logout_event";

  const EMAIL_KEYS = [
    "jobSpaceLink_jobseeker_email",
    "jobSpaceLink_logged_in_email",
    "jobSpaceLink_current_jobseeker_email",
    "postedhiring_jobseeker_email",
    "postedhiring1_jobseeker_email",
    "employee_email",
    "jsl_login_email",
    "jsl_last_login_email",
    "jobseeker_email",
    "jobseeker_login_email",
    "applicant_email",
    "logged_in_email",
    "loggedInEmail",
    "user_email",
    "email",
    "login_email"
  ];

  const LOGGED_FLAG_KEYS = [
    "jobSpaceLink_jobseeker_logged_in",
    "jobSpaceLink_logged_in_jobseeker",
    "jobSpaceLink_loggedInJobseeker",
    "postedhiring_jobseeker_logged_in",
    "postedhiring1_jobseeker_logged_in",
    "employee_logged_in",
    "jsl_logged_in",
    "jobseeker_logged_in",
    "applicant_logged_in",
    "logged_in"
  ];

  const EXTRA_LOGOUT_KEYS = [
    "jsl_force_logout",
    "jobSpaceLink_force_logout",
    "jobseeker_force_logout",
    "applicant_force_logout",
    "jsl_logout_event",
    "jsl_shared_session_event",
    "postedhiring_jobseeker_logout_event",
    "postedhiring1_jobseeker_logout_event"
  ];

  const OBJECT_KEYS = [
    "jobSpaceLink_login_identity",
    "jobSpaceLink_jobseeker_session",
    "jobSpaceLink_logged_in_jobseeker",
    "jobSpaceLink_loggedInJobseeker",
    "jobSpaceLink_current_jobseeker",
    "jobSpaceLink_jobseeker_login_event",
    "postedhiringJobseekerSession",
    "postedhiring1JobseekerSession",
    "postedhiring_jobseeker_session",
    "postedhiring1_jobseeker_session",
    "loggedInApplicant",
    "jobseekerSession",
    "jobseekerUser",
    "jobseekerAccount",
    "currentJobseeker",
    "loggedInJobseeker",
    "applicantSession",
    "applicantData",
    "currentUser"
  ];

  let channel = null;
  let syncing = false;
  let lastEmail = "";

  function safeStr(value) {
    return value == null ? "" : String(value).trim();
  }

  function normEmail(value) {
    return safeStr(value).toLowerCase().replace(/\s+/g, "");
  }

  function isEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normEmail(value));
  }

  function safeJSONParse(value) {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }

  function getStorageValue(key) {
    return localStorage.getItem(key) || sessionStorage.getItem(key) || "";
  }

  function setBoth(key, value) {
    localStorage.setItem(key, value);
    sessionStorage.setItem(key, value);
  }

  function removeBoth(key) {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  }

  function getEmailFromObject(obj, depth = 0) {
    if (!obj || typeof obj !== "object" || depth > 4) return "";

    const direct = normEmail(
      obj.email ||
      obj.employee_email ||
      obj.applicant_email ||
      obj.jobseeker_email ||
      obj.login_email ||
      obj.user_email ||
      obj?.user?.email ||
      obj?.auth?.email ||
      ""
    );

    if (isEmail(direct)) return direct;

    for (const key of ["user", "auth", "account", "jobseeker", "employee", "applicant", "profile", "master", "transaction", "latest", "latestTx", "identity", "raw"]) {
      const nested = getEmailFromObject(obj[key], depth + 1);
      if (isEmail(nested)) return nested;
    }

    return "";
  }

  function findStoredEmail() {
    for (const key of EMAIL_KEYS) {
      const email = normEmail(getStorageValue(key));
      if (isEmail(email)) return email;
    }

    for (const key of OBJECT_KEYS) {
      const raw = getStorageValue(key);
      if (!raw) continue;

      if (isEmail(raw)) return normEmail(raw);

      const obj = safeJSONParse(raw);
      const email = getEmailFromObject(obj);
      if (isEmail(email)) return email;

      const match = safeStr(raw).match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/ig);
      if (match && isEmail(match[0])) return normEmail(match[0]);
    }

    return "";
  }

  function getStoredSessionObject() {
    const raw = getStorageValue(SESSION_KEY);
    const obj = safeJSONParse(raw);
    return obj && typeof obj === "object" ? obj : null;
  }

  async function getSupabaseEmail() {
    try {
      if (!window.supabase?.auth?.getSession) return "";

      const { data } = await window.supabase.auth.getSession();
      return normEmail(data?.session?.user?.email || "");
    } catch {
      return "";
    }
  }

  async function fetchAccountFromDatabase(email) {
    email = normEmail(email);
    if (!email || !window.supabase?.from) return { email };

    const account = { email };

    try {
      const { data: master } = await window.supabase
        .from("applicant_master_table")
        .select("*")
        .eq("email", email)
        .maybeSingle();

      if (master) {
        account.master = master;
        account.applicant_master_id = master.id || master.applicant_master_id || "";
        account.first_name = master.first_name || "";
        account.middle_name = master.middle_name || "";
        account.last_name = master.last_name || "";
        account.full_name = [
          master.first_name,
          master.middle_name,
          master.last_name
        ].filter(Boolean).join(" ").trim();
      }
    } catch (err) {
      console.warn("Applicant master load warning:", err);
    }

    try {
      let query = window.supabase
        .from("applicant_transaction_table")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1);

      if (account.applicant_master_id) {
        query = query.eq("applicant_master_id", account.applicant_master_id);
      } else {
        query = query.eq("email", email);
      }

      const { data: rows } = await query;

      const transaction = Array.isArray(rows) ? rows[0] : null;

      if (transaction) {
        account.transaction = transaction;
        account.applicant_transaction_id =
          transaction.id ||
          transaction.applicant_transaction_id ||
          "";

        account.profile_picture_url =
          transaction.profile_picture_url ||
          transaction.profile_photo_url ||
          transaction.photo_url ||
          transaction.avatar_url ||
          account.profile_picture_url ||
          "";

        if (!account.full_name) {
          account.full_name =
            transaction.full_name ||
            transaction.name ||
            [
              transaction.first_name,
              transaction.middle_name,
              transaction.last_name
            ].filter(Boolean).join(" ").trim();
        }
      }
    } catch (err) {
      console.warn("Applicant transaction load warning:", err);
    }

    return account;
  }

  function saveSession(account) {
    const clean = {
      ...account,
      email: normEmail(account.email),
      synced_at: new Date().toISOString()
    };

    setBoth(SESSION_KEY, JSON.stringify(clean));
    setBoth("jobSpaceLink_login_identity", JSON.stringify(clean));
    setBoth("jobSpaceLink_jobseeker_session", JSON.stringify(clean));
    setBoth("loggedInApplicant", JSON.stringify(clean));
    setBoth("jobseekerSession", JSON.stringify(clean));

    EMAIL_KEYS.forEach((key) => setBoth(key, clean.email));
    LOGGED_FLAG_KEYS.forEach((key) => setBoth(key, "1"));

    localStorage.removeItem(LOGOUT_EVENT_KEY);
    sessionStorage.removeItem(LOGOUT_EVENT_KEY);

    lastEmail = clean.email;
  }

  function clearSession() {
    removeBoth(SESSION_KEY);

    [...EMAIL_KEYS, ...OBJECT_KEYS, ...LOGGED_FLAG_KEYS, ...EXTRA_LOGOUT_KEYS].forEach(removeBoth);

    removeBoth("jobSpaceLink_jobseeker_email");
    removeBoth("jobSpaceLink_logged_in_email");
    removeBoth("jobSpaceLink_profile_photo_url");
    removeBoth("jobSpaceLink_profile_picture_url");
    removeBoth("jobSpaceLink_logged_in_profile_photo");
    removeBoth("view_profile_avatar_url");
    removeBoth("view_profile_applicant_name");

    const logoutPayload = JSON.stringify({
      action: "logout",
      time: Date.now()
    });

    localStorage.setItem(LOGOUT_EVENT_KEY, logoutPayload);
    sessionStorage.setItem(LOGOUT_EVENT_KEY, logoutPayload);

    lastEmail = "";
  }

  async function applyLoggedIn(emailOrAccount, reason = "sync-login") {
    if (syncing) return;
    syncing = true;

    try {
      let account =
        typeof emailOrAccount === "object"
          ? emailOrAccount
          : { email: emailOrAccount };

      account.email = normEmail(account.email || findStoredEmail());

      if (!account.email) {
        const supaEmail = await getSupabaseEmail();
        if (supaEmail) account.email = supaEmail;
      }

      if (!account.email) {
        await applyLoggedOut("no-email");
        return;
      }

      const dbAccount = await fetchAccountFromDatabase(account.email);
      account = { ...dbAccount, ...account, email: account.email };

      saveSession(account);

      if (typeof window.JSL_applyLoggedInAccount === "function") {
        await window.JSL_applyLoggedInAccount(account, reason);
      }

      window.dispatchEvent(
        new CustomEvent("JSL_JOBSEEKER_LOGGED_IN", {
          detail: account
        })
      );
    } finally {
      syncing = false;
    }
  }

  async function applyLoggedOut(reason = "sync-logout") {
    if (syncing) return;
    syncing = true;

    try {
      clearSession();

      if (typeof window.JSL_applyLoggedOutAccount === "function") {
        await window.JSL_applyLoggedOutAccount(reason);
      }

      window.dispatchEvent(
        new CustomEvent("JSL_JOBSEEKER_LOGGED_OUT", {
          detail: { reason }
        })
      );
    } finally {
      syncing = false;
    }
  }

  async function checkCurrentSession(reason = "check-current-session") {
    const sessionObj = getStoredSessionObject();
    const storedEmail = getEmailFromObject(sessionObj) || findStoredEmail();
    const supaEmail = await getSupabaseEmail();

    const finalEmail = supaEmail || storedEmail;

    if (finalEmail) {
      if (finalEmail !== lastEmail) {
        await applyLoggedIn({ ...(sessionObj || {}), email: finalEmail }, reason);
      }
    } else if (lastEmail || findStoredEmail()) {
      await applyLoggedOut(reason);
    } else if (typeof window.JSL_applyLoggedOutAccount === "function") {
      await window.JSL_applyLoggedOutAccount(reason);
    }
  }

  function broadcastLogin(account) {
    const payload = {
      action: "login",
      email: normEmail(account.email),
      account,
      time: Date.now()
    };

    localStorage.setItem(LOGIN_EVENT_KEY, JSON.stringify(payload));

    if (channel) {
      channel.postMessage(payload);
    }
  }

  function broadcastLogout(reason = "manual-logout") {
    const payload = {
      action: "logout",
      reason,
      time: Date.now()
    };

    localStorage.setItem(LOGOUT_EVENT_KEY, JSON.stringify(payload));

    if (channel) {
      channel.postMessage(payload);
    }
  }

  function bindEvents() {
    if (window.__JSL_SHARED_JOBSEEKER_SYNC_BOUND__) return;
    window.__JSL_SHARED_JOBSEEKER_SYNC_BOUND__ = true;

    try {
      if ("BroadcastChannel" in window) {
        channel = new BroadcastChannel(CHANNEL_NAME);

        channel.addEventListener("message", async (event) => {
          const payload = event?.data || {};
          const action = safeStr(payload.action || payload.type).toLowerCase();

          if (action === "login" || action === "signed_in") {
            await applyLoggedIn(payload.account || { email: payload.email }, "broadcast-login");
          }

          if (action === "logout" || action === "signed_out") {
            await applyLoggedOut("broadcast-logout");
          }
        });
      }
    } catch (err) {
      console.warn("BroadcastChannel unavailable:", err);
    }

    window.addEventListener("storage", async (event) => {
      if (!event.key) {
        await applyLoggedOut("storage-clear-logout");
        return;
      }

      if (event.key === LOGIN_EVENT_KEY && event.newValue) {
        const payload = safeJSONParse(event.newValue);
        if (payload?.email || payload?.account?.email) {
          await applyLoggedIn(payload.account || { email: payload.email }, "storage-login");
        }
      }

      if ((event.key === LOGOUT_EVENT_KEY || EXTRA_LOGOUT_KEYS.includes(event.key)) && event.newValue) {
        await applyLoggedOut("storage-logout");
      }

      if (event.key && EMAIL_KEYS.includes(event.key) && event.newValue) {
        await applyLoggedIn({ email: event.newValue }, "storage-email-login");
      }

      if (event.key && EMAIL_KEYS.includes(event.key) && !event.newValue && event.oldValue) {
        await checkCurrentSession("storage-email-removed");
      }
    });

    window.addEventListener("focus", () => {
      checkCurrentSession("window-focus");
    });

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        checkCurrentSession("visibility-visible");
      }
    });

    window.addEventListener("pageshow", () => {
      checkCurrentSession("pageshow");
    });

    try {
      if (window.supabase?.auth?.onAuthStateChange) {
        window.supabase.auth.onAuthStateChange(async (event, session) => {
          const name = safeStr(event).toUpperCase();
          const email = normEmail(session?.user?.email || "");

          if (name === "SIGNED_IN" && email) {
            await applyLoggedIn({ email }, "supabase-signed-in");
          }

          if (name === "SIGNED_OUT") {
            await applyLoggedOut("supabase-signed-out");
          }
        });
      }
    } catch (err) {
      console.warn("Supabase auth listener unavailable:", err);
    }
  }

  window.JSLSessionSync = {
    async setLoggedIn(account) {
      await applyLoggedIn(account, "manual-set-login");
      broadcastLogin(account);
    },

    async setLoggedOut(reason = "manual-logout") {
      await applyLoggedOut(reason);
      broadcastLogout(reason);
    },

    async check() {
      await checkCurrentSession("manual-check");
    },

    getSession() {
      return getStoredSessionObject();
    }
  };

  bindEvents();

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      checkCurrentSession("dom-ready");
    });
  } else {
    checkCurrentSession("script-loaded");
  }
})();