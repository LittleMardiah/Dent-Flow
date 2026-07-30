'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { doctorEmrApi, VitalSigns, PrescriptionItem, EncounterData, InventoryItem } from '@/lib/api/doctorEmr';

const DRAFT_KEY = 'dentflow_emr_draft';

export function useDoctorEmr(patientId: string, doctorId: string, bookingId: string) {
  const [complaint, setComplaint] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [treatment, setTreatment] = useState('');
  const [notes, setNotes] = useState('');
  const [vitalSigns, setVitalSigns] = useState<VitalSigns>({});
  const [prescriptions, setPrescriptions] = useState<PrescriptionItem[]>([]);
  const [pastPrescriptions, setPastPrescriptions] = useState<PrescriptionItem[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDraftSaved, setIsDraftSaved] = useState(false);
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Load draft from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`${DRAFT_KEY}_${patientId}`);
      if (saved) {
        const draft = JSON.parse(saved);
        setComplaint(draft.complaint || '');
        setDiagnosis(draft.diagnosis || '');
        setTreatment(draft.treatment || '');
        setNotes(draft.notes || '');
        setVitalSigns(draft.vitalSigns || {});
        setPrescriptions(draft.prescriptions || []);
      }
    } catch (e) {
      // ignore
    }
  }, [patientId]);

  // Fetch inventory and past prescriptions
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        const [inventoryData, prescriptionsData] = await Promise.all([
          doctorEmrApi.getInventory(),
          doctorEmrApi.getPatientPrescriptions(patientId),
        ]);
        setInventory(inventoryData);
        setPastPrescriptions(prescriptionsData);
        setError(null);
      } catch (err: any) {
        setError(err.message || 'Gagal memuat data');
      } finally {
        setIsLoading(false);
      }
    };
    if (patientId) {
      fetchData();
    }
  }, [patientId]);

  // Auto-save draft every 30 seconds
  useEffect(() => {
    if (autoSaveTimerRef.current) {
      clearInterval(autoSaveTimerRef.current);
    }
    autoSaveTimerRef.current = setInterval(() => {
      saveDraft();
    }, 30000);

    return () => {
      if (autoSaveTimerRef.current) {
        clearInterval(autoSaveTimerRef.current);
      }
    };
  }, [complaint, diagnosis, treatment, notes, vitalSigns, prescriptions, patientId]);

  const saveDraft = useCallback(() => {
    try {
      const draft = {
        complaint,
        diagnosis,
        treatment,
        notes,
        vitalSigns,
        prescriptions,
        updatedAt: new Date().toISOString(),
      };
      localStorage.setItem(`${DRAFT_KEY}_${patientId}`, JSON.stringify(draft));
      setIsDraftSaved(true);
      setTimeout(() => setIsDraftSaved(false), 2000);
    } catch (e) {
      // ignore
    }
  }, [complaint, diagnosis, treatment, notes, vitalSigns, prescriptions, patientId]);

  const addPrescription = (item: Omit<PrescriptionItem, 'id'>) => {
    const newItem: PrescriptionItem = {
      ...item,
      id: `presc_${Date.now()}`,
    };
    setPrescriptions((prev) => [...prev, newItem]);
  };

  const removePrescription = (id: string) => {
    setPrescriptions((prev) => prev.filter((p) => p.id !== id));
  };

  const updatePrescription = (id: string, data: Partial<PrescriptionItem>) => {
    setPrescriptions((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...data } : p))
    );
  };

  const submitEncounter = async () => {
    if (!complaint.trim() || !treatment.trim()) {
      throw new Error('Keluhan dan Tindakan wajib diisi');
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const encounterData: EncounterData = {
        bookingId,
        patientId,
        doctorId,
        complaint,
        diagnosis: diagnosis || undefined,
        treatment,
        notes: notes || undefined,
        vitalSigns: Object.keys(vitalSigns).length > 0 ? vitalSigns : undefined,
        prescriptions: prescriptions.length > 0 ? prescriptions : undefined,
      };

      const result = await doctorEmrApi.createEncounter(encounterData);

      // If prescriptions exist, save them separately if needed
      // Note: Usually encounter creation already handles prescriptions if backend supports it.
      // But we have a separate endpoint if needed.
      if (prescriptions.length > 0 && result.id) {
        // Optionally link prescriptions to encounter
        await doctorEmrApi.createPrescription({
          patientId,
          doctorId,
          encounterId: result.id,
          items: prescriptions,
        });
      }

      // Clear draft after successful submit
      localStorage.removeItem(`${DRAFT_KEY}_${patientId}`);
      
      return result;
    } catch (err: any) {
      setError(err.message || 'Gagal menyimpan EMR');
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  };

  const clearDraft = () => {
    localStorage.removeItem(`${DRAFT_KEY}_${patientId}`);
    setComplaint('');
    setDiagnosis('');
    setTreatment('');
    setNotes('');
    setVitalSigns({});
    setPrescriptions([]);
  };

  return {
    complaint,
    setComplaint,
    diagnosis,
    setDiagnosis,
    treatment,
    setTreatment,
    notes,
    setNotes,
    vitalSigns,
    setVitalSigns,
    prescriptions,
    pastPrescriptions,
    inventory,
    isLoading,
    isSubmitting,
    isDraftSaved,
    error,
    addPrescription,
    removePrescription,
    updatePrescription,
    submitEncounter,
    saveDraft,
    clearDraft,
  };
}
