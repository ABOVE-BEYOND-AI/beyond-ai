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

    let responseBuffer = "";
    let contentBuffer = "";
    let isThinkBlockParsed = false;

    try {
      const response = await fetch("/api/itinerary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      if (!response.body) {
        throw new Error("No response body received");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          setState(prev => ({ ...prev, isLoading: false, isComplete: true }));
          break;
        }

        responseBuffer += decoder.decode(value, { stream: true });

        // Process each line in the response buffer
        const lines = responseBuffer.split('\n');
        responseBuffer = lines.pop() || ''; // Keep the last incomplete line
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const jsonData = line.substring(6).trim();
            
            if (jsonData === '[DONE]') {
              setState(prev => ({ ...prev, isLoading: false, isComplete: true }));
              return;
            }

            // Skip empty data lines
            if (!jsonData) continue;

            try {
              const parsed = JSON.parse(jsonData);
              const chunkContent = parsed.choices?.[0]?.delta?.content;
              
              // Also handle the case where content is in message.content
              const messageContent = parsed.choices?.[0]?.message?.content;
              const actualContent = chunkContent || messageContent;
              
              if (actualContent) {
                console.log("Received chunk:", actualContent); // Debug log
                contentBuffer += actualContent;
                
                if (!isThinkBlockParsed) {
                  const thinkEndTag = '</think>';
                  const endOfThinkIndex = contentBuffer.indexOf(thinkEndTag);
                  
                  if (endOfThinkIndex !== -1) {
                    isThinkBlockParsed = true;
                    console.log("Found end of think block"); // Debug log
                    // The actual content starts after the tag + newline
                    let finalContent = contentBuffer.substring(endOfThinkIndex + thinkEndTag.length);
                    finalContent = finalContent.replace(/^\s+/, ''); // Remove leading whitespace/newlines
                    
                    console.log("Content after think block:", finalContent); // Debug log
                    
                    setState(prev => ({
                      ...prev,
                      content: finalContent,
                      thinkingContent: contentBuffer.substring(0, endOfThinkIndex + thinkEndTag.length),
                    }));
                  } else {
                    console.log("Still in think block, buffer length:", contentBuffer.length); // Debug log
                  }
                } else {
                  // We are past the think block, just append the new content
                  console.log("Appending content after think block:", actualContent); // Debug log
                  setState(prev => ({ ...prev, content: prev.content + actualContent }));
                }
              }
            } catch (e) {
              console.error("Failed to parse JSON chunk:", jsonData, e);
              // Sometimes the content might not be JSON, let's try to use it directly
              if (jsonData && !jsonData.startsWith('{')) {
                contentBuffer += jsonData;
                setState(prev => ({ ...prev, content: prev.content + jsonData }));
              }
            }
          }
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return;
      }
      console.error("Streaming error:", error);
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