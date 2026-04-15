/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api, getCurrentUserEmail, setCurrentUserEmail } from './api.js';

const DataContext = createContext(null);

export function DataProvider({ children }) {
  const [me, setMe] = useState(null);
  const [users, setUsers] = useState([]);
  const [requisitions, setRequisitions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadAll = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [meData, usersData, reqsData] = await Promise.all([
        api.me(),
        api.listUsers(),
        api.listRequisitions(),
      ]);
      setMe(meData);
      setUsers(usersData);
      setRequisitions(reqsData);
    } catch (err) {
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const switchUser = useCallback(async (email) => {
    setCurrentUserEmail(email);
    await loadAll(); // reload everything as the new user
  }, [loadAll]);

  const createRequisition = useCallback(async (input) => {
    const created = await api.createRequisition(input);
    setRequisitions((prev) => [created, ...prev]);
    return created;
  }, []);

  const updateRequisition = useCallback(async (id, patch) => {
    const updated = await api.updateRequisition(id, patch);
    setRequisitions((prev) => prev.map((r) => (r.id === id ? updated : r)));
    return updated;
  }, []);

  const value = {
    me,
    users,
    currentUserEmail: getCurrentUserEmail(),
    switchUser,
    requisitions,
    loading,
    error,
    refresh: loadAll,
    createRequisition,
    updateRequisition,
  };
  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used inside DataProvider');
  return ctx;
}
