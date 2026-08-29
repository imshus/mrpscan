import { useCallback, useEffect, useRef, useState } from 'react';

import type { StoneRateType } from '@/types/scanner';
import { buildQuality } from '@/utils/qualityUtils';
import { lookupStoneRate, RateNotFoundError } from '@/utils/ratesApi';

interface UseStoneRateFetchOptions {
  type: StoneRateType;
  color: string;
  clarity: string;
  shape?: string;
  packetCode?: string;
  enabled?: boolean;
  onRateFetched?: (rate: string) => void;
}

interface UseStoneRateFetchResult {
  quality: string;
  rate: string;
  isFetching: boolean;
  rateNotFound: boolean;
  fetchRate: () => Promise<void>;
  setRate: (rate: string) => void;
}

export function useStoneRateFetch({
  type,
  color,
  clarity,
  shape,
  packetCode,
  enabled = true,
  onRateFetched,
}: UseStoneRateFetchOptions): UseStoneRateFetchResult {
  const [rate, setRate] = useState('');
  const [isFetching, setIsFetching] = useState(false);
  const [rateNotFound, setRateNotFound] = useState(false);
  const requestIdRef = useRef(0);

  const quality = buildQuality(color, clarity);

  const onRateFetchedRef = useRef(onRateFetched);
  useEffect(() => {
    onRateFetchedRef.current = onRateFetched;
  }, [onRateFetched]);

  const fetchRate = useCallback(async () => {
    const trimmedColor = color.trim();
    const trimmedClarity = clarity.trim();
    const trimmedShapeRaw = shape?.trim() ?? '';
    const trimmedShape = trimmedShapeRaw.toLowerCase() === 'none' ? '' : trimmedShapeRaw;
    const trimmedPacketCode = packetCode?.trim() ?? '';
    const hasLookupCriteria =
      type === 'diamond'
        ? Boolean(trimmedPacketCode || trimmedShape || trimmedColor || trimmedClarity)
        : Boolean(trimmedColor && trimmedClarity);

    if (!hasLookupCriteria) {
      setRate('');
      setRateNotFound(false);
      return;
    }

    const requestId = ++requestIdRef.current;
    setIsFetching(true);
    setRateNotFound(false);

    try {
      const response = await lookupStoneRate({
        type,
        color: trimmedColor,
        clarity: trimmedClarity,
        shape: trimmedShape,
        packetCode: trimmedPacketCode,
      });

      if (requestId !== requestIdRef.current) return;

      const rateValue = String(response.rate);
      setRate(rateValue);
      onRateFetchedRef.current?.(rateValue);
    } catch (error) {
      if (requestId !== requestIdRef.current) return;

      if (error instanceof RateNotFoundError) {
        setRate('');
        onRateFetchedRef.current?.('');
        setRateNotFound(false);
        return;
      }

      setRateNotFound(false);
    } finally {
      if (requestId === requestIdRef.current) {
        setIsFetching(false);
      }
    }
  }, [type, color, clarity, shape, packetCode]);

  useEffect(() => {
    if (!enabled) return;

    const trimmedColor = color.trim();
    const trimmedClarity = clarity.trim();
    const trimmedShapeRaw = shape?.trim() ?? '';
    const trimmedShape = trimmedShapeRaw.toLowerCase() === 'none' ? '' : trimmedShapeRaw;
    const trimmedPacketCode = packetCode?.trim() ?? '';
    const hasLookupCriteria =
      type === 'diamond'
        ? Boolean(trimmedPacketCode || trimmedShape || trimmedColor || trimmedClarity)
        : Boolean(trimmedColor && trimmedClarity);

    if (!hasLookupCriteria) {
      setRate('');
      setRateNotFound(false);
      return;
    }

    const timer = setTimeout(() => {
      fetchRate();
    }, 400);

    return () => clearTimeout(timer);
  }, [color, clarity, shape, packetCode, enabled, fetchRate, type]);

  return {
    quality,
    rate,
    isFetching,
    rateNotFound,
    fetchRate,
    setRate,
  };
}
