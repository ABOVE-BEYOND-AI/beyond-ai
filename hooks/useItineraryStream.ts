import { useState, useCallback, useRef } from "react";

interface ItineraryData {
  destination: string;
  departureCity: string;
  guests: string;
  startDate?: string;
  endDate?: string;
  budgetFrom: string;
  budgetTo: string;
  additionalOptions: string[];
  numberOfOptions?: number;
}

interface StreamState {
  content: string;
  isLoading: boolean;
  isComplete: boolean;
  error: string | null;
  thinkingContent: string; // For debugging the <think> section
}

export function useItineraryStream() {
  const [state, setState] = useState<StreamState>({
    content: "",
    isLoading: false,
    isComplete: false,
    error: null,
    thinkingContent: "",
  });

  const abortControllerRef = useRef<AbortController | null>(null);

  const streamItinerary = useCallback(async (data: ItineraryData) => {
    setState({
      content: "",
      isLoading: true,
      isComplete: false,
      error: null,
      thinkingContent: "",
    });

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    try {
      // Set a 2-minute timeout for sonar-deep-research
      const timeoutId = setTimeout(() => {
        abortControllerRef.current?.abort();
      }, 120000); // 2 minutes

      const response = await fetch("/api/itinerary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        signal: abortControllerRef.current.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const responseData = await response.json();
      const content = responseData.content || '';
      
      // For sonar-deep-research, content comes complete - no streaming needed
      setState(prev => ({ 
        ...prev, 
        content: content,
        isLoading: false, 
        isComplete: true 
      }));
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        setState(prev => ({ 
          ...prev, 
          isLoading: false, 
          error: "Request timed out after 2 minutes. Please try again with a simpler request or check your connection."
        }));
        return;
      }
      console.error("Request error:", error);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : "An unknown error occurred",
      }));
    }
  }, []);

  const stopStream = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, []);

  const resetStream = useCallback(() => {
    setState({
      content: "",
      isLoading: false,
      isComplete: false,
      error: null,
      thinkingContent: "",
    });
  }, []);

  return { ...state, streamItinerary, stopStream, resetStream };
}