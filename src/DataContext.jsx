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
  const [headcount, setHeadcount] = useState([]);
  const [applications, setApplications] = useState([]);
  const [unseenInboxCount, setUnseenInboxCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadAll = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [meData, usersData, reqsData, candsData, interviewersData, headcountData] = await Promise.all([
        api.me(),
        api.listUsers(),
        api.listRequisitions(),
        api.listCandidates(),
        api.listInterviewers(),
        api.listHeadcount(),
      ]);
      setMe(meData);
      setUsers(usersData);
      setRequisitions(reqsData);
      setCandidates(candsData);
      setInterviewers(interviewersData);
      setHeadcount(headcountData);
      // Inbox data — only for TA and admin roles (approvers get 403)
      if (meData.role === 'ta' || meData.role === 'admin') {
        const [appsData, unseenData] = await Promise.all([
          api.listApplications({ status: 'pending' }),
          api.unseenApplicationCount(),
        ]);
        setApplications(appsData);
        setUnseenInboxCount(unseenData.count);
      }
    } catch (err) {
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  // Re-fetch headcount whenever candidates change (since it's derived from their stages).
  const refreshHeadcount = useCallback(async () => {
    try {
      const data = await api.listHeadcount();
      setHeadcount(data);
    } catch { /* non-critical */ }
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
    // A stage change (especially to Joined/Offered) affects the headcount view.
    if (patch.stage) refreshHeadcount();
    return updated;
  }, [refreshHeadcount]);

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
    // A Joined-stage transition affects the Active count → refresh headcount.
    if (fresh.stage === 'Joined' || fresh.stage === 'Offered') refreshHeadcount();
    return interview;
  }, [refreshHeadcount]);

  // Soft-cancel an interview. The backend reverts the candidate's stage in the
  // same transaction (R1 Scheduled → Sourced; R2 Scheduled → R1 Complete), so
  // we re-fetch the candidate to refresh the Pipeline / Kanban view.
  const cancelInterview = useCallback(async (interviewId, candidateId, reason) => {
    const cancelled = await api.cancelInterview(interviewId, reason);
    const fresh = await api.getCandidate(candidateId);
    setCandidates((prev) => prev.map((c) => (c.id === fresh.id ? fresh : c)));
    return cancelled;
  }, []);

  const offerCandidate = useCallback(async (id, offerDate) => {
    const updated = await api.offerCandidate(id, offerDate);
    setCandidates((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
    refreshHeadcount();
    return updated;
  }, [refreshHeadcount]);

  const recordJoin = useCallback(async (id, joinDate) => {
    const updated = await api.recordJoin(id, joinDate);
    setCandidates((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
    refreshHeadcount();
    return updated;
  }, [refreshHeadcount]);

  // PR-E (C3): Joined → Training. Refreshes headcount because Training
  // is a derived headcount column.
  const startTraining = useCallback(async (id) => {
    const updated = await api.startTraining(id);
    setCandidates((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
    refreshHeadcount();
    return updated;
  }, [refreshHeadcount]);

  // PR-E (C3): Training → Active (or Joined → Active for fast hires). Refreshes
  // headcount because Active drives the "Active Headcount" StatCard.
  const activateCandidate = useCallback(async (id) => {
    const updated = await api.activateCandidate(id);
    setCandidates((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
    refreshHeadcount();
    return updated;
  }, [refreshHeadcount]);

  const acceptApplication = useCallback(async (id, body) => {
    const { application, candidate } = await api.acceptApplication(id, body);
    setApplications((prev) => prev.filter((a) => a.id !== id));
    setCandidates((prev) => [candidate, ...prev]);
    setUnseenInboxCount((prev) => Math.max(0, prev - 1));
    return { application, candidate };
  }, []);

  const rejectApplication = useCallback(async (id, reason) => {
    const updated = await api.rejectApplication(id, reason);
    setApplications((prev) => prev.filter((a) => a.id !== id));
    setUnseenInboxCount((prev) => Math.max(0, prev - 1));
    return updated;
  }, []);

  const markInboxSeen = useCallback(async () => {
    await api.markInboxSeen();
    setUnseenInboxCount(0);
  }, []);

  const approveRequisition = useCallback(async (id) => {
    const updated = await api.approveRequisition(id);
    setRequisitions((prev) => prev.map((r) => (r.id === id ? updated : r)));
    return updated;
  }, []);

  const setRequisitionApprovers = useCallback(async (id, phase, approverIds) => {
    const updated = await api.setRequisitionApprovers(id, phase, approverIds);
    setRequisitions((prev) => prev.map((r) => (r.id === id ? updated : r)));
    return updated;
  }, []);

  const value = {
    me,
    users,
    currentUserEmail: getCurrentUserEmail(),
    switchUser,
    requisitions,
    candidates,
    interviewers,
    headcount,
    loading,
    error,
    refresh: loadAll,
    refreshHeadcount,
    createRequisition,
    updateRequisition,
    approveRequisition,
    setRequisitionApprovers,
    createCandidate,
    updateCandidate,
    scheduleInterview,
    recordInterviewResult,
    cancelInterview,
    offerCandidate,
    recordJoin,
    startTraining,
    activateCandidate,
    applications,
    unseenInboxCount,
    acceptApplication,
    rejectApplication,
    markInboxSeen,
  };
  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used inside DataProvider');
  return ctx;
}
