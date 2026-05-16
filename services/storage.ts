
const DB_NAME = 'KnoDB';
const STORE_NAME = 'kno_store';
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

const initDB = (): Promise<IDBDatabase> => {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    // Add a timeout to prevent hanging in restricted iframe environments
    const timeoutId = setTimeout(() => {
      reject(new Error("IndexedDB initialization timed out"));
    }, 2000);

    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      
      request.onerror = () => {
          clearTimeout(timeoutId);
          console.error("IndexedDB error:", request.error);
          reject(request.error);
      };
      
      request.onsuccess = () => {
          clearTimeout(timeoutId);
          resolve(request.result);
      };
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
    } catch (e) {
      clearTimeout(timeoutId);
      reject(e);
    }
  });
  return dbPromise;
};

const getCurrentUser = async () => {
  return { id: 'localuser' };
};

export const saveToStorage = async (key: string, data: any): Promise<void> => {
  const user = await getCurrentUser();

  const storageKey = user ? `${user.id}_${key}` : `guest_${key}`;
  
  try {
    const idb = await initDB();
    await new Promise<void>((resolve, reject) => {
      const timeoutId = setTimeout(() => reject(new Error("IndexedDB put timed out")), 2000);
      try {
        const transaction = idb.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.put(data, storageKey);
        request.onsuccess = () => { 
          localStorage.setItem(`${storageKey}_last_local_save`, Date.now().toString());
          clearTimeout(timeoutId); 
          resolve(); 
        };
        request.onerror = () => { clearTimeout(timeoutId); reject(request.error); };
      } catch (e) {
        clearTimeout(timeoutId);
        reject(e);
      }
    });
  } catch (idbError) {
    console.warn(`IndexedDB save failed for ${key}, falling back to localStorage`, idbError);
    try {
      localStorage.setItem(storageKey, JSON.stringify(data));
      localStorage.setItem(`${storageKey}_last_local_save`, Date.now().toString());
    } catch (lsError) {
      console.error(`localStorage save failed for ${key}`, lsError);
    }
  }

  // Cloud Sync is permanently disabled. Everything stays local.
};

export const loadAllFromStorage = async (keys: string[]): Promise<Record<string, any>> => {
  const user = await getCurrentUser();
  const results: Record<string, any> = {};

  for (const key of keys) {
    const storageKey = user ? `${user.id}_${key}` : `guest_${key}`;
    let localData: any = null;
    try {
      const idb = await initDB();
      localData = await new Promise<any>((resolve, reject) => {
        const timeoutId = setTimeout(() => reject(new Error("IndexedDB get timed out")), 2000);
        try {
          const transaction = idb.transaction(STORE_NAME, 'readonly');
          const store = transaction.objectStore(STORE_NAME);
          const request = store.get(storageKey);
          request.onsuccess = () => { clearTimeout(timeoutId); resolve(request.result); };
          request.onerror = () => { clearTimeout(timeoutId); reject(request.error); };
        } catch (e) {
          clearTimeout(timeoutId);
          reject(e);
        }
      });
    } catch (idbError) {
      try {
        const item = localStorage.getItem(storageKey);
        if (item) localData = JSON.parse(item);
      } catch (e) {}
    }
    
    if (localData !== null && localData !== undefined) {
        results[key] = localData;
    }
  }

  return results;
};

export const loadFromStorage = async <T>(key: string): Promise<T | null> => {
  const user = await getCurrentUser();

  const storageKey = user ? `${user.id}_${key}` : `guest_${key}`;

  // Fallback to IndexedDB/localStorage
  let data: T | null = null;
  try {
    const idb = await initDB();
    data = await new Promise<T | null>((resolve, reject) => {
      const timeoutId = setTimeout(() => reject(new Error("IndexedDB get timed out")), 2000);
      try {
        const transaction = idb.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(storageKey);
        request.onsuccess = () => { clearTimeout(timeoutId); resolve(request.result as T || null); };
        request.onerror = () => { clearTimeout(timeoutId); reject(request.error); };
      } catch (e) {
        clearTimeout(timeoutId);
        reject(e);
      }
    });
  } catch (idbError) {
    console.warn(`IndexedDB load failed for ${key}, falling back to localStorage`, idbError);
    try {
      const lsData = localStorage.getItem(storageKey);
      if (lsData) data = JSON.parse(lsData) as T;
    } catch (lsError) {
      console.error(`localStorage load failed for ${key}`, lsError);
    }
  }

  // If logged in and no data found in user's local storage, try to migrate guest data
  if (user && !data) {
    let guestData: T | null = null;
    try {
      const idb = await initDB();
      guestData = await new Promise<T | null>((resolve, reject) => {
        const timeoutId = setTimeout(() => reject(new Error("IndexedDB guest get timed out")), 2000);
        try {
          const transaction = idb.transaction(STORE_NAME, 'readonly');
          const store = transaction.objectStore(STORE_NAME);
          const request = store.get(`guest_${key}`);
          request.onsuccess = () => { clearTimeout(timeoutId); resolve(request.result as T || null); };
          request.onerror = () => { clearTimeout(timeoutId); reject(request.error); };
        } catch (e) {
          clearTimeout(timeoutId);
          reject(e);
        }
      });
      
      if (guestData) {
        // Clear guest data after migration
        await new Promise<void>((resolve, reject) => {
          const timeoutId = setTimeout(() => reject(new Error("IndexedDB delete timed out")), 2000);
          try {
            const transaction = idb.transaction(STORE_NAME, 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.delete(`guest_${key}`);
            request.onsuccess = () => { clearTimeout(timeoutId); resolve(); };
            request.onerror = () => { clearTimeout(timeoutId); reject(request.error); };
          } catch (e) {
            clearTimeout(timeoutId);
            reject(e);
          }
        });
      }
    } catch (idbError) {
      try {
        const lsData = localStorage.getItem(`guest_${key}`);
        if (lsData) {
          guestData = JSON.parse(lsData) as T;
          localStorage.removeItem(`guest_${key}`);
        }
      } catch (lsError) {}
    }

    if (guestData) {
      data = guestData;
      // Save migrated data to user's local storage
      await saveToStorage(key, data);
    }
  }

  return data;
};
