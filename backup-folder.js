const folderSupported = typeof window.showDirectoryPicker === 'function' && typeof indexedDB !== 'undefined';
let backupFolder;
let folderBusy = false;

function folderPreference(mode, operation) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('home-budget-preferences', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('preferences');
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction('preferences', mode);
      const result = operation(transaction.objectStore('preferences'));
      transaction.oncomplete = () => { db.close(); resolve(result.result); };
      transaction.onabort = () => { db.close(); reject(transaction.error); };
    };
  });
}

function renderBackupFolder() {
  const panel = document.querySelector('#content .grid .setting');
  if (!panel) return;
  let section = document.querySelector('#backup-folder');
  if (!section) {
    section = document.createElement('div');
    section.id = 'backup-folder';
    panel.append(section);
  }
  section.innerHTML = folderSupported ? `<h3>Folder zapisu kopii</h3>
    <p>${backupFolder ? 'Wybrany folder: <strong>' + esc(backupFolder.name) + '</strong>' : 'Eksport korzysta z domyślnego folderu pobierania.'}</p>
    <button type="button" class="secondary" data-folder="choose">Wybierz folder</button>
    ${backupFolder ? '<button type="button" class="secondary" data-folder="clear">Używaj folderu pobierania</button>' : ''}`
    : '<p>Ta przeglądarka zapisuje kopie przez standardowe pobieranie plików. Miejsce zapisu wybierzesz w ustawieniach pobierania przeglądarki.</p>';
}

if (folderSupported) {
  folderPreference('readonly', store => store.get('backup-folder')).then(handle => {
    if (backupFolder === undefined) backupFolder = handle ?? null;
    if (view === 'settings') renderBackupFolder();
  }).catch(() => {});
}

document.addEventListener('click', async event => {
  const action = event.target.closest('button[data-folder]')?.dataset.folder;
  if (!action || !folderSupported || folderBusy) return;
  folderBusy = true;
  try {
    if (action === 'choose') {
      const handle = await window.showDirectoryPicker({ id: 'home-budget-backups', mode: 'readwrite' });
      await folderPreference('readwrite', store => store.put(handle, 'backup-folder'));
      backupFolder = handle;
    } else {
      await folderPreference('readwrite', store => store.delete('backup-folder'));
      backupFolder = null;
    }
    if (view === 'settings') renderBackupFolder();
  } catch (error) {
    if (error.name !== 'AbortError') notify('Nie udało się zmienić folderu zapisu.');
  } finally {
    folderBusy = false;
  }
});

const downloadToBrowser = download;
download = async function (contents, name, type) {
  const folder = backupFolder;
  if (!folder) return downloadToBrowser(contents, name, type);
  try {
    if (await folder.requestPermission({ mode: 'readwrite' }) !== 'granted') {
      throw new Error('Brak dostępu do zapisu');
    }
    const stamp = new Date().toISOString().replaceAll(':', '-');
    const filename = name.replace(/(\.[^.]+)$/, '-' + stamp + '$1');
    const file = await folder.getFileHandle(filename, { create: true });
    const writer = await file.createWritable();
    try {
      await writer.write(contents);
      await writer.close();
    } catch (error) {
      await writer.abort().catch(() => {});
      throw error;
    }
    notify('Zapisano kopię w folderze ' + folder.name);
  } catch {
    notify('Nie udało się zapisać w wybranym folderze. Pobieram plik standardowo.');
    downloadToBrowser(contents, name, type);
  }
};
