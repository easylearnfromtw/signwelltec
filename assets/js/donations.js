/* Recurring giving totals and tape labels use the same Taipei calendar date. */
(function () {
  "use strict";

  function initDonations() {
    var cards = Array.from(document.querySelectorAll("[data-donation-card]"));
    if (!cards.length) return;

    var numberFormat = new Intl.NumberFormat("zh-TW");
    var dateFormat = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Taipei",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    });
    var lastRefreshDate = "";
    var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var amountObserver = null;

    function easeOutExpo(t) {
      return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
    }

    function animateAmount(element) {
      if (!element || element.dataset.counted === "true") return;
      var target = Number(element.dataset.amountValue || 0);
      if (!isFinite(target)) return;

      if (reducedMotion) {
        element.textContent = numberFormat.format(target);
        element.dataset.counted = "true";
        return;
      }

      element.dataset.counted = "true";
      element.textContent = "0";
      element.classList.add("is-counting");
      var start = performance.now();
      var duration = element.hasAttribute("data-donation-total") ? 1200 : 980;

      function frame(now) {
        var progress = Math.min(1, (now - start) / duration);
        var value = Math.round(target * easeOutExpo(progress));
        element.textContent = numberFormat.format(value);

        if (progress < 1) {
          requestAnimationFrame(frame);
        } else {
          element.textContent = numberFormat.format(target);
          element.classList.remove("is-counting");
          element.classList.add("is-counted");
        }
      }

      requestAnimationFrame(frame);
    }

    if ("IntersectionObserver" in window && !reducedMotion) {
      amountObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          amountObserver.unobserve(entry.target);
          animateAmount(entry.target);
        });
      }, { threshold: 0.35, rootMargin: "0px 0px -6% 0px" });
    }

    function taipeiToday() {
      var date = {};
      dateFormat.formatToParts(new Date()).forEach(function (part) {
        if (part.type !== "literal") date[part.type] = Number(part.value);
      });
      return date;
    }

    function formatDate(date) {
      return String(date.year).padStart(4, "0") + "." +
        String(date.month).padStart(2, "0") + "." +
        String(date.day).padStart(2, "0");
    }

    function monthNumber(date) {
      return date.year * 12 + date.month - 1;
    }

    function dateInMonth(month, day) {
      return { year: Math.floor(month / 12), month: month % 12 + 1, day: day };
    }

    function setAmount(element, amount) {
      if (!element) return;
      var formatted = numberFormat.format(amount);
      element.dataset.final = formatted;
      element.dataset.amountValue = String(amount);

      if (element.dataset.counted === "true") {
        element.textContent = formatted;
        return;
      }

      if (amountObserver) {
        // Keep the real value in the DOM until the element is actually visible.
        // This prevents hidden totals from becoming 0 and being copied into the 3D floor.
        element.textContent = formatted;
        if (element.dataset.countArmed !== "true") {
          element.dataset.countArmed = "true";
          amountObserver.observe(element);
        }
      } else {
        animateAmount(element);
      }
    }

    function refreshDonations() {
      var today = taipeiToday();
      var asof = formatDate(today);
      if (asof === lastRefreshDate) return;

      var currentMonth = monthNumber(today);
      var total = 0;

      cards.forEach(function (card) {
        var data = card.dataset;
        var first = data.firstDate.split("-").map(Number);
        var firstMonth = monthNumber({ year: first[0], month: first[1] });
        var cycleDay = Number(data.cycleDay) || 1;
        var baseAmount = Number(data.baseAmount) || 0;
        var increment = Number(data.increment) || 0;
        var payments = currentMonth < firstMonth ? 0 : Math.max(0,
          currentMonth - firstMonth + (today.day >= cycleDay ? 1 : 0));
        var amount = baseAmount + payments * increment;
        total += amount;

        setAmount(card.querySelector("[data-donation-amount]"), amount);

        // The base already includes donations through the preceding month.
        var lastMonth = currentMonth < firstMonth ? firstMonth - 1 :
          currentMonth - (today.day >= cycleDay ? 0 : 1);
        var last = formatDate(dateInMonth(lastMonth, cycleDay));
        var lastElement = card.querySelector("[data-donation-last]");
        if (lastElement) lastElement.textContent = last > asof ? asof : last;
      });

      document.querySelectorAll("[data-donation-total]").forEach(function (element) {
        setAmount(element, total);
      });
      document.querySelectorAll("[data-donation-asof]").forEach(function (element) {
        element.textContent = asof;
      });

      document.querySelectorAll("[data-tape-index] .tape-item[data-amount-from]")
        .forEach(function (item) {
          var source = document.querySelector(item.dataset.amountFrom);
          if (!source) return;
          var amount = source.dataset.final || source.textContent.trim();
          item.querySelectorAll("[data-tape-amount]").forEach(function (element) {
            element.textContent = amount;
          });
        });

      lastRefreshDate = asof;
      document.dispatchEvent(new CustomEvent("signwell:donationsupdated", {
        detail: { asof: asof, total: total }
      }));
    }

    refreshDonations();
    window.setInterval(refreshDonations, 60000);
    window.addEventListener("focus", refreshDonations);
    document.addEventListener("visibilitychange", function () {
      if (!document.hidden) refreshDonations();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initDonations, { once: true });
  } else {
    initDonations();
  }
})();
