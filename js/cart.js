// Заявка: панель со списком, счётчик в шапке, форма как на исходном сайте и передача заявки.
import { esc, money, img, plural, FREE_DELIVERY, BASE } from './tpl.js';
import { loadCatalog, cart } from './store.js';
import { $, $$, setupDialog } from './ui.js';

// Если появится обработчик заявок (CRM, Telegram-бот, форма Tilda) — укажите адрес: заявка уйдёт POST-запросом в JSON.
// Пока адреса нет, готовый текст заявки передаётся в выбранный мессенджер или на почту.
const ORDER_ENDPOINT = '';

const PHONE = '79277282224';
const TG = 'https://t.me/Salmanova_Svetlana';
const MAIL = 'salmanova-shop@mail.ru';

export function initCart() {
  const dlg = $('#cart');
  const el = {
    count: $$('[data-cart-count]'), btns: $$('[data-cart-open]'), n: $('[data-cart-n]', dlg),
    empty: $('[data-cart-empty]', dlg), filled: $('[data-cart-filled]', dlg), list: $('[data-cart-list]', dlg),
    total: $('[data-cart-total]', dlg), freeText: $('[data-free-text]', dlg), freeBar: $('[data-free-bar]', dlg),
    form: $('[data-order]', dlg), done: $('[data-done]', dlg), doneActions: $('[data-done-actions]', dlg), doneText: $('[data-done-text]', dlg),
    body: $('.drawer-body', dlg),
  };
  const ctl = setupDialog(dlg, { panel: $('.drawer-in', dlg), from: 'right' });
  let data = null;

  function header() {
    const n = cart.count();
    el.count.forEach((c) => (c.textContent = n));
    el.btns.forEach((b) => {
      b.classList.toggle('is-empty', !n);
      b.setAttribute('aria-label', n ? `Открыть заявку: ${n} ${plural(n, 'изделие', 'изделия', 'изделий')}` : 'Открыть заявку');
    });
  }

  function render() {
    header();
    if (!data) return;
    const rows = cart.items().map((x) => ({ ...x, p: data.byId.get(x.id) })).filter((x) => x.p);
    const n = rows.reduce((s, x) => s + x.n, 0);
    el.n.textContent = n || '';
    const isDone = !el.done.hidden;
    el.empty.hidden = !!rows.length || isDone;
    el.filled.hidden = !rows.length || isDone;
    if (!rows.length) return;

    el.list.innerHTML = rows.map(({ p, n: q }) => {
      const max = p.q > 0 ? p.q : 99;
      return `<li class="ci" data-id="${p.id}">
        <a class="ci-img" href="#p-${p.id}" data-ci-open aria-label="${esc(p.t)}: открыть карточку"><img src="${img(p.id)}" alt="" width="76" height="95" loading="lazy"></a>
        <div>
          <p class="ci-title">${esc(p.t)}</p>
          ${p.d ? `<p class="ci-text">${esc(p.d.split('\n')[0])}</p>` : ''}
          <div class="ci-qty" role="group" aria-label="Количество">
            <button type="button" data-dec aria-label="Меньше"${q <= 1 ? ' disabled' : ''}><svg aria-hidden="true"><use href="#i-minus"/></svg></button>
            <output aria-live="polite">${q}</output>
            <button type="button" data-inc aria-label="Больше"${q >= max ? ' disabled' : ''}><svg aria-hidden="true"><use href="#i-plus"/></svg></button>
          </div>
        </div>
        <div class="ci-side">
          <span class="ci-price">${p.p ? money(p.p * q) : 'Цена по запросу'}</span>
          <button class="ci-del" type="button" data-del>Удалить</button>
        </div>
      </li>`;
    }).join('');

    const sum = rows.reduce((s, x) => s + (x.p.p || 0) * x.n, 0);
    const ask = rows.some((x) => !x.p.p);
    el.total.textContent = money(sum) + (ask ? ' +' : '');
    el.total.title = ask ? 'Плюс изделия с ценой по запросу' : '';
    const left = FREE_DELIVERY - sum;
    el.freeText.innerHTML = left > 0
      ? `До бесплатной доставки осталось <b>${money(left)}</b>`
      : '<b>Доставка бесплатная</b> — сумма заявки от 15&nbsp;000&nbsp;₽';
    el.freeBar.style.width = `${Math.min(100, (sum / FREE_DELIVERY) * 100)}%`;
  }

  el.list.addEventListener('click', (e) => {
    const li = e.target.closest('.ci'); if (!li) return;
    const id = li.dataset.id;
    const it = cart.items().find((x) => x.id === id);
    const p = data.byId.get(id);
    if (e.target.closest('[data-inc]')) cart.set(id, Math.min(it.n + 1, p.q > 0 ? p.q : 99));
    else if (e.target.closest('[data-dec]')) cart.set(id, Math.max(1, it.n - 1));
    else if (e.target.closest('[data-del]')) cart.remove(id);
    else if (e.target.closest('[data-ci-open]')) {
      e.preventDefault();
      ctl.close();
      setTimeout(() => window.__product?.open(id, { push: true }), 380);
    }
  });

  $$('[data-cart-close]', dlg).forEach((b) => b.addEventListener('click', (e) => {
    const href = b.getAttribute('href');
    // «Перейти в каталог» на главной: закрываем панель и едем к каталогу
    if (href && href.startsWith('#')) { e.preventDefault(); ctl.close(); setTimeout(() => window.__scrollTo?.(href), 380); }
    else if (!href) ctl.close();
    else ctl.close();
  }));
  el.btns.forEach((b) => b.addEventListener('click', () => open()));

  /* ---------- Форма ---------- */
  const phone = el.form.elements.phone;
  phone.addEventListener('input', () => {
    let d = phone.value.replace(/\D/g, '');
    if (!d) { phone.value = ''; return; }
    if (d[0] === '8') d = '7' + d.slice(1);
    if (d[0] === '9') d = '7' + d;
    d = d.slice(0, 11);
    const p = [d.slice(1, 4), d.slice(4, 7), d.slice(7, 9), d.slice(9, 11)];
    phone.value = '+' + d[0] + (p[0] ? ` (${p[0]}` : '') + (p[1] ? `) ${p[1]}` : '') + (p[2] ? `-${p[2]}` : '') + (p[3] ? `-${p[3]}` : '');
  });

  function setErr(name, msg) {
    const f = el.form.elements[name];
    const box = f.closest('.field');
    box.classList.toggle('is-err', !!msg);
    f.setAttribute('aria-invalid', msg ? 'true' : 'false');
    const p = $(`[data-err="${name}"]`, el.form);
    p.textContent = msg || '';
    if (msg) { p.id = `err-${name}`; f.setAttribute('aria-describedby', p.id); } else f.removeAttribute('aria-describedby');
  }
  function validate() {
    const v = Object.fromEntries(new FormData(el.form));
    const errs = {};
    if (v.phone.replace(/\D/g, '').length !== 11) errs.phone = 'Укажите номер полностью: +7 и 10 цифр';
    if (v.name.trim().length < 2) errs.name = 'Как к вам обращаться?';
    if (v.address.trim().length < 4) errs.address = 'Укажите адрес доставки или пункта выдачи';
    ['phone', 'name', 'address'].forEach((k) => setErr(k, errs[k]));
    const first = Object.keys(errs)[0];
    if (first) el.form.elements[first].focus();
    return first ? null : v;
  }
  ['phone', 'name', 'address'].forEach((k) => el.form.elements[k].addEventListener('input', () => {
    if (el.form.elements[k].closest('.field').classList.contains('is-err')) setErr(k, '');
  }));

  function orderText(v) {
    const rows = cart.items().map((x) => ({ ...x, p: data.byId.get(x.id) })).filter((x) => x.p);
    const sum = rows.reduce((s, x) => s + (x.p.p || 0) * x.n, 0);
    const lines = rows.map((x, i) => {
      const first = (x.p.d || '').split('\n')[0];
      return `${i + 1}. ${x.p.t}${first ? ` — ${first}` : ''}\n   ${x.p.p ? `${money(x.p.p)} × ${x.n}` : `цена по запросу × ${x.n}`}\n   ${location.origin}${BASE}/#p-${x.p.id}`;
    });
    return [
      'Заявка с сайта salmanova.ru', '',
      ...lines, '',
      `Итого: ${money(sum)}${rows.some((x) => !x.p.p) ? ' + изделия с ценой по запросу' : ''}${sum >= FREE_DELIVERY ? ' (доставка бесплатная)' : ''}`, '',
      `Телефон: ${v.phone}`,
      `ФИО: ${v.name.trim()}`,
      `Доставка: ${v.delivery}`,
      `Адрес: ${v.address.trim()}`,
      `Способ связи: ${v.contact}`,
    ].join('\n');
  }

  const copy = async (t) => {
    try { await navigator.clipboard.writeText(t); return true; } catch {
      const ta = Object.assign(document.createElement('textarea'), { value: t });
      ta.style.cssText = 'position:fixed;opacity:0';
      document.body.append(ta); ta.select();
      const ok = document.execCommand('copy'); ta.remove(); return ok;
    }
  };

  function showDone(v, text, sent) {
    el.filled.hidden = true;
    el.done.hidden = false;
    $('.done-h', el.done).textContent = sent ? 'Заявка отправлена' : 'Заявка собрана';
    $('.done-p', el.done).textContent = sent
      ? 'Мы свяжемся с вами в выбранном мессенджере.'
      : 'Отправьте её в удобный мессенджер или на почту — текст заявки уже подготовлен.';
    const enc = encodeURIComponent(text);
    const A = {
      WhatsApp: `<a class="btn {c}" href="https://wa.me/${PHONE}?text=${enc}" target="_blank" rel="noopener"><svg aria-hidden="true"><use href="#i-wa"/></svg><span>Отправить в WhatsApp</span></a>`,
      Telegram: `<a class="btn {c}" href="${TG}" target="_blank" rel="noopener" data-copy-go><svg aria-hidden="true"><use href="#i-tg"/></svg><span>Скопировать и открыть Telegram</span></a>`,
      Viber: `<a class="btn {c}" href="viber://chat?number=%2B${PHONE}" data-copy-go><svg aria-hidden="true"><use href="#i-viber"/></svg><span>Скопировать и открыть Viber</span></a>`,
      Mail: `<a class="btn {c}" href="mailto:${MAIL}?subject=${encodeURIComponent('Заявка с сайта')}&body=${enc}"><svg aria-hidden="true"><use href="#i-mail"/></svg><span>Отправить на почту</span></a>`,
    };
    const order = [v.contact, ...['WhatsApp', 'Telegram', 'Viber', 'Mail'].filter((k) => k !== v.contact)];
    el.doneActions.innerHTML = sent ? '' : order.map((k, i) => A[k].replace('{c}', i ? 'btn--line' : 'btn--ink')).join('') +
      '<button class="btn btn--line" type="button" data-copy><svg aria-hidden="true"><use href="#i-copy"/></svg><span>Скопировать текст заявки</span></button>';
    el.doneText.textContent = text;
    el.doneText.hidden = sent;
    el.body.scrollTop = 0;
    el.done.focus({ preventScroll: true });
    if (sent) cart.clear();
  }

  el.doneActions.addEventListener('click', async (e) => {
    const c = e.target.closest('[data-copy]');
    if (c) { const ok = await copy(el.doneText.textContent); $('span', c).textContent = ok ? 'Скопировано' : 'Выделите текст ниже'; return; }
    if (e.target.closest('[data-copy-go]')) await copy(el.doneText.textContent);
  });

  el.form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const v = validate();
    if (!v) return;
    const text = orderText(v);
    const btn = $('[type="submit"]', el.form);
    if (ORDER_ENDPOINT) {
      btn.disabled = true;
      try {
        const r = await fetch(ORDER_ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...v, items: cart.items(), text }) });
        if (!r.ok) throw new Error(r.status);
        showDone(v, text, true);
      } catch { showDone(v, text, false); }
      btn.disabled = false;
    } else showDone(v, text, false);
  });

  $('[data-new-order]', dlg).addEventListener('click', () => {
    cart.clear();
    el.form.reset();
    el.done.hidden = true;
    render();
    ctl.close();
  });

  function open() {
    el.done.hidden = true;
    render();
    ctl.open();
  }

  cart.on(render);
  header();
  loadCatalog().then((d) => { data = d; render(); }).catch(() => {});
  return { open, close: ctl.close };
}
