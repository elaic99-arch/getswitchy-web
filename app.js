(() => {
  'use strict';
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const curtain = document.querySelector('.transition-curtain');
  const scrollPositions = new Map();
  const pageCache = new Map();
  const imageCache = new Map();
  let observer, busy = false, currentURL = location.href, data, supportOpener, cleanupTabs = () => {};

  function prepareImage(attributes, base = location.href) {
    const src = new URL(attributes.src, base).href;
    const key = [src, attributes.srcset || '', attributes.sizes || ''].join('|');
    if (imageCache.has(key)) return imageCache.get(key);
    const picture = new Image();
    picture.decoding = 'async';
    picture.loading = 'eager';
    picture.fetchPriority = attributes.fetchpriority || 'low';
    if (attributes.sizes) picture.sizes = attributes.sizes;
    if (attributes.srcset) {
      picture.srcset = attributes.srcset.split(',').map(candidate => {
        const [path, descriptor] = candidate.trim().split(/\s+/);
        return new URL(path, base).href + ' ' + descriptor;
      }).join(', ');
    }
    const loaded = new Promise(resolve => {
      picture.onload = resolve;
      picture.onerror = resolve;
    });
    picture.src = src;
    const ready = typeof picture.decode === 'function' ? picture.decode().catch(() => {}) : loaded;
    imageCache.set(key, ready);
    return ready;
  }
  function preparePage(doc, base = location.href) {
    const jobs = [...doc.querySelectorAll('img')].map(img => prepareImage({
      src: img.getAttribute('src'), srcset: img.getAttribute('srcset'),
      sizes: img.getAttribute('sizes'), fetchpriority: img.getAttribute('fetchpriority')
    }, base));
    if (doc.getElementById('app-screen')) {
      const details = JSON.parse(doc.getElementById('page-data').textContent);
      details.tabs.forEach(row => jobs.push(prepareImage({src: '/assets/' + row[3]}, base)));
    }
    return Promise.allSettled(jobs);
  }
  function closeLanguage(restoreFocus = false) {
    const picker = document.querySelector('.language-picker');
    if (!picker) return;
    picker.open = false;
    if (restoreFocus) picker.querySelector('summary').focus();
  }
  function setup() {
    cleanupTabs();
    data = JSON.parse(document.getElementById('page-data').textContent);
    supportOpener = null;
    const support = document.getElementById('contact-support');
    support.querySelector('[data-support-close]').addEventListener('click', () => support.close());
    support.addEventListener('close', () => {
      if (supportOpener?.isConnected) supportOpener.focus({preventScroll: true});
      supportOpener = null;
    });
    support.addEventListener('click', e => {
      if (e.target !== support) return;
      const box = support.getBoundingClientRect();
      if (e.clientX < box.left || e.clientX > box.right || e.clientY < box.top || e.clientY > box.bottom) support.close();
    });
    support.querySelector('[data-support-copy]').addEventListener('click', async e => {
      const button = e.currentTarget, status = support.querySelector('.support-status');
      try {
        await navigator.clipboard.writeText('support@getswitchy.com');
        status.textContent = button.dataset.copied;
      } catch {
        const selection = window.getSelection(), range = document.createRange();
        range.selectNodeContents(support.querySelector('.support-address'));
        selection.removeAllRanges(); selection.addRange(range);
        status.textContent = button.dataset.copyFallback;
      }
    });
    document.body.classList.remove('menu-open');
    const menu = document.querySelector('.menu-button');
    const mobile = document.getElementById('mobile-nav');
    function closeMenu() {
      menu.setAttribute('aria-expanded', 'false'); menu.setAttribute('aria-label', data.menu);
      mobile.hidden = true; document.body.classList.remove('menu-open');
      document.getElementById('main').inert = false; document.querySelector('footer').inert = false;
    }
    menu.addEventListener('click', () => {
      closeLanguage();
      const open = menu.getAttribute('aria-expanded') !== 'true';
      menu.setAttribute('aria-expanded', String(open)); menu.setAttribute('aria-label', open ? data.closeMenu : data.menu);
      mobile.hidden = !open; document.body.classList.toggle('menu-open', open);
      document.getElementById('main').inert = open; document.querySelector('footer').inert = open;
    });
    mobile.addEventListener('keydown', e => { if (e.key === 'Escape') { closeMenu(); menu.focus(); } });
    menu.addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu(); });
    const picker = document.querySelector('.language-picker');
    picker.addEventListener('toggle', () => { if (picker.open) closeMenu(); });
    picker.addEventListener('focusout', e => {
      if (e.relatedTarget && !picker.contains(e.relatedTarget)) closeLanguage();
    });
    picker.addEventListener('keydown', e => {
      if (e.key === 'Escape') { e.preventDefault(); closeLanguage(true); return; }
      const links = [...picker.querySelectorAll('a')];
      const index = links.indexOf(document.activeElement);
      let next;
      if (e.key === 'ArrowDown') next = (index + 1) % links.length;
      if (e.key === 'ArrowUp') next = index <= 0 ? links.length - 1 : index - 1;
      if (e.key === 'Home') next = 0;
      if (e.key === 'End') next = links.length - 1;
      if (next !== undefined) { e.preventDefault(); picker.open = true; links[next].focus(); }
    });
    if (observer) observer.disconnect();
    document.documentElement.classList.toggle('js-motion', !reducedMotion.matches);
    document.querySelectorAll('.reveal').forEach(el => {
      const hasImage = el.matches('img') || Boolean(el.querySelector('img'));
      el.classList.toggle('media-ready', hasImage);
      if (hasImage) el.classList.remove('waiting');
    });
    if (!reducedMotion.matches && 'IntersectionObserver' in window) {
      observer = new IntersectionObserver(entries => entries.forEach(entry => {
        if (entry.isIntersecting) { entry.target.classList.remove('waiting'); observer.unobserve(entry.target); }
      }), {threshold: .08, rootMargin: '0px 0px -20px 0px'});
      document.querySelectorAll('.reveal:not(.media-ready)').forEach(el => { el.classList.add('waiting'); observer.observe(el); });
    }
    const tabs = [...document.querySelectorAll('[data-app-tab]')];
    const screen = document.getElementById('app-screen');
    let activeTab = 0, transition = 0, finishScreen = () => {}, stopMotion = () => {};
    const phoneTabs = [];
    if (screen) {
      const controls = document.createElement('div');
      controls.className = 'phone-tab-controls'; controls.dir = 'ltr';
      data.tabs.forEach((row, i) => {
        const button = document.createElement('button');
        button.type = 'button'; button.dataset.phoneTab = String(i);
        button.setAttribute('aria-label', row[0]); button.setAttribute('aria-controls', 'app-panel');
        button.setAttribute('aria-pressed', String(i === 0));
        button.style.gridColumn = String([1, 2, 4][i]);
        button.addEventListener('click', () => showTab(i));
        controls.append(button); phoneTabs.push(button);
      });
      screen.parentElement.append(controls);
    }
    function showTab(i, initial = false) {
      if (!initial && i === activeTab) return;
      const row = data.tabs[i];
      const direction = (i > activeTab ? 1 : -1) * (document.documentElement.dir === 'rtl' ? -1 : 1);
      activeTab = i;
      const ticket = ++transition;
      const motion = !initial && !reducedMotion.matches && typeof screen.animate === 'function';
      const previous = motion ? (screen.parentElement.querySelector('.app-screen-outgoing') || screen).cloneNode(false) : null;
      stopMotion();
      const animations = [];
      let revealed = false;
      if (previous) {
        [...previous.attributes].filter(a => a.name === 'id' || a.name.startsWith('data-')).forEach(a => previous.removeAttribute(a.name));
        previous.classList.add('app-screen-outgoing'); previous.alt = '';
        previous.setAttribute('aria-hidden', 'true');
        screen.parentElement.append(previous);
      }
      function revealScreen() {
        if (revealed || ticket !== transition || !screen.isConnected) return;
        revealed = true;
        if (!motion || reducedMotion.matches) { previous?.remove(); return; }
        const timing = {duration: 460, easing: 'cubic-bezier(.22,.61,.36,1)'};
        const incoming = screen.animate([{opacity: 0, transform: `translateX(${direction * 18}px)`}, {opacity: 1, transform: 'translateX(0)'}], timing);
        const outgoing = previous.animate([{opacity: 1, transform: 'translateX(0)'}, {opacity: 0, transform: `translateX(${-direction * 10}px)`}], {...timing, fill: 'forwards'});
        animations.push(incoming, outgoing);
        Promise.all([incoming.finished, outgoing.finished]).then(() => {
          previous.remove(); outgoing.cancel();
        }).catch(() => {});
      }
      finishScreen = () => { stopMotion(); previous?.remove(); };
      stopMotion = () => {
        screen.removeEventListener('load', revealScreen); screen.removeEventListener('error', revealScreen);
        animations.forEach(animation => animation.cancel()); previous?.remove();
      };
      if (motion) {
        screen.addEventListener('load', revealScreen, {once: true});
        screen.addEventListener('error', revealScreen, {once: true});
      }
      tabs.forEach((tab, j) => { tab.setAttribute('aria-selected', String(i === j)); tab.tabIndex = i === j ? 0 : -1; });
      phoneTabs.forEach((tab, j) => tab.setAttribute('aria-pressed', String(i === j)));
      const ready = prepareImage({src: data.editorScreen?.src || '/assets/' + row[3]});
      document.getElementById('tab-title').textContent = row[1];
      document.getElementById('tab-description').textContent = row[2];
      document.getElementById('app-panel').setAttribute('aria-labelledby', 'app-tab-' + i);
      screen.src = data.editorScreen?.src || '/assets/' + row[3]; screen.alt = data.editorScreen?.alt ?? row[0] + ' — Switchy';
      if(data.editorScreen?.src){screen.removeAttribute('srcset');screen.removeAttribute('sizes');}
      if (data.editorTabIds) {
        for (const [field, domid] of [['title', 'tab-title'], ['description', 'tab-description']]) {
          const el = document.getElementById(domid), editId = data.editorTabIds[i][field];
          el.dataset.editId = editId;
          el.toggleAttribute('data-editor-hidden', Boolean(data.editorHiddenTabs?.[editId]));
        }
        window.dispatchEvent(new CustomEvent('switchy:app-tab', {detail: i}));
      }
      if (motion) {
        animations.push(document.getElementById('app-panel').animate([{opacity: .3, transform: 'translateY(8px)'}, {opacity: 1, transform: 'translateY(0)'}], {duration: 400, easing: 'cubic-bezier(.22,.61,.36,1)'}));
        // Keep the previous screen visible until the selected image is ready.
        // Text and navigation respond immediately, even on a slow connection.
        if (screen.complete && screen.naturalWidth) revealScreen();
        else ready.then(revealScreen);
      }
    }
    tabs.forEach((tab, i) => {
      tab.addEventListener('click', () => showTab(i));
      tab.addEventListener('keydown', e => {
        let next; const dir = document.documentElement.dir === 'rtl' ? -1 : 1;
        if (e.key === 'ArrowRight') next = (i + dir + tabs.length) % tabs.length;
        if (e.key === 'ArrowLeft') next = (i - dir + tabs.length) % tabs.length;
        if (e.key === 'Home') next = 0;
        if (e.key === 'End') next = tabs.length - 1;
        if (next !== undefined) { e.preventDefault(); showTab(next); tabs[next].focus(); }
      });
    });
    if (tabs.length && data.editorTabIds) showTab(0, true);
    const onMotionChange = () => { if (reducedMotion.matches) finishScreen(); };
    reducedMotion.addEventListener('change', onMotionChange);
    cleanupTabs = () => { ++transition; stopMotion(); reducedMotion.removeEventListener?.('change', onMotionChange); };

  }
  async function fetchPage(url) {
    const key = url.pathname + url.search;
    if (pageCache.has(key)) return pageCache.get(key);
    const pending = (async () => {
      const response = await fetch(key, {credentials: 'same-origin'});
      if (!response.ok) throw Error('Page unavailable');
      const html = await response.text();
      if (!html.includes('id="site-content"')) throw Error('Unexpected page');
      return html;
    })();
    pageCache.set(key, pending);
    pending.catch(() => pageCache.delete(key));
    return pending;
  }
  async function navigate(url, back = false) {
    if (busy) return;
    busy = true; closeLanguage(); scrollPositions.set(currentURL, scrollY);
    document.body.classList.add('is-navigating');
    let cover;
    try {
      // Keep the current page visible during the request. Start every image
      // immediately, but let text and navigation render without waiting on it.
      const html = await fetchPage(url);
      const next = new DOMParser().parseFromString(html, 'text/html');
      preparePage(next, url);
      if (!reducedMotion.matches && curtain.animate) {
        cover = curtain.animate([{transform: 'translateY(100%)'}, {transform: 'translateY(0)'}], {duration: 360, easing: 'cubic-bezier(.65,0,.25,1)', fill: 'forwards'});
        await cover.finished;
      }
      document.querySelector('.skip-link').textContent = next.querySelector('.skip-link').textContent;
      document.getElementById('site-content').replaceWith(next.getElementById('site-content'));
      const nextDesign=next.getElementById('switchy-design'),currentDesign=document.getElementById('switchy-design');
      if(nextDesign){if(currentDesign)currentDesign.replaceWith(nextDesign);else document.head.append(nextDesign);}else currentDesign?.remove();
      document.title = next.title;
      document.querySelector('meta[name="description"]').content = next.querySelector('meta[name="description"]').content;
      document.documentElement.lang = next.documentElement.lang; document.documentElement.dir = next.documentElement.dir;
      if (!back) history.pushState({}, '', url);
      currentURL = url.href; setup();
      const anchor = url.hash ? document.getElementById(decodeURIComponent(url.hash.slice(1))) : null;
      const behavior = document.documentElement.style.scrollBehavior; document.documentElement.style.scrollBehavior = 'auto';
      if (back) scrollTo(0, scrollPositions.get(url.href) || 0);
      else if (anchor) anchor.scrollIntoView({behavior: 'instant', block: 'start'});
      else scrollTo(0, 0);
      document.documentElement.style.scrollBehavior = behavior;
      const heading = document.querySelector('h1');
      if (heading && !url.hash && !back) { heading.tabIndex = -1; heading.focus({preventScroll: true}); }
      if (!reducedMotion.matches && curtain.animate) {
        const exit = curtain.animate([{transform: 'translateY(0)'}, {transform: 'translateY(-100%)'}], {duration: 460, easing: 'cubic-bezier(.65,0,.25,1)', fill: 'forwards'});
        await exit.finished; exit.cancel();
      }
      if (cover) cover.cancel();
    } catch { location.assign(url.href); }
    finally { busy = false; document.body.classList.remove('is-navigating'); }
  }
  function internalURL(link) {
    if (!link || link.target || link.hasAttribute('download')) return null;
    const href = link.getAttribute('href');
    if (!href || href.startsWith('#')) return null;
    const url = new URL(href, location.href);
    return url.origin === location.origin && url.pathname.endsWith('.html') ? url : null;
  }
  document.addEventListener('click', e => {
    const picker = document.querySelector('.language-picker');
    if (picker?.open && !picker.contains(e.target)) closeLanguage();
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const clickedLink = e.target.closest('a');
    if (['#contact-support', 'mailto:support@getswitchy.com'].includes(clickedLink?.getAttribute('href'))) {
      e.preventDefault();
      const support = document.getElementById('contact-support');
      supportOpener = clickedLink;
      support.querySelector('.support-status').textContent = '';
      support.showModal();
      return;
    }
    const url = internalURL(clickedLink);
    if (!url) return;
    e.preventDefault();
    if (url.pathname === location.pathname) {
      closeLanguage();
      if (url.hash) document.getElementById(url.hash.slice(1))?.scrollIntoView({behavior: reducedMotion.matches ? 'auto' : 'smooth'});
      else if (!clickedLink.hasAttribute('data-language')) scrollTo({top: 0, behavior: reducedMotion.matches ? 'auto' : 'smooth'});
      return;
    }
    navigate(url);
  });
  function anticipate(e) {
    if (busy) return;
    const url = internalURL(e.target.closest('a'));
    if (!url || url.pathname === location.pathname) return;
    fetchPage(url).then(html => preparePage(new DOMParser().parseFromString(html, 'text/html'), url)).catch(() => {});
  }
  document.addEventListener('pointerover', anticipate, {passive: true});
  document.addEventListener('focusin', anticipate);
  addEventListener('popstate', () => navigate(new URL(location.href), true));
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  reducedMotion.addEventListener('change', () => {
    document.documentElement.classList.toggle('js-motion', !reducedMotion.matches);
    if (reducedMotion.matches) document.querySelectorAll('.waiting').forEach(el => el.classList.remove('waiting'));
  });
  setup();
  if (location.hash === '#contact-support') document.getElementById('contact-support')?.showModal();
  // Eagerly warm all images while the page remains visible and usable.
  preparePage(document);
})();
