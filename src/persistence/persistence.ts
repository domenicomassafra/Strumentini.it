export interface PersistenceAdapter {
  get<T>(key: string): Promise<T | undefined>;
  put<T>(key: string, value: T): Promise<void>;
  /** Atomic create-only write; supported by the native IndexedDB add operation. */
  add?<T>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<void>;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

export function createMemoryPersistence(): PersistenceAdapter {
  const values = new Map<string, unknown>();
  return {
    async get<T>(key: string) {
      const value = values.get(key);
      return value === undefined ? undefined : clone(value as T);
    },
    async put<T>(key: string, value: T) {
      values.set(key, clone(value));
    },
    async add<T>(key: string, value: T) {
      if (values.has(key)) throw new Error("Persistence key already exists");
      values.set(key, clone(value));
    },
    async delete(key: string) {
      values.delete(key);
    },
  };
}

export interface IndexedDbPersistenceOptions {
  databaseName?: string;
  storeName?: string;
}

export function createIndexedDbPersistence(
  options: IndexedDbPersistenceOptions = {},
): PersistenceAdapter {
  const databaseName = options.databaseName ?? "utility-workbench";
  const storeName = options.storeName ?? "state";
  let databasePromise: Promise<IDBDatabase> | undefined;

  function database(): Promise<IDBDatabase> {
    if (databasePromise !== undefined) return databasePromise;
    const opening = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(databaseName, 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(storeName)) {
          request.result.createObjectStore(storeName);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error("IndexedDB open failed"));
      request.onblocked = () => reject(new Error("IndexedDB open blocked"));
    });
    databasePromise = opening.catch((error) => {
      databasePromise = undefined;
      throw error;
    });
    return databasePromise;
  }

  async function request<T>(
    mode: IDBTransactionMode,
    run: (store: IDBObjectStore) => IDBRequest<T>,
  ): Promise<T> {
    const db = await database();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, mode);
      const operation = run(transaction.objectStore(storeName));
      let result: T;
      operation.onsuccess = () => {
        result = operation.result;
      };
      operation.onerror = () => reject(operation.error ?? new Error("IndexedDB request failed"));
      transaction.oncomplete = () => resolve(result);
      transaction.onerror = () => reject(transaction.error ?? new Error("IndexedDB transaction failed"));
      transaction.onabort = () => reject(transaction.error ?? new Error("IndexedDB transaction aborted"));
    });
  }

  return {
    async get<T>(key: string) {
      return (await request("readonly", (store) => store.get(key))) as T | undefined;
    },
    async put<T>(key: string, value: T) {
      await request("readwrite", (store) => store.put(value, key));
    },
    async add<T>(key: string, value: T) {
      await request("readwrite", (store) => store.add(value, key));
    },
    async delete(key: string) {
      await request("readwrite", (store) => store.delete(key));
    },
  };
}
