"use client";

import { useEffect, useRef } from "react";

type PollCallback = () => void | Promise<void>;

interface SmartPollingOptions {
    stableIntervalMs: number;
    alertIntervalMs?: number;
    isAlertActive?: boolean;
    refreshKey?: string | number;
}

export function useSmartPolling(
    callback: PollCallback,
    {
        stableIntervalMs,
        alertIntervalMs = stableIntervalMs,
        isAlertActive = false,
        refreshKey,
    }: SmartPollingOptions
) {
    const callbackRef = useRef(callback);
    const inFlightRef = useRef(false);
    const resumePendingRef = useRef(false);

    const intervalMs = isAlertActive ? alertIntervalMs : stableIntervalMs;

    useEffect(() => {
        callbackRef.current = callback;
    }, [callback]);

    useEffect(() => {
        let disposed = false;
        let interval: ReturnType<typeof setInterval> | undefined;

        const poll = async () => {
            if (disposed || document.hidden || inFlightRef.current) return;
            inFlightRef.current = true;

            try {
                await callbackRef.current();
            } catch {
                // Keep polling after a transient request failure.
            } finally {
                inFlightRef.current = false;
                if (resumePendingRef.current && !document.hidden) {
                    resumePendingRef.current = false;
                    void poll();
                }
            }
        };

        const handleVisibilityChange = () => {
            if (document.hidden) {
                if (interval) clearInterval(interval);
                interval = undefined;
                return;
            }
            if (!inFlightRef.current) void poll();
            else resumePendingRef.current = true;
            interval = setInterval(() => void poll(), intervalMs);
        };

        document.addEventListener("visibilitychange", handleVisibilityChange);
        if (!document.hidden) {
            void poll();
            interval = setInterval(() => void poll(), intervalMs);
        }

        return () => {
            disposed = true;
            if (interval) clearInterval(interval);
            document.removeEventListener("visibilitychange", handleVisibilityChange);
        };
    }, [intervalMs, refreshKey]);
}
