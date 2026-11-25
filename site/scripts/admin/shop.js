import { mount } from './common.js';

const rootPath = '/api/admin/shop';
const labels = {
  new: 'Новая',
  review: 'На согласовании',
  agreed: 'Согласована',
  closed: 'Закрыта',
};

mount('shop', (ctx) => {
  const { e, api, money, params, feedback, root } = ctx;
  const section = ['products', 'requests', 'settings'].includes(
    params.get('tab'),
  )
    ? params.get('tab')
    : 'products';
  const page = /^\d{1,6}$/.test(params.get('page') || '')
    ? Number(params.get('page'))
    : 0;
  const tabs = [
    ['products', 'Товары'],
    ['requests', 'Заявки'],
    ['settings', 'Реквизиты и документы'],
  ];
  const input = (name, label, value = '', required = false) =>
    `<label>${label}<input name="${name}" value="${e(value)}"${required ? ' required' : ''}></label>`;
  const area = (name, label, value) =>
    `<label>${label}<textarea name="${name}" rows="5">${e(value)}</textarea></label>`;
  const check = (name, label, value) =>
    `<label class="shop-admin-check"><input name="${name}" type="checkbox"${value ? ' checked' : ''}> ${label}</label>`;
  const btn = (label, attrs, primary = false) =>
    `<button type="button" class="btn${primary ? ' btn--primary' : ''}" ${attrs}>${label}</button>`;
  const danger = (label, attrs) =>
    `<button type="button" class="btn btn--danger" ${attrs}>${label}</button>`;
  const productDelete = (product) =>
    danger('Удалить', `data-product-delete="${e(product.id)}" data-version="${e(product.version)}"`);
  const save = (label) =>
    `<button class="btn btn--primary" type="submit">${label}</button>`;
  function photoList(form) { return JSON.parse(form.dataset.photos || '[]'); }
  function photoMarkup(photos) {
    return photos.map((id,i)=>`<div class="shop-admin-photo-item"><img class="shop-admin-photo" src="${rootPath}/images/${e(id)}.webp" alt="Фото ${i+1}"><small>${i===0?'Обложка':'Фото '+(i+1)}</small>${i?btn('На обложку', 'data-shop-photo-main="'+i+'"'):''}${danger('Удалить', 'data-shop-photo-remove="'+i+'"')}</div>`).join('');
  }
  function syncPhoto(form, photos) {
    form.dataset.photos=JSON.stringify(photos);
    form.querySelector('[data-shop-photo-preview]').innerHTML=photoMarkup(photos);
    form.querySelector('[data-shop-photo-label]').textContent='Добавить фото ('+photos.length+'/12)';
    form.elements.photo.value='';
    ctx.setDirty(true);
  }
  const send = (url, method, body) =>
    api(rootPath + url, { method, body: JSON.stringify(body) });
  let view,
    products = [],
    settings,
    busy = false;

  function variant(item = { code: '', label: '', price: 0, available: true }) {
    return `<div class="shop-admin-variant">
   ${input('code', 'Код (латиница, без пробелов)', item.code, true)}
   ${input('label', 'Размер / цвет', item.label, true)}
   <label>Цена, ₽<input name="price" type="number" step=".01" min=".01" max="1000000" value="${item.price ? item.price / 100 : ''}" required></label>
   ${check('available', 'Доступен для заявки', item.available)}
   ${danger('Удалить вариант', 'data-variant-remove')}
  </div>`;
  }
  function productEditor(current) {
    const product = current || {
      variants: '[]',
      category: '',
      description: '',
      image: null,
      published: false,
    };
    const variants = JSON.parse(product.variants);
    const photos=JSON.parse(product.photos||'[]');
    if(!photos.length&&product.image)photos.push(product.image);
    view.querySelector('[data-product-editor]').innerHTML =
      `<form id="shop-product-form" data-id="${e(product.id)}" data-version="${product.version || 0}" data-photos="${e(JSON.stringify(photos))}">
   <h2>${product.id ? 'Изменить товар' : 'Новый товар'}</h2>
   <div class="form-grid">${input('title', 'Название', product.title, true)}${input('slug', 'Адрес (латиница, цифры, дефисы)', product.slug, true)}${input('category', 'Категория', product.category, true)}</div>
   ${area('description', 'Описание, характеристики и размеры', product.description)}
   <fieldset class="shop-admin-photo-field"><legend>Фото товара</legend>
    <div class="shop-admin-photo-grid" data-shop-photo-preview>${photoMarkup(photos)}</div>
    <div class="shop-admin-photo-actions">
     <label class="shop-admin-photo-upload"><span class="btn" data-shop-photo-label>Добавить фото (${photos.length}/12)</span>
      <input type="file" name="photo" multiple accept="image/jpeg,image/png,image/webp"></label>
     <small class="form-note">До 12 фото, JPEG, PNG или WebP до 6 МБ каждое</small>
    </div>
   </fieldset>
   <h3>Варианты</h3><p class="form-note">У каждого размера или цвета свой код и цена. Код сохраняет связь с корзиной. При изменении размера или цвета задайте новый уникальный код.</p>
   <div data-shop-variants>${variants.length ? variants.map(variant).join('') : variant()}</div>
   <div class="actions">${btn('Добавить вариант', 'data-variant-add')}${check('published', 'Показать в каталоге', product.published)}</div>
   <div class="actions">${save('Сохранить товар')}${btn('Закрыть редактор', 'data-product-close')}${product.id ? productDelete(product) : ''}</div>
  </form>`;
  }
  async function displayProducts() {
    ({ products } = await api(rootPath + '/products'));
    view.innerHTML = `<div class="actions">${btn('Добавить товар', 'data-new-product', true)}<a href="/shop">Открыть каталог</a></div>
   <div class="shop-admin-list">${ctx.table(
     ['Товар', 'Категория', 'Видимость', 'Действия'],
     products.map((p) => [
       e(p.title),
       e(p.category),
       p.published ? 'Опубликован' : 'Черновик',
       '<div class="table-actions">' + btn('Изменить', `data-product-id="${e(p.id)}"`) + productDelete(p) + '</div>',
     ]),
     'Товаров пока нет.',
   )}</div><div data-product-editor></div>`;
  }
  async function displaySettings() {
    ({ settings } = await api(rootPath + '/settings'));
    view.innerHTML = `<form id="shop-settings-form"><h2>Реквизиты и условия заявок</h2>
   <p class="form-note">Заполните фактические данные оператора и тексты документов. После включения формы эти сведения будут опубликованы в каталоге.</p>
   <div class="form-grid">
   ${input('operator', 'Наименование оператора', settings.operator)}${input('inn', 'ИНН', settings.inn)}
   ${input('address', 'Адрес', settings.address)}${input('contact', 'Контакт для обращений', settings.contact)}
   </div>${area('policy', 'Политика обработки персональных данных', settings.policy)}
   ${area('consent', 'Отдельный текст согласия на обработку данных', settings.consent)}
   ${check('enabled', 'Открыть приём заявок', settings.enabled)}
   <div class="actions">${save('Сохранить реквизиты')}<a href="/shop-policy">Посмотреть политику</a></div></form>`;
  }
  async function displayRequests() {
    const { requests, hasMore } = await api(
      rootPath + '/requests?page=' + page,
    );
    view.innerHTML = `<div class="shop-admin-requests">${
      requests
        .map((request) => {
          const items = JSON.parse(request.items);
          const datetime = new Date(request.createdAt).toLocaleString('ru-RU', {
            timeZone: 'Asia/Krasnoyarsk',
            dateStyle: 'short',
            timeStyle: 'short',
          });
          return `<article><h2>Заявка № ${e(request.number)}</h2>
   <p class="form-note">${e(datetime)} · ${e(labels[request.status])}</p><p>${e(request.name)} · <a href="tel:${e(request.phone)}">${e(request.phone)}</a></p>
   <ul>${items.map((i) => `<li>${e(i.title)} · ${e(i.label)} × ${i.quantity} · ${money(i.price * i.quantity)}</li>`).join('')}</ul><p>По каталогу: <strong>${money(request.total)}</strong></p>
   <form data-request-id="${e(request.id)}" data-previous="${e(request.status)}" class="actions">
    <label>Статус<select name="status">${Object.entries(labels)
      .map(
        ([key, label]) =>
          `<option value="${key}"${key === request.status ? ' selected' : ''}>${label}</option>`,
      )
      .join('')}</select></label>
    ${save('Обновить статус')}${danger('Удалить', 'data-request-delete')}
   </form></article>`;
        })
        .join('') || '<p>Заявок пока нет.</p>'
    }</div>
  <nav class="actions" aria-label="Страницы заявок">${page ? `<a href="/admin/shop?tab=requests&page=${page - 1}">Назад</a>` : ''}
  ${hasMore ? `<a href="/admin/shop?tab=requests&page=${page + 1}">Далее</a>` : ''}</nav>`;
  }
  const renderCurrent = {
    products: displayProducts,
    settings: displaySettings,
    requests: displayRequests,
  }[section];
  async function run(work, success) {
    if (busy) return;
    busy = true;
    ctx.setSaving(true);
    view.setAttribute('aria-busy', 'true');
    const buttons = [...view.querySelectorAll('button:enabled,input:enabled,select:enabled,textarea:enabled')];
    buttons.forEach((button) => (button.disabled = true));
    try {
      await work();
      if (success) feedback(success);
    } catch (error) {
      feedback(error.message, true);
    } finally {
      busy = false;
      ctx.setSaving(false);
      view.removeAttribute('aria-busy');
      buttons.forEach((button) => (button.disabled = false));
    }
  }

  return {
    render: () =>
      `<nav class="tabs" aria-label="Магазин">${tabs.map(([id, label]) => `<a href="/admin/shop?tab=${id}"${section === id ? ' aria-current="page"' : ''}>${label}</a>`).join('')}</nav><div class="panel shop-admin" data-shop-admin>Загрузка…</div>`,
    bind() {
      view = root.querySelector('[data-shop-admin]');
      void renderCurrent().catch((error) => {
        view.textContent = 'Раздел не загрузился.';
        feedback(error.message, true);
      });
      view.addEventListener('input', (event) => {
        if (event.target.closest('form')) ctx.setDirty(true);
      });
      view.addEventListener('change', (event) => {
        const files = [...(event.target.files||[])];
        if (busy || event.target.name !== 'photo' || !files.length) return;
        const form = event.target.form;
        const photos=photoList(form);
        if(photos.length+files.length>12){feedback('Максимум 12 фотографий.',true);event.target.value='';return;}
        void run(async () => {
          for(const file of files) if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>6*1024*1024) throw Error('Выберите JPEG, PNG или WebP до 6 МБ.');
          for(const file of files){
            const {id}=await api(rootPath+'/images',{method:'POST',headers:{'Content-Type':file.type},body:file});
            photos.push(id);syncPhoto(form,photos);
          }
        });
      });
      view.addEventListener('click', (event) => {
        const button = event.target.closest('button');
        if (!button || busy) return;
        const form = button.form;
        if (button.hasAttribute('data-product-delete')) {
          const editor = view.querySelector('#shop-product-form');
          const message = editor
            ? 'Удалить товар? Открытый редактор закроется без сохранения.'
            : 'Удалить товар из каталога?';

          if (!confirm(message)) return;

          void run(async () => {
            await send(
              '/products/' + encodeURIComponent(button.dataset.productDelete),
              'DELETE',
              {
                version: Number(button.dataset.version),
              },
            );
            ctx.setDirty(false);
            await renderCurrent();
          }, 'Товар удалён.');

          return;
        }
        if (
          button.hasAttribute('data-new-product') ||
          button.dataset.productId ||
          button.hasAttribute('data-product-close')
        ) {
          if (
            view.querySelector('#shop-product-form') &&
            !confirm('Закрыть текущий редактор товара?')
          )
            return;
          ctx.setDirty(false);
          if (button.hasAttribute('data-product-close'))
            view.querySelector('[data-product-editor]').replaceChildren();
          else {
            productEditor(
              products.find((p) => p.id === button.dataset.productId),
            );
            view.querySelector('[name=title]').focus();
          }
        }
        if (button.hasAttribute('data-variant-add')) {
          const list = form.querySelector('[data-shop-variants]');
          if (list.children.length < 30)
            list.insertAdjacentHTML('beforeend', variant());
          ctx.setDirty(true);
        }
        if (button.hasAttribute('data-variant-remove')) {
          if (form.querySelectorAll('.shop-admin-variant').length <= 1) {feedback('У товара должен остаться хотя бы один вариант.', true);return;}
          if (!confirm('Удалить этот вариант товара?')) return;
          button.closest('.shop-admin-variant').remove();
          ctx.setDirty(true);
        }
        if (button.hasAttribute('data-shop-photo-main')) {
          const photos=photoList(form);photos.unshift(...photos.splice(Number(button.dataset.shopPhotoMain),1));syncPhoto(form,photos);
        }
        if (button.hasAttribute('data-shop-photo-remove')) {
          if (!confirm('Убрать фотографию товара?')) return;
          const photos=photoList(form);photos.splice(Number(button.dataset.shopPhotoRemove),1);syncPhoto(form,photos);
          form.elements.photo.focus();
        }
        if (
          button.hasAttribute('data-request-delete') &&
          confirm('Удалить заявку и её контактные данные? Восстановить заявку будет невозможно.')
        ) {
          void run(async () => {
            await send(
              '/requests/' + encodeURIComponent(form.dataset.requestId),
              'DELETE',
              { previous: form.dataset.previous },
            );
            ctx.setDirty(false);
            await renderCurrent();
          }, 'Заявка удалена.');
        }
      });
      view.addEventListener('submit', (event) => {
        event.preventDefault();
        if (busy) return;
        const form = event.target;
        const data = new FormData(form);
        if (form.id === 'shop-settings-form')
          void run(async () => {
            await send('/settings', 'PUT', {
              ...Object.fromEntries(data),
              version: settings.version,
              enabled: data.has('enabled'),
            });
            ctx.setDirty(false);
            await renderCurrent();
          }, 'Реквизиты сохранены.');
        if (form.id === 'shop-product-form')
          void run(async () => {
            const variants = [
              ...form.querySelectorAll('.shop-admin-variant'),
            ].map((row) => ({
              code: row.querySelector('[name=code]').value.trim(),
              label: row.querySelector('[name=label]').value,
              price: Math.round(
                Number(row.querySelector('[name=price]').value) * 100,
              ),
              available: row.querySelector('[name=available]').checked,
            }));
            const id = form.dataset.id;
            const { title, slug, category, description } =
              Object.fromEntries(data);
            await send(
              '/products' + (id ? '/' + encodeURIComponent(id) : ''),
              id ? 'PATCH' : 'POST',
              {
                title,
                slug,
                category,
                description,
                published: data.has('published'),
                photos: photoList(form),
                version: Number(form.dataset.version),
                variants,
              },
            );
            ctx.setDirty(false);
            await renderCurrent();
          }, 'Товар сохранён.');
        if (form.dataset.requestId)
          void run(async () => {
            await send(
              '/requests/' + encodeURIComponent(form.dataset.requestId),
              'PATCH',
              { status: data.get('status'), previous: form.dataset.previous },
            );
            ctx.setDirty(false);
            await renderCurrent();
          }, 'Статус обновлён.');
      });
    },
  };
});
