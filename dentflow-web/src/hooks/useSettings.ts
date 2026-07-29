'use client';

import { useState, useEffect, useCallback } from 'react';
import { settingsApi, Settings } from '@/lib/api/settings';

interface UseSettingsOptions {
  branchId: string;
  autoFetch?: boolean;
}

export function useSettings({ branchId, autoFetch = true }: UseSettingsOptions) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verifyResult, setVerifyResult] = useState<{ success: boolean; message: string } | null>(null);

  const fetchSettings = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await settingsApi.getSettings(branchId);
      setSettings(data);
    } catch (err: any) {
      setError(err.message || 'Gagal memuat pengaturan');
    } finally {
      setIsLoading(false);
    }
  }, [branchId]);

  const updateSettings = useCallback(async (data: Partial<Settings>) => {
    try {
      setIsSaving(true);
      setError(null);
      const updated = await settingsApi.updateSettings(branchId, data);
      setSettings(updated);
      return updated;
    } catch (err: any) {
      setError(err.message || 'Gagal menyimpan pengaturan');
      throw err;
    } finally {
      setIsSaving(false);
    }
  }, [branchId]);

  const verifyWebhook = useCallback(async () => {
    try {
      setIsVerifying(true);
      setVerifyResult(null);
      const result = await settingsApi.verifyWebhook(branchId);
      setVerifyResult(result);
      return result;
    } catch (err: any) {
      setError(err.message || 'Gagal verifikasi webhook');
      throw err;
    } finally {
      setIsVerifying(false);
    }
  }, [branchId]);

  const refresh = useCallback(() => {
    fetchSettings();
  }, [fetchSettings]);

  useEffect(() => {
    if (autoFetch && branchId) {
      fetchSettings();
    }
  }, [autoFetch, branchId, fetchSettings]);

  return {
    settings,
    isLoading,
    isSaving,
    isVerifying,
    verifyResult,
    error,
    updateSettings,
    verifyWebhook,
    refresh,
  };
}
