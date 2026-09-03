/* site.js — shared behaviour for the client sites.
 *
 * Deliberately dependency-free apart from optional Lenis. GSAP was dropped:
 * the only things it was doing here are character reveals and fade-ups, both
 * of which IntersectionObserver + CSS transitions handle for ~70KB less.
 *
 * Configure per page with a `window.SITE` object before this script loads:
 *   window.SITE = {
 *     word:  'ROOSTER INK',                  // preloader wordmark
 *     status:'NEW TOWN, ST. CHARLES',        // preloader status line
 *     tz:    'America/Chicago',              // for the live local clock
 *     city:  'ST. CHARLES',
 *     hours: [[...]],                        // injected by build_site.py
 *     form:  {id:'bookForm', subject:'...', required:['name','contact'],
 *             failMsg:'...',                // optional; overrides the phone fallback
 *             to:'shop@example.com',        // optional; defaults to blkg21@gmail.com
 *             replyToField:'contact',       // optional; field to use as reply-to
 *             phone:'(636) 980-0494', tel:'6369800494',
 *             success:'...'},
 *   };
 */
(function () {
  'use strict';

  var CFG = window.SITE || {};
  var reduced = matchMedia('(prefers-reduced-motion:reduce)').matches;

  /* ---------------- preloader ---------------- */
  (function () {
    var intro = document.getElementById('intro');
    if (!intro) return;
    if (reduced) { intro.remove(); return; }

    var host = document.getElementById('iword');
    if (host && CFG.word) {
      CFG.word.split('').forEach(function (c, i) {
        var s = document.createElement('span');
        s.textContent = c === ' ' ? ' ' : c;
        s.style.animationDelay = (i * 45) + 'ms';
        host.appendChild(s);
      });
    }

    document.body.style.overflow = 'hidden';
    var pctEl = document.getElementById('ipct'), n = 0, done = false, tick;

    function finish() {
      if (done) return;
      done = true;
      clearInterval(tick);
      intro.classList.add('done');
      setTimeout(function () {
        intro.remove();
        document.body.style.overflow = '';
        var wm = document.querySelector('.wordmark');
        if (wm) wm.classList.add('in');
      }, 620);
    }

    tick = setInterval(function () {
      n = Math.min(100, n + Math.random() * 11);
      if (pctEl) pctEl.textContent = ('00' + Math.round(n)).slice(-3);
      if (n >= 100) finish();
    }, 90);

    // Hard fallback: rAF/timers throttle in a background tab, and a stuck
    // preloader means a blank site. Never let it trap the page.
    setTimeout(finish, 4500);
  })();

  /* ---------------- split headings + scroll reveals ---------------- */
  (function () {
    document.querySelectorAll('[data-split]').forEach(function (el) {
      var out = '';
      el.childNodes.forEach(function (node) {
        if (node.nodeType === 3) {
          node.textContent.split(/(\s+)/).forEach(function (w) {
            if (/^\s+$/.test(w)) { out += ' '; return; }
            if (!w) return;
            out += '<span class="wd">' + w.split('').map(function (c) {
              return '<span class="ch">' + c + '</span>';
            }).join('') + '</span>';
          });
        } else if (node.nodeName === 'BR') {
          out += '<br>';
        } else if (node.nodeType === 1) {
          // keep the wrapper element (e.g. <em>) and split only its text
          out += '<span class="wd">' + node.outerHTML.replace(/>([^<]+)</, function (m, txt) {
            return '>' + txt.split('').map(function (c) {
              return '<span class="ch">' + c + '</span>';
            }).join('') + '<';
          }) + '</span>';
        }
      });
      el.innerHTML = out;
      el.querySelectorAll('.ch').forEach(function (c, i) {
        c.style.transitionDelay = (i * 26) + 'ms';
      });
    });

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
      });
    }, {threshold: 0.22});
    document.querySelectorAll('[data-split],.fade-up,[data-reveal]')
      .forEach(function (el) { io.observe(el); });
  })();

  /* ---------------- smooth scroll (optional Lenis) ---------------- */
  var lenis = null;
  addEventListener('load', function () {
    if (window.Lenis && !reduced) {
      lenis = new Lenis({lerp: 0.085, smoothWheel: true, smoothTouch: false});
      (function raf(t) { lenis.raf(t); requestAnimationFrame(raf); })(0);
    }
  });

  function closePanel() {
    var p = document.getElementById('panel'), b = document.getElementById('menuBtn');
    if (!p) return;
    p.classList.remove('open');
    p.setAttribute('aria-hidden', 'true');
    if (b) b.setAttribute('aria-expanded', 'false');
  }

  document.querySelectorAll('a[href^="#"]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      var id = a.getAttribute('href');
      if (id.length < 2) return;
      var t = document.querySelector(id);
      if (!t) return;
      e.preventDefault();
      closePanel();
      if (lenis) lenis.scrollTo(t, {offset: -60, duration: 1.15});
      else t.scrollIntoView({behavior: reduced ? 'auto' : 'smooth'});
    });
  });

  /* ---------------- nav hide-on-scroll + progress bar ---------------- */
  (function () {
    var nav = document.getElementById('nav'), bar = document.getElementById('progress');
    var last = 0, ticking = false;
    addEventListener('scroll', function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () {
        ticking = false;
        var y = scrollY;
        var h = document.documentElement.scrollHeight - innerHeight;
        if (bar) bar.style.width = (h > 0 ? (y / h * 100) : 0) + '%';
        if (nav) nav.classList.toggle('up', y > last && y > 260);
        last = y;
      });
    }, {passive: true});
  })();

  /* ---------------- mobile panel ---------------- */
  (function () {
    var btn = document.getElementById('menuBtn'), panel = document.getElementById('panel');
    if (!btn || !panel) return;
    btn.addEventListener('click', function () {
      panel.classList.add('open');
      panel.setAttribute('aria-hidden', 'false');
      btn.setAttribute('aria-expanded', 'true');
    });
    var close = document.getElementById('panelClose');
    if (close) close.addEventListener('click', closePanel);
    addEventListener('keydown', function (e) { if (e.key === 'Escape') closePanel(); });
  })();

  /* ---------------- cursor ring ---------------- */
  (function () {
    var ring = document.getElementById('ring');
    if (!ring || matchMedia('(hover:none)').matches) return;
    var x = innerWidth / 2, y = innerHeight / 2, tx = x, ty = y;
    addEventListener('mousemove', function (e) { tx = e.clientX; ty = e.clientY; }, {passive: true});
    (function loop() {
      x += (tx - x) * 0.19; y += (ty - y) * 0.19;
      ring.style.transform = 'translate(' + x + 'px,' + y + 'px) translate(-50%,-50%)';
      requestAnimationFrame(loop);
    })();
    document.addEventListener('mouseover', function (e) {
      ring.classList.toggle('hov',
        !!e.target.closest('a,button,.tile,.rev,input,select,textarea'));
    });
  })();

  /* ---------------- live local clock ---------------- */
  (function () {
    var yr = document.getElementById('fyear');
    if (yr) yr.textContent = new Date().getFullYear();
    var a = document.getElementById('ltime'), b = document.getElementById('ftime');
    if (!a && !b) return;
    function tick() {
      var s;
      try {
        s = new Date().toLocaleTimeString('en-US', {
          timeZone: CFG.tz || 'America/Chicago', hour: '2-digit', minute: '2-digit'
        });
      } catch (err) {
        s = new Date().toLocaleTimeString('en-US', {hour: '2-digit', minute: '2-digit'});
      }
      if (a) a.textContent = s + ' CT';
      if (b) b.textContent = (CFG.city || '') + ' ' + s;
    }
    tick();
    setInterval(tick, 20000);
  })();

  /* ---------------- open / closed ----------------
     Driven by CFG.hours, a 7-slot week indexed 0=Sunday to match Date#getDay,
     each slot a list of [openMinute, closeMinute] pairs. Generated from the
     page's own schema.org openingHours at build time, so the pill and the
     printed hours cannot disagree.

     "Now" is resolved in the shop's timezone rather than the visitor's — the
     question is whether the shop is open, not whether it is open where you
     happen to be standing. */
  (function () {
    var wk = CFG.hours;
    var els = document.querySelectorAll('[data-open]');
    if (!wk || !els.length) return;

    var DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    function localNow() {
      try {
        var p = new Intl.DateTimeFormat('en-US', {
          timeZone: CFG.tz || 'America/Chicago',
          weekday: 'short', hour: 'numeric', minute: 'numeric', hour12: false
        }).formatToParts(new Date());
        var g = {};
        p.forEach(function (x) { g[x.type] = x.value; });
        var h = parseInt(g.hour, 10);
        if (h === 24) h = 0;                      // en-US hour12:false yields 24
        return {d: DAYS.indexOf(g.weekday), m: h * 60 + parseInt(g.minute, 10)};
      } catch (e) {
        var n = new Date();
        return {d: n.getDay(), m: n.getHours() * 60 + n.getMinutes()};
      }
    }

    function fmt(mins) {
      var h = Math.floor(mins / 60) % 24, m = mins % 60;
      var ap = h < 12 ? 'am' : 'pm';
      var hh = h % 12; if (hh === 0) hh = 12;
      return hh + (m ? ':' + (m < 10 ? '0' : '') + m : '') + ap;
    }

    /* A span whose close is at or before its open runs past midnight, so it is
       still today's span while the clock reads early morning. */
    function openSpan(day, mins) {
      var spans = wk[day] || [];
      for (var i = 0; i < spans.length; i++) {
        var o = spans[i][0], c = spans[i][1];
        if (c <= o) { if (mins >= o || mins < c) return spans[i]; }
        else if (mins >= o && mins < c) return spans[i];
      }
      return null;
    }

    function nextOpen(day, mins) {
      var later = (wk[day] || []).filter(function (s) { return s[0] > mins; })
                                 .sort(function (a, b) { return a[0] - b[0]; });
      if (later.length) return {day: day, at: later[0][0], today: true};
      for (var i = 1; i <= 7; i++) {
        var d = (day + i) % 7;
        var spans = (wk[d] || []).slice().sort(function (a, b) { return a[0] - b[0]; });
        if (spans.length) return {day: d, at: spans[0][0], today: false};
      }
      return null;
    }

    function render() {
      var now = localNow();
      if (now.d < 0) return;
      var span = openSpan(now.d, now.m), txt, open;

      if (span) {
        open = true;
        // 24/7 businesses shouldn't be told they close at 11:59pm
        txt = (span[1] - span[0] >= 1439) ? 'Open 24/7'
                                          : 'Open now \u00b7 till ' + fmt(span[1]);
      } else {
        open = false;
        var nx = nextOpen(now.d, now.m);
        txt = nx ? 'Closed \u00b7 opens ' + (nx.today ? '' : DAYS[nx.day] + ' ') + fmt(nx.at)
                 : 'Closed';
      }

      for (var i = 0; i < els.length; i++) {
        els[i].hidden = false;
        els[i].textContent = txt;
        els[i].classList.toggle('is-open', open);
        els[i].classList.toggle('is-shut', !open);
        els[i].setAttribute('aria-label', txt);
      }
    }

    render();
    setInterval(render, 60000);
  })();

  /* ---------------- enquiry form ----------------
     Posts to formsubmit.co. Every site previously either used alert() or,
     worse, POSTed to '/' — which GitHub Pages answers with 200, so the
     submission silently vanished while the visitor saw a success message. */
  (function () {
    var f = CFG.form;
    if (!f) return;
    var form = document.getElementById(f.id);
    if (!form) return;

    var msg = document.getElementById('formMsg');
    if (!msg) {
      msg = document.createElement('p');
      msg.id = 'formMsg';
      msg.setAttribute('role', 'status');
      msg.setAttribute('aria-live', 'polite');
      form.appendChild(msg);
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      msg.className = '';
      msg.textContent = '';

      var req = f.required || [];
      for (var i = 0; i < req.length; i++) {
        var field = form.elements[req[i]];
        if (field && !String(field.value).trim()) {
          msg.className = 'err';
          msg.textContent = f.requiredMsg || 'Please fill in the required fields.';
          field.focus();
          return;
        }
      }

      var btn = form.querySelector('button[type=submit],input[type=submit]');
      var label = btn ? (btn.querySelector('span') || btn) : null;
      var orig = label ? label.textContent : '';
      if (btn) btn.disabled = true;
      if (label) label.textContent = 'SENDING…';
      msg.textContent = 'Sending…';

      var payload = {_subject: f.subject || 'Website enquiry'};
      new FormData(form).forEach(function (v, k) {
        if (k !== 'form-name' && k !== 'bot-field') payload[k] = v;
      });

      /* The contact field is free text — a phone number as often as an email.
         When it is an address, hand it to formsubmit as the reply-to so the
         business can just hit Reply; when it is a phone, send no header at all
         rather than a malformed one. */
      var replyTo = f.replyToField || 'contact';
      var candidate = String(payload[replyTo] || '').trim();
      if (/^[^\s@]+@[^\s@.]+\.[^\s@]+$/.test(candidate)) payload._replyto = candidate;

      fetch('https://formsubmit.co/ajax/' + (f.to || 'blkg21@gmail.com'), {
        method: 'POST',
        headers: {'Content-Type': 'application/json', Accept: 'application/json'},
        body: JSON.stringify(payload)
      }).then(function (r) {
        if (!r.ok) throw new Error('status ' + r.status);
        return r.json();
      }).then(function () {
        form.reset();
        msg.className = 'ok';
        msg.textContent = f.success || 'Sent — we’ll be in touch shortly.';
      }).catch(function () {
        msg.className = 'err';
        // Not every business publishes a phone number, so fall back in order:
        // an explicit failMsg, then the phone, then a plain retry.
        var link = 'style="color:inherit;text-decoration:underline"';
        if (f.failMsg) {
          msg.innerHTML = f.failMsg;
        } else if (f.tel && f.phone) {
          msg.innerHTML = 'That didn’t send. Please call <a href="tel:' + f.tel +
            '" ' + link + '>' + f.phone + '</a>.';
        } else {
          msg.textContent = 'That didn’t send — please try again in a moment.';
        }
      }).finally(function () {
        if (btn) btn.disabled = false;
        if (label) label.textContent = orig;
      });
    });
  })();
})();
