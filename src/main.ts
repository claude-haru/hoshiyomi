import './styles.css';
import { el } from './ui/dom.ts';
import { renderApp } from './ui/app.ts';

const root = document.getElementById('app')!;

root.append(
  el(
    'header',
    { class: 'app-header' },
    el('img', { src: `${import.meta.env.BASE_URL}icons/icon.svg`, alt: '' }),
    el(
      'div',
      {},
      el('h1', {}, '星読み'),
      el('div', { class: 'sub' }, '自分専用ホロスコープ · 天文計算ベース'),
    ),
  ),
);

const main = el('main', {});
root.append(main);
renderApp(main);

// Service Worker（PWA / オフライン）— 本番ビルド時のみ
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    const swUrl = new URL('sw.js', document.baseURI).href;
    navigator.serviceWorker.register(swUrl).catch((err) => console.warn('SW 登録失敗:', err));
  });
}
