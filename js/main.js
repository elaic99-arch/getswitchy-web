/* ============================================================================
   Switchy landing — progressive enhancement only.
   The page works without JS (the form still POSTs to Netlify Forms). This file
   just adds: live year, inline email validation, and an AJAX submit that shows a
   graceful in-page success state instead of navigating away.
   ========================================================================== */
(function () {
  "use strict";

  // --- current year (static "2026" fallback already in the HTML) -------------
  var yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  var form = document.querySelector(".waitlist");
  if (!form) return;

  var input = document.getElementById("email");
  var msg = document.getElementById("form-msg");
  var button = form.querySelector(".waitlist__button");
  var success = document.getElementById("success");

  // Mirror the browser's own email check so behavior is consistent.
  function isValidEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
  }

  function setError(text) {
    if (msg) msg.textContent = text;
    input.setAttribute("aria-invalid", "true");
    input.focus();
  }

  function clearError() {
    if (msg) msg.textContent = "";
    input.removeAttribute("aria-invalid");
  }

  input.addEventListener("input", function () {
    if (input.getAttribute("aria-invalid") === "true" && isValidEmail(input.value)) {
      clearError();
    }
  });

  form.addEventListener("submit", function (e) {
    e.preventDefault();

    if (!isValidEmail(input.value)) {
      setError("Please enter a valid email address.");
      return;
    }
    clearError();

    button.disabled = true;
    button.textContent = "Joining…";

    // Netlify Forms accepts a URL-encoded POST to any path on the site.
    var body = new URLSearchParams(new FormData(form)).toString();

    fetch("/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body,
    })
      .then(function (res) {
        if (!res.ok) throw new Error("Request failed: " + res.status);
        showSuccess();
      })
      .catch(function (err) {
        if (typeof console !== "undefined" && console.warn) {
          console.warn("[waitlist] submit failed", err);
        }
        button.disabled = false;
        button.textContent = "Be the first to know";
        setError("Something went wrong. Please try again.");
      });
  });

  function showSuccess() {
    form.hidden = true;
    if (success) {
      success.hidden = false;
      // move focus so screen readers announce the confirmation
      success.setAttribute("tabindex", "-1");
      success.focus();
    }
  }
})();
