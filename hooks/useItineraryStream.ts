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
  images: Array<{
    hotelName: string;
    imageUrl: string | null;
    contextLink?: string | null;
  }>;
}

export function useItineraryStream() {
  const [state, setState] = useState<StreamState>({
    content: "",
    isLoading: false,
    isComplete: false,
    error: null,
    thinkingContent: "",
    images: [],
  });

  const abortControllerRef = useRef<AbortController | null>(null);

  const streamItinerary = useCallback(async (data: ItineraryData) => {
    setState({
      content: "",
      isLoading: true,
      isComplete: false,
      error: null,
      thinkingContent: "",
      images: [],
    });

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    try {
      // Set a 2-minute timeout for sonar-pro to ensure quality output
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
        throw new Error(
          errorData.error || `HTTP ${response.status}: ${response.statusText}`,
        );
      }

      // Handle standard JSON response from Perplexity Sonar Pro
      const responseData = await response.json();
      const content = responseData.content || '';
      
      if (!content) {
        throw new Error("No content received from API");
      }
      
      console.log("Received content length:", content.length);
      console.log("Search results:", responseData.searchResults?.length || 0);
      console.log("Images found:", responseData.images?.length || 0);
      console.log("Usage:", responseData.usage);
      
      // Set the complete content and images immediately
      setState(prev => ({ 
        ...prev, 
        content: content,
        images: responseData.images || [],
        isLoading: false, 
        isComplete: true 
      }));
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error:
            "Request timed out after 2 minutes. Please try again with a simpler request or check your connection.",
        }));
        return;
      }
      console.error("Request error:", error);
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: "An unexpected error occurred. Please try again.",
      }));
    }
  }, []);

  const stopStream = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  const resetStream = useCallback(() => {
    setState({
      content: "",
      isLoading: false,
      isComplete: false,
      error: null,
      thinkingContent: "",
      images: [],
    });
    stopStream();
  }, [stopStream]);

  return { ...state, streamItinerary, stopStream, resetStream };
}
