/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api, getCurrentUserEmail, setCurrentUserEmail } from './api.js';

const DataContext = createContext(null);

export function DataProvider({ children }) {
  const [me, setMe] = useState(null);
  const [users, setUsers] = useState([]);
  const [requisitions, setRequisitions] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [interviewers, setInterviewers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadAll = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [meData, usersData, reqsData, candsData, interviewersData] = await Promise.all([
        api.me(),
        api.listUsers(),
        api.listRequisitions(),
        api.listCandidates(),
        api.listInterviewers(),
      ]);
      setMe(meData);
      setUsers(usersData);
      setRequisitions(reqsData);
      setCandidates(candsData);
      setInterviewers(interviewersData);
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

  const createCandidate = useCallback(async (input) => {
    const created = await api.createCandidate(input);
    setCandidates((prev) => [created, ...prev]);
    return created;
  }, []);

  const updateCandidate = useCallback(async (id, patch) => {
    const updated = await api.updateCandidate(id, patch);
    setCandidates((prev) => prev.map((c) => (c.id === id ? updated : c)));
    return updated;
  }, []);

  // Schedule/record interview — also refreshes the affected candidate so the
  // UI picks up the new stage + r1/r2 cache fields.
  const scheduleInterview = useCallback(async (input) => {
    const interview = await api.scheduleInterview(input);
    const fresh = await api.getCandidate(input.candidateId);
    setCandidates((prev) => prev.map((c) => (c.id === fresh.id ? fresh : c)));
    return interview;
  }, []);

  const recordInterviewResult = useCallback(async (interviewId, result, candidateId) => {
    const interview = await api.recordInterviewResult(interviewId, result);
    const fresh = await api.getCandidate(candidateId);
    setCandidates((prev) => prev.map((c) => (c.id === fresh.id ? fresh : c)));
    return interview;
  }, []);

  const value = {
    me,
    users,
    currentUserEmail: getCurrentUserEmail(),
    switchUser,
    requisitions,
    candidates,
    interviewers,
    loading,
    error,
    refresh: loadAll,
    createRequisition,
    updateRequisition,
    createCandidate,
    updateCandidate,
    scheduleInterview,
    recordInterviewResult,
  };
  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used inside DataProvider');
  return ctx;
}
