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
      element.textContent = formatted;
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
