// تطبيق ويندوز لمنظومة أولاد كشيش: نافذة مستقلة تفتح المنظومة المستضافة على Cloudflare.
// البيانات والتحديثات تأتي من الخادم، لذلك لا يحتاج التطبيق لإعادة تثبيت عند كل تحديث.
const { app, BrowserWindow, shell, Menu } = require('electron');
const path = require('path');

const APP_URL = process.env.SAS_APP_URL || 'https://sas-plus-zubair.mustafa-alzurgany.workers.dev/';
const APP_ORIGIN = new URL(APP_URL).origin;

let win = null;

function isInternal(url) {
  try { return new URL(url).origin === APP_ORIGIN; } catch { return false; }
}

function createWindow() {
  win = new BrowserWindow({
    width: 1366,
    height: 860,
    minWidth: 380,
    minHeight: 600,
    backgroundColor: '#020617',
    title: 'أولاد كشيش',
    icon: path.join(__dirname, 'build', 'icon.png'),
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  });

  // روابط واتساب وغيرها تفتح في المتصفح الافتراضي، وروابط المنظومة داخل النافذة
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (!isInternal(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (event, url) => {
    if (!isInternal(url) && !url.startsWith('file:')) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  // بدون إنترنت عند أول تشغيل: صفحة تنبيه مع زر إعادة المحاولة
  win.webContents.on('did-fail-load', (_e, code, _desc, url, isMainFrame) => {
    if (isMainFrame && code !== -3 && isInternal(url)) {
      win.loadFile(path.join(__dirname, 'offline.html'), { query: { url: APP_URL } });
    }
  });

  win.loadURL(APP_URL);
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });
  app.whenReady().then(() => {
    Menu.setApplicationMenu(null);
    createWindow();
  });
  app.on('window-all-closed', () => app.quit());
}
