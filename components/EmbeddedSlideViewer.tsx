"use client";

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Loader2, ExternalLink, AlertCircle, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useGoogleAuth } from '@/components/google-auth-provider-clean';

interface EmbeddedSlideViewerProps {
  embedUrl: string;
  editUrl?: string;
  presentationId?: string;
  title?: string;
  className?: string;
  onPdfReady?: () => void;
}

export function EmbeddedSlideViewer({ 
  embedUrl, 
  editUrl, 
  presentationId,
  title = "Itinerary Presentation",
  className = "",
  onPdfReady
}: EmbeddedSlideViewerProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  
  // Phase 6.2: PDF download state
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  // Get Google access token for OAuth API calls
  const { accessToken } = useGoogleAuth();

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

  // Phase 6.2: PDF download functionality
  const handleDownloadPdf = async () => {
    if (!presentationId) {
      setPdfError('Presentation ID not available for download');
      return;
    }

    if (!accessToken) {
      setPdfError('Google access token not available for download');
      return;
    }

    setIsDownloadingPdf(true);
    setPdfError(null);

    try {
      console.log('📥 Starting PDF download for presentation:', presentationId);

      const response = await fetch('/api/slides/download-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ presentationId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      // Get the PDF blob
      const blob = await response.blob();
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      // Generate filename with timestamp
      const timestamp = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-');
      link.download = `luxury-itinerary-${timestamp}.pdf`;
      
      // Trigger download
      document.body.appendChild(link);
      link.click();
      
      // Cleanup
      link.remove();
      window.URL.revokeObjectURL(url);
      
      console.log('✅ PDF download completed successfully');
      
      // Notify parent that PDF is ready
      if (onPdfReady) {
        onPdfReady();
      }

    } catch (error) {
      console.error('❌ Error downloading PDF:', error);
      setPdfError(error instanceof Error ? error.message : 'Failed to download PDF');
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  return (
    <Card className={`border-border/30 bg-card/30 backdrop-blur-2xl overflow-hidden ${className}`}>
      <CardContent className="p-6">
        {/* Header with title and action buttons */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-foreground">
            {title}
          </h3>
          <div className="flex items-center gap-2">
            {/* PDF Download Button */}
            {presentationId && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadPdf}
                disabled={isDownloadingPdf}
                className="gap-2"
              >
                {isDownloadingPdf ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                {isDownloadingPdf ? 'Downloading...' : 'Download PDF'}
              </Button>
            )}
            
            {/* View in Slides Button */}
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
                The presentation failed to load. This might be due to a network issue or the slides aren&apos;t published to web yet.
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

        {/* PDF download error */}
        {pdfError && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg"
          >
            <div className="flex items-center gap-2 text-destructive mb-2">
              <AlertCircle className="h-4 w-4" />
              <span className="font-medium text-sm">PDF Download Failed</span>
            </div>
            <p className="text-xs text-destructive/90">{pdfError}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPdfError(null)}
              className="mt-2 h-7 text-xs"
            >
              Dismiss
            </Button>
          </motion.div>
        )}
      </CardContent>
    </Card>
  );
}