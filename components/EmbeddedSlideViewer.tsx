"use client";

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Loader2, ExternalLink, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface EmbeddedSlideViewerProps {
  embedUrl: string;
  editUrl?: string;
  title?: string;
  className?: string;
}

export function EmbeddedSlideViewer({ 
  embedUrl, 
  editUrl, 
  title = "Itinerary Presentation",
  className = ""
}: EmbeddedSlideViewerProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // Google Slides aspect ratio: 960x600 = 16:10 ≈ 0.625
  const EMBED_ASPECT_RATIO = 600 / 960;

  // Error handling: timeout after 10 seconds
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (loading) {
        setError(true);
        setLoading(false);
      }
    }, 10000);

    return () => clearTimeout(timeout);
  }, [loading]);

  const handleIframeLoad = () => {
    setLoading(false);
    setError(false);
  };

  const handleIframeError = () => {
    setLoading(false);
    setError(true);
  };

  const openInSlides = () => {
    if (editUrl) {
      window.open(editUrl, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <Card className={`border-border/30 bg-card/30 backdrop-blur-2xl overflow-hidden ${className}`}>
      <CardContent className="p-6">
        {/* Header with title and external link */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-foreground">
            {title}
          </h3>
          {editUrl && (
            <Button
              variant="outline"
              size="sm"
              onClick={openInSlides}
              className="gap-2"
            >
              <ExternalLink className="h-4 w-4" />
              View in Slides
            </Button>
          )}
        </div>

        {/* Responsive iframe container */}
        <div 
          className="relative w-full max-w-[960px] mx-auto rounded-xl overflow-hidden shadow-lg"
          style={{
            paddingBottom: `${EMBED_ASPECT_RATIO * 100}%`,
            background: '#ffffff'
          }}
        >
          {/* Loading overlay */}
          {loading && !error && (
            <motion.div
              initial={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white"
            >
              <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
              <p className="text-sm text-muted-foreground">Loading slides...</p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                This may take a few moments
              </p>
            </motion.div>
          )}

          {/* Error state */}
          {error && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white p-6"
            >
              <AlertCircle className="h-12 w-12 text-destructive mb-4" />
              <h4 className="text-lg font-semibold text-foreground mb-2">
                Unable to Load Presentation
              </h4>
              <p className="text-sm text-muted-foreground text-center mb-4 max-w-sm">
                The presentation failed to load. This might be due to a network issue or the slides aren't published to web yet.
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setError(false);
                    setLoading(true);
                  }}
                >
                  Try Again
                </Button>
                {editUrl && (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={openInSlides}
                    className="gap-2"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Open in Google Slides
                  </Button>
                )}
              </div>
            </motion.div>
          )}

          {/* The actual iframe */}
          <iframe
            src={embedUrl}
            title={title}
            allowFullScreen
            className="absolute inset-0 w-full h-full border-0"
            style={{
              display: loading || error ? 'none' : 'block'
            }}
            onLoad={handleIframeLoad}
            onError={handleIframeError}
            sandbox="allow-scripts allow-same-origin allow-presentation"
          />
        </div>

        {/* Navigation instructions */}
        {!loading && !error && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mt-4 p-3 bg-muted/30 rounded-lg"
          >
            <p className="text-xs text-muted-foreground text-center">
              💡 Use the controls at the bottom of the presentation to navigate slides, 
              start slideshow, or view fullscreen
            </p>
          </motion.div>
        )}
      </CardContent>
    </Card>
  );
}