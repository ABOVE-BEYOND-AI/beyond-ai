"use client";

export const dynamic = 'force-dynamic'

import React, { useState, useMemo } from "react";
import Image from "next/image";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusStepper, Step } from "@/components/ui/status-stepper";
import { JollyDateRangePicker } from "@/components/ui/date-range-picker";
import MultipleSelector, { Option } from "@/components/ui/multiselect";
import { Download, AlertCircle, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { CalendarDate } from "@internationalized/date";
import { useItineraryStream } from "@/hooks/useItineraryStream";
import ReactMarkdown from "react-markdown";

import { useGoogleAuth } from "@/components/google-auth-provider-clean";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

const processSteps: Step[] = [
  { id: "research", label: "Researching", description: "AI analysis", status: "pending" },
  { id: "populate", label: "Populating", description: "Canva template", status: "pending" },
  { id: "ready", label: "Ready", description: "Download available", status: "pending" },
];

const additionalOptionsData: Option[] = [
  { value: "kids-club", label: "Kids Club" },
  { value: "business-class", label: "Business Class" },
  { value: "transfers-included", label: "Transfers Included" },
  { value: "private-chef", label: "Private Chef" },
  { value: "spa-treatments", label: "Spa Treatments" },
  { value: "private-yacht", label: "Private Yacht" },
  { value: "helicopter-tours", label: "Helicopter Tours" },
  { value: "wine-tasting", label: "Wine Tasting" },
  { value: "golf-access", label: "Golf Access" },
  { value: "ski-equipment", label: "Ski Equipment" },
  { value: "butler-service", label: "Butler Service" },
  { value: "airport-lounge", label: "Airport Lounge" },
  { value: "cultural-guide", label: "Cultural Guide" },
  { value: "photography", label: "Photography Service" },
  { value: "fitness-trainer", label: "Personal Fitness Trainer" },
];

// New component to render each itinerary option with its image
interface ItineraryOptionProps {
  optionContent: string;
  image: {
    hotelName: string;
    imageUrl: string | null;
    contextLink?: string | null;
  } | null;
}

const ItineraryOption: React.FC<ItineraryOptionProps> = ({ optionContent, image }) => {
  if (!optionContent) return null;

  // Preprocess content to remove unwanted sections but preserve hotel names for image matching
  const processedContent = optionContent
    // Remove standalone "Images" section headers but keep "Featured Hotel:" lines for image matching
    .replace(/\n\s*Images\s*\n/g, '\n')
    .replace(/\n\s*##?\s*Images\s*\n/g, '\n')
    // Remove "Featured Hotel:" lines from display (but extract them first for images)
    .replace(/\n\s*\*\*Featured Hotel\*\*:.*?\n/g, '\n');

  // Debug table content
  if (optionContent.includes('|') && optionContent.includes('Hotel')) {
    console.log('=== TABLE DEBUG ===');
    console.log('Original content with table:');
    const tableSection = optionContent.match(/### Accommodation Details[\s\S]*?(?=###|$)/)?.[0] || optionContent.substring(optionContent.indexOf('|'), optionContent.indexOf('|') + 500);
    console.log(tableSection);
    console.log('---');
    console.log('Processed content:');
    const processedTableSection = processedContent.match(/### Accommodation Details[\s\S]*?(?=###|$)/)?.[0] || processedContent.substring(processedContent.indexOf('|'), processedContent.indexOf('|') + 500);
    console.log(processedTableSection);
    console.log('===================');
  }

  return (
    <div className="prose prose-sm max-w-none text-foreground">
      <ReactMarkdown
        components={{
          h1: (props) => <h1 className="text-2xl font-bold mb-6 text-white" {...props} />,
          h2: (props) => <h2 className="text-xl font-semibold mb-4 text-white" {...props} />,
          h3: (props) => <h3 className="text-lg font-medium mb-3 text-white" {...props} />,
          p: (props) => <p className="mb-4 text-gray-300 leading-relaxed" {...props} />,
          ul: (props) => <ul className="list-disc list-inside mb-4 text-gray-300 space-y-2" {...props} />,
          li: (props) => <li className="text-gray-300" {...props} />,
          strong: (props) => <strong className="font-semibold text-white" {...props} />,
          hr: (props) => <hr className="my-8 border-gray-600" {...props} />,
          table: (props) => (
            <div className="overflow-x-auto mb-6 rounded-lg border border-gray-700/30">
              <table className="w-full border-collapse bg-gray-900/50 backdrop-blur-sm shadow-lg" {...props}>{props.children}</table>
            </div>
          ),
          thead: (props) => <thead className="bg-gray-800" {...props} />,
          th: (props) => <th className="px-6 py-4 text-white font-semibold text-left border-b border-gray-700 text-sm" {...props} />,
          td: (props) => <td className="px-6 py-4 text-gray-300 border-b border-gray-700/50 text-sm leading-relaxed" {...props} />,
          tbody: (props) => <tbody {...props} />,
          tr: (props) => <tr className="hover:bg-gray-800/30 transition-colors" {...props} />,
        }}
      >
        {processedContent}
      </ReactMarkdown>

      {image && image.imageUrl && (
        <div className="mt-6 mb-8">
          <Image
            src={`/api/image-proxy?url=${encodeURIComponent(image.imageUrl)}`}
            alt={`Featured Hotel: ${image.hotelName}`}
            width={800}
            height={384}
            className="w-full h-96 object-cover rounded-lg shadow-lg border border-gray-700/30"
            onError={(e) => {
              console.error(`Failed to load image for ${image.hotelName}:`, image.imageUrl);
              e.currentTarget.style.display = 'none';
            }}
          />
          <hr className="mt-8 border-gray-600" />
        </div>
      )}
    </div>
  );
};

function ItineraryPageContent() {
  // Auth session
  const { user, accessToken, loading } = useGoogleAuth();
  const router = useRouter();

  // ALL STATE HOOKS MUST BE AT THE TOP - BEFORE ANY CONDITIONAL RETURNS
  const [showResults, setShowResults] = useState(false);
  const [dateRange, setDateRange] = useState<{start: CalendarDate, end: CalendarDate} | null>(null);
  const [formData, setFormData] = useState({
    destination: "",
    departureCity: "",
    guests: "2",
    budgetFrom: "",
    budgetTo: "",
  });
  const [additionalOptions, setAdditionalOptions] = useState<Option[]>([]);
  const [numberOfOptions, setNumberOfOptions] = useState(3); // Default to 3 options
  
  // Process state management
  const [currentStep, setCurrentStep] = useState<'research' | 'populate' | 'ready' | 'idle'>('idle');
  const [isPopulatingCanva, setIsPopulatingCanva] = useState(false);
  
  // User and Canva state
  const [userId, setUserId] = useState<string | null>(null);
  const [canvaConnected, setCanvaConnected] = useState(false);
  const [canvaDesignUrl, setCanvaDesignUrl] = useState<string | null>(null);

  // Slides state
  const [isCreatingSlides, setIsCreatingSlides] = useState(false);

  // Persistent itinerary state
  const [persistedItinerary, setPersistedItinerary] = useState<{
    content: string | null;
    images: Array<{hotelName: string; imageUrl: string | null; contextLink?: string | null}> | null;
    formData: Record<string, string>;
    dateRange: Record<string, unknown>;
    numberOfOptions: number;
    additionalOptions: Option[];
  } | null>(null);

  // Streaming hook - MUST BE BEFORE CONDITIONAL RETURNS
  const { 
    content, 
    images,
    isLoading, 
    isComplete, 
    error, 
    streamItinerary, 
    stopStream, 
    resetStream 
  } = useItineraryStream();

  // All useEffect hooks
  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/signin');
    }
  }, [user, loading, router]);

  // Initialize user on component mount and restore persisted data
  useEffect(() => {
    // Generate a simple user ID for this session (in production, use proper auth)
    const sessionUserId = sessionStorage.getItem('userId') || crypto.randomUUID();
    sessionStorage.setItem('userId', sessionUserId);
    setUserId(sessionUserId);

    // Restore persisted itinerary data from localStorage
    try {
      const savedItinerary = localStorage.getItem('persistedItinerary');
      if (savedItinerary) {
        const parsed = JSON.parse(savedItinerary);
        setPersistedItinerary(parsed);
        
        // Restore form state if we have persisted data
        if (parsed.formData) {
          setFormData(parsed.formData);
        }
        if (parsed.numberOfOptions) {
          setNumberOfOptions(parsed.numberOfOptions);
        }
        if (parsed.additionalOptions) {
          setAdditionalOptions(parsed.additionalOptions);
        }
        if (parsed.content) {
          setShowResults(true);
        }
      }
    } catch (error) {
      console.error('Error loading persisted itinerary:', error);
    }

    // Check for auth callback state
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('code')) {
      // Handle OAuth callback here if needed
    }
    if (urlParams.get('error')) {
      console.error('OAuth error:', urlParams.get('error'));
      // Handle error states here
    }
  }, []);

  // Save itinerary data to localStorage when content changes
  useEffect(() => {
    if (content && isComplete) {
      const dataToSave = {
        content,
        images,
        formData,
        dateRange: dateRange || {},
        numberOfOptions,
        additionalOptions,
        timestamp: Date.now()
      };
      
      try {
        localStorage.setItem('persistedItinerary', JSON.stringify(dataToSave));
        setPersistedItinerary(dataToSave);
      } catch (error) {
        console.error('Error saving itinerary to localStorage:', error);
      }
    }
  }, [content, images, isComplete, formData, dateRange, numberOfOptions, additionalOptions]);

  // Update step when research is complete
  useEffect(() => {
    if (isComplete && currentStep === 'research') {
      setCurrentStep('idle'); // Research complete, waiting for user to click Canva
    }
  }, [isComplete, currentStep]);

  // Memoize the split content to avoid re-calculating on every render
  const itineraryOptions = useMemo(() => {
    // Use current content or persisted content
    const currentContent = content || (persistedItinerary?.content);
    if (!currentContent) return [];
    
    console.log("Content length:", currentContent.length);
    console.log("Content preview:", currentContent.substring(0, 200));
    
    // Clean content before splitting - remove any standalone "Featured Hotel:" lines
    // that appear before the actual options
    let cleanedContent = currentContent
      .replace(/^[\s\S]*?(?=Option 1:)/, '') // Remove everything before "Option 1:"
      .trim();
    
    // Ensure Option 1 has consistent markdown formatting with other options
    // Check if other options have ## formatting and apply it to Option 1 if missing
    if (cleanedContent.includes('## Option 2:') && !cleanedContent.startsWith('## Option 1:')) {
      console.log("🔧 Fixing Option 1 formatting: adding ## header");
      cleanedContent = cleanedContent.replace(/^Option 1:/, '## Option 1:');
    }
    // Or if other options have bold formatting, apply it to Option 1
    else if (cleanedContent.includes('**Option 2:**') && !cleanedContent.startsWith('**Option 1:**')) {
      console.log("🔧 Fixing Option 1 formatting: adding bold formatting");
      cleanedContent = cleanedContent.replace(/^Option 1:/, '**Option 1:**');
    }
    
    console.log("Option 1 starts with:", cleanedContent.substring(0, 50));
    
    // Try different splitting patterns based on common AI output formats
    let options = [];
    
    // Pattern 1: "# Option X:" (single #)
    if (cleanedContent.includes('# Option')) {
      console.log("Found # Option pattern");
      options = cleanedContent.split(/(?=# Option \d+:)/g).filter(part => part.trim().length > 0);
    }
    // Pattern 2: "## Option X:" (with ##)
    else if (cleanedContent.includes('## Option')) {
      console.log("Found ## Option pattern");
      options = cleanedContent.split(/(?=## Option \d+:)/g).filter(part => part.trim().length > 0);
    }
    // Pattern 3: "Option X:" (without #)
    else if (cleanedContent.includes('Option 2:')) {
      console.log("Found Option X: pattern");
      options = cleanedContent.split(/(?=Option \d+:)/g).filter(part => part.trim().startsWith('Option'));
    }
    // Pattern 4: Fallback - if no clear options, return the whole content as one option
    else {
      console.log("Using fallback - whole content");
      options = [cleanedContent];
    }
    
    console.log("Split into", options.length, "options");
    options.forEach((option, index) => {
      console.log(`Option ${index + 1} preview:`, option.substring(0, 100));
    });
    
    return options;
  }, [content, persistedItinerary]);

  // CONDITIONAL RETURNS AFTER ALL HOOKS
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Don't render if not authenticated (will redirect)
  if (!user) {
    return null;
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate required fields
    if (!formData.destination || !formData.departureCity || !dateRange) {
      alert("Please fill in all required fields: destination, departure city, and travel dates.");
      return;
    }


    setShowResults(true);
    setCurrentStep('research');

    // Prepare data for API
    const apiData = {
      destination: formData.destination,
      departureCity: formData.departureCity,
      guests: formData.guests,
      startDate: dateRange.start.toString(),
      endDate: dateRange.end.toString(),
      budgetFrom: formData.budgetFrom,
      budgetTo: formData.budgetTo,
      additionalOptions: additionalOptions.map(opt => opt.label),
      numberOfOptions: numberOfOptions,
    };

    // Start streaming
    streamItinerary(apiData);
  };



  const handleCreateCanvaTemplate = async () => {
    if (!userId) {
      console.error('User ID not available');
      return;
    }

    if (!canvaConnected) {
      // Redirect to OAuth flow
      window.location.href = `/api/auth/canva?user_id=${userId}`;
      return;
    }

    setCurrentStep('populate');
    setIsPopulatingCanva(true);

    try {
      // Call our API to create the Canva design
      const response = await fetch('/api/canva/create-design', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          itineraryData: {
            destination: formData.destination,
            departureCity: formData.departureCity,
            guests: formData.guests,
            dateRange: dateRange ? `${dateRange.start.toString()} - ${dateRange.end.toString()}` : '',
            budget: `£${formData.budgetFrom} - £${formData.budgetTo}`,
            additionalOptions: additionalOptions.map(opt => opt.label),
            content: content,
          },
        }),
      });

      const result = await response.json();

      if (result.success) {
        setCanvaDesignUrl(result.editUrl);
        setCurrentStep('ready');
      } else if (result.needsAuth) {
        // Token expired or not found, redirect to OAuth
        setCanvaConnected(false);
        window.location.href = `/api/auth/canva?user_id=${userId}`;
      } else {
        console.error('Failed to create Canva design:', result.error);
        // Handle error
      }
    } catch (error) {
      console.error('Error creating Canva template:', error);
    } finally {
      setIsPopulatingCanva(false);
    }
  };

  const handleCreateSlides = async () => {
    if (!user) {
      console.error('User not authenticated');
      return;
    }

    const currentContent = content || (persistedItinerary?.content);
    const currentImages = images || (persistedItinerary?.images);
    
    if (!currentContent || !formData.destination) {
      console.error('No content or destination available for slides creation');
      return;
    }

    setIsCreatingSlides(true);

    try {
      // Use Google access token directly
      if (!accessToken) {
        console.error('No Google access token available');
        return;
      }

      const response = await fetch('/api/slides-oauth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          rawItinerary: currentContent,
          destination: formData.destination,
          dates: dateRange ? `${dateRange.start.toString()} – ${dateRange.end.toString()}` : '',
          imageUrl: currentImages && currentImages.length > 0 ? currentImages[0].imageUrl : null,
        }),
      });

      const result = await response.json();

      if (result.success) {
        // Open the slides in a new tab
        window.open(result.presentationUrl, '_blank');
        console.log('✅ Slides created successfully:', result.presentationUrl);
      } else {
        console.error('Failed to create slides:', result.error);
        // Handle error - could show toast notification
      }
    } catch (error) {
      console.error('Error creating slides:', error);
    } finally {
      setIsCreatingSlides(false);
    }
  };

  // USEMEMO HOOK MOVED TO TOP OF COMPONENT - DO NOT ADD HOOKS HERE

  if (showResults) {
  return (
    <DashboardLayout>
      <div className="min-h-screen flex flex-col p-8 pt-12 pl-32">
        <div className="w-full max-w-7xl mx-auto space-y-8">
          
          {/* Header with back button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-between"
        >
            <div>
              <h1 className="text-4xl font-black tracking-tighter text-foreground">
                Your Itinerary Options
          </h1>
              <p className="text-muted-foreground mt-2">
                {formData.guests} {parseInt(formData.guests) === 1 ? 'guest' : 'guests'} • {formData.destination} 
                {dateRange && ` • ${dateRange.start.toString()} - ${dateRange.end.toString()}`}
              </p>
            </div>
            <div className="flex gap-4">
              <Button variant="outline" onClick={() => {
                setShowResults(false);
                resetStream();
                // Clear persisted data when going back to form
                localStorage.removeItem('persistedItinerary');
                setPersistedItinerary(null);
              }}>
                ← Back to Form
              </Button>
              {isLoading && (
                <Button variant="outline" onClick={stopStream}>
                  <AlertCircle className="h-4 w-4 mr-2" />
                  Stop Generation
                </Button>
              )}
            </div>
        </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Left Column - Status & Info */}
        <motion.div
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="space-y-6"
            >
              <Card className="border-border/30 bg-card/30 backdrop-blur-2xl">
            <CardHeader>
                  <CardTitle className="text-xl">Generation Status</CardTitle>
            </CardHeader>
            <CardContent>
                  <StatusStepper 
                    steps={processSteps.map((step) => {
                      if (step.id === 'research') {
                        if (currentStep === 'research' && isLoading) return { ...step, status: "active" as const };
                        if (isComplete) return { ...step, status: "completed" as const };
                        return { ...step, status: "pending" as const };
                      }
                      
                      if (step.id === 'populate') {
                        if (currentStep === 'populate' && isPopulatingCanva) return { ...step, status: "active" as const };
                        if (currentStep === 'ready') return { ...step, status: "completed" as const };
                        return { ...step, status: "pending" as const };
                      }
                      
                      if (step.id === 'ready') {
                        if (currentStep === 'ready') return { ...step, status: "completed" as const };
                        return { ...step, status: "pending" as const };
                      }
                      
                      return { ...step, status: "pending" as const };
                    })} 
                  />
                  
                  {error && (
                    <div className="mt-4 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                      <div className="flex items-center gap-2 text-destructive">
                        <AlertCircle className="h-4 w-4" />
                        <span className="font-medium">Error</span>
                      </div>
                      <p className="text-sm mt-2 text-destructive/90">{error}</p>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="mt-3"
                        onClick={() => streamItinerary({
                          destination: formData.destination,
                          departureCity: formData.departureCity,
                          guests: formData.guests,
                          startDate: dateRange?.start.toString(),
                          endDate: dateRange?.end.toString(),
                          budgetFrom: formData.budgetFrom,
                          budgetTo: formData.budgetTo,
                          additionalOptions: additionalOptions.map(opt => opt.label),
                          numberOfOptions: numberOfOptions,
                        })}
                      >
                        Retry
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
              
              {/* Request Summary */}
              <Card className="border-border/30 bg-card/30 backdrop-blur-2xl">
                <CardHeader>
                  <CardTitle className="text-lg">Your Request</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div><strong>Destination:</strong> {formData.destination}</div>
                  <div><strong>From:</strong> {formData.departureCity}</div>
                  <div><strong>Guests:</strong> {formData.guests}</div>
                  {dateRange && (
                    <div><strong>Dates:</strong> {dateRange.start.toString()} - {dateRange.end.toString()}</div>
                  )}
                  {(formData.budgetFrom || formData.budgetTo) && (
                    <div><strong>Budget:</strong> £{formData.budgetFrom} - £{formData.budgetTo}</div>
                  )}
                  {additionalOptions.length > 0 && (
                    <div><strong>Options:</strong> {additionalOptions.map(opt => opt.label).join(", ")}</div>
                  )}
                  <div><strong>Number of Options:</strong> {numberOfOptions}</div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Right Column - Generated Content */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 }}
              className="lg:col-span-2"
            >
              <Card className="border-border/30 bg-card/30 backdrop-blur-2xl h-[80vh] flex flex-col">
                <CardHeader className="flex flex-row items-center justify-between flex-shrink-0">
                  <div>
                    <CardTitle className="text-xl">Generated Itineraries</CardTitle>
                    <CardDescription>
                      {isLoading && "AI is researching and creating your options..."}
                      {isComplete && currentStep === 'idle' && "Generation complete! Review your options below."}
                      {isComplete && currentStep === 'populate' && "Creating Canva template..."}
                      {currentStep === 'ready' && "Template ready! Download available below."}
                      {error && "Generation failed. Please try again."}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-3">
                    {isLoading && (
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    )}
                    {(isComplete || (content || persistedItinerary?.content)) && (
                      <div className="flex items-center gap-3">
                        <Button 
                          onClick={handleCreateSlides}
                          disabled={isCreatingSlides}
                          variant="outline"
                          className="bg-white text-gray-900 hover:bg-gray-200 hover:text-gray-900 border-gray-300"
                        >
                          {isCreatingSlides ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          ) : (
                            <Image
                              src="/Google_Slides_logo_(2014-2020).svg.webp"
                              alt="Google Slides"
                              width={18}
                              height={18}
                              className="mr-2"
                            />
                          )}
                          {isCreatingSlides ? 'Creating...' : 'Connect to Slides'}
                        </Button>
                      <Button 
                        onClick={handleCreateCanvaTemplate}
                        variant="outline"
                          className="bg-white text-gray-900 hover:bg-gray-200 hover:text-gray-900 border-gray-300"
                        >
                          <Image
                            src="/canva-logo_compressed.webp"
                            alt="Canva"
                            width={24}
                            height={24}
                            className="mr-2"
                          />
                        {canvaConnected ? 'Create Canva Template' : 'Connect to Canva'}
                      </Button>
                      </div>
                    )}
                    {currentStep === 'populate' && isPopulatingCanva && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="text-sm">Creating template...</span>
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="flex-1 overflow-y-auto overflow-x-hidden p-6">
                  {isLoading && !content && (
                    <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                      <Loader2 className="h-8 w-8 animate-spin mb-4" />
                      <p className="text-center">
                        Advanced AI search in progress...<br/>
                        <span className="text-sm opacity-75">Generating comprehensive itinerary with enhanced search results</span>
                      </p>
                    </div>
                  )}
                  
                  {itineraryOptions.map((option, index) => {
                    console.log(`Processing option ${index + 1}:`, option.substring(0, 200));
                    
                    // FIRST: Extract hotel names from ORIGINAL content before any preprocessing
                    let hotelName = null;
                    
                    // Pattern 1: **Featured Hotel**: [Name]
                    let hotelNameMatch = option.match(/\*\*Featured Hotel\*\*:\s*([^\n]+)/);
                    if (hotelNameMatch) {
                      hotelName = hotelNameMatch[1].trim();
                      console.log(`Found hotel via Featured Hotel pattern: ${hotelName}`);
                    }
                    
                    // Pattern 2: **Hotel/Resort**: [Name] – [description]
                    if (!hotelName) {
                      hotelNameMatch = option.match(/\*\*Hotel\/Resort\*\*:\s*([^–\n]+)/);
                      if (hotelNameMatch) {
                        hotelName = hotelNameMatch[1].trim();
                        console.log(`Found hotel via Hotel/Resort pattern: ${hotelName}`);
                      }
                    }
                    
                    // Pattern 3: Extract from "Hotel:" line in accommodation details
                    if (!hotelName) {
                      hotelNameMatch = option.match(/\*\*Hotel\*\*:\s*([^\n]+)/);
                      if (hotelNameMatch) {
                        hotelName = hotelNameMatch[1].trim();
                        console.log(`Found hotel via Hotel pattern: ${hotelName}`);
                      }
                    }
                    
                    // Pattern 4: Look for hotel names from backend images
                    const currentImages = images || (persistedItinerary?.images);
                    if (!hotelName && currentImages && currentImages[index]) {
                      hotelName = currentImages[index].hotelName;
                      console.log(`Using hotel name from backend: ${hotelName}`);
                    }
                    
                    // Clean up the hotel name for better matching
                    if (hotelName) {
                      hotelName = hotelName.replace(/^["']|["']$/g, ''); // Remove quotes
                      hotelName = hotelName.replace(/\s*—.*$/, ''); // Remove everything after em dash
                      hotelName = hotelName.trim();
                      console.log(`Cleaned hotel name: ${hotelName}`);
                    }
                    
                    // Find the corresponding image with fuzzy matching
                    let image = null;
                    if (currentImages && currentImages.length > 0) {
                      console.log(`Available images:`, currentImages.map(img => img.hotelName));
                      
                      if (hotelName) {
                        // Try exact match first
                        image = currentImages.find(img => img.hotelName === hotelName);
                        console.log(`Exact match result:`, image ? 'found' : 'not found');
                        
                        // If no exact match, try partial matching
                        if (!image) {
                          image = currentImages.find(img => 
                            img.hotelName.toLowerCase().includes(hotelName.toLowerCase()) || 
                            hotelName.toLowerCase().includes(img.hotelName.toLowerCase())
                          );
                          console.log(`Partial match result:`, image ? 'found' : 'not found');
                        }
                      }
                      
                      // If still no match, use the image at the same index
                      if (!image && currentImages[index]) {
                        image = currentImages[index];
                        console.log(`Using image at index ${index}:`, image.hotelName);
                      }
                    }
                    
                    console.log(`Final image for option ${index + 1}:`, image ? image.hotelName : 'none');
                    
                    return <ItineraryOption key={index} optionContent={option} image={image || null} />;
                  })}
                  
                  {currentStep === 'ready' && (content || persistedItinerary?.content) && (
                    <div className="mt-6 pt-6 border-t border-border/30 space-y-3">
                      {canvaDesignUrl && (
                        <Button 
                          className="w-full" 
                          variant="outline"
                          onClick={() => window.open(canvaDesignUrl, '_blank')}
                        >
                          Open in Canva Editor
                        </Button>
                      )}
                      <Button className="w-full" variant="premium">
                        <Download className="h-4 w-4 mr-2" />
                        Download PDF
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

          

  return (
    <DashboardLayout>
      <div 
        className="h-screen relative overflow-hidden"
        style={{
          backgroundImage: 'url(/itinerary-page-background.webp)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          backgroundAttachment: 'fixed'
        }}
      >
        {/* Overlay for better text readability */}
        <div className="absolute inset-0 bg-black/40"></div>
        
        <div className="relative z-10 h-screen flex">
          {/* Left side - Title and Past Itineraries */}
          <div className="flex flex-col justify-center pl-32 pr-8">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
            >
              <div>
                <h1 className="text-5xl md:text-6xl font-black tracking-tighter text-white drop-shadow-2xl">
                  Create Itinerary
                </h1>
                <div className="w-24 h-1 bg-white/60 mt-3 rounded-full"></div>
                
                {/* Past Itineraries Button - Below title */}
                <Link href="/itineraries">
                <motion.button
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="mt-4 px-6 py-3 bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 rounded-full text-white/90 font-medium text-sm transition-all duration-300 hover:scale-105"
                >
                  Past Itineraries
                </motion.button>
                </Link>
              </div>
            </motion.div>
          </div>

          {/* Right side - Form Container - Perfectly Centered */}
          <div className="flex-1 flex items-center justify-center pr-16">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="w-full max-w-2xl"
            >
              <Card className="border-white/20 bg-black/20 backdrop-blur-3xl shadow-2xl">
              <CardContent className="p-6">
                <form onSubmit={handleSubmit} className="space-y-6">
                  
                  {/* Top Row - Destination & Departure */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                      <Label className="text-sm font-semibold text-white/90 uppercase tracking-wide">Where to?</Label>
                      <Input
                        placeholder="Tokyo, Maldives, Swiss Alps..."
                        value={formData.destination}
                        onChange={(e) => setFormData({ ...formData, destination: e.target.value })}
                        className=""
                      />
                </div>

                  <div className="space-y-2">
                      <Label className="text-sm font-semibold text-white/90 uppercase tracking-wide">From</Label>
                      <Input
                        placeholder="London, New York, Dubai..."
                        value={formData.departureCity}
                        onChange={(e) => setFormData({ ...formData, departureCity: e.target.value })}
                        className=""
                      />
                  </div>
                </div>

                  {/* Middle Row - Guests & Dates */}
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                    {/* Guests */}
                    <div className="md:col-span-4 space-y-2">
                      <Label className="text-sm font-semibold text-white/90 uppercase tracking-wide">Guests</Label>
                      <Input
                        placeholder="2 guests"
                        value={formData.guests}
                        onChange={(e) => setFormData({ ...formData, guests: e.target.value })}
                        className=""
                      />
                    </div>

                    {/* Travel Dates */}
                    <div className="md:col-span-8 space-y-2">
                      <Label className="text-sm font-semibold text-white/90 uppercase tracking-wide">When?</Label>
                      <div className="w-full">
                        <JollyDateRangePicker
                          value={dateRange}
                          onChange={setDateRange}
                          className="w-full"
                          label=""
                          description=""
                        />
                      </div>
                    </div>
                  </div>

                  {/* Budget Row */}
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold text-white/90 uppercase tracking-wide">Budget Range</Label>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <Label className="text-xs text-white/70">From</Label>
                        <Input
                          placeholder="£5,000"
                          value={formData.budgetFrom}
                          onChange={(e) => setFormData({ ...formData, budgetFrom: e.target.value })}
                          className=""
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-white/70">To</Label>
                      <Input
                          placeholder="£15,000"
                          value={formData.budgetTo}
                          onChange={(e) => setFormData({ ...formData, budgetTo: e.target.value })}
                          className=""
                        />
                      </div>
                  </div>
                </div>

                  {/* Additional Options */}
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold text-white/90 uppercase tracking-wide">Additional Options</Label>
                    <MultipleSelector
                      defaultOptions={additionalOptionsData}
                      placeholder="Select amenities..."
                      value={additionalOptions}
                      onChange={setAdditionalOptions}
                      emptyIndicator={<p className="text-center text-sm text-muted-foreground">No options found</p>}
                      className={`${additionalOptions.length > 4 ? 'min-h-[120px]' : additionalOptions.length > 0 ? 'min-h-[80px]' : 'h-14'}`}
                      badgeClassName="bg-primary/10 text-primary border-primary/20 hover:bg-primary/15"
                    />
                  </div>

                  {/* Submit Button Row */}
                  <div className="pt-1 flex items-center justify-between">
                    {/* Number of Options Slider */}
                    <div className="flex items-center space-x-3">
                      <Label className="text-sm font-semibold text-white/90 uppercase tracking-wide whitespace-nowrap">
                        No. of Options
                      </Label>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs text-white/70 w-3">{numberOfOptions}</span>
                        <input
                          type="range"
                          min="1"
                          max="5"
                          value={numberOfOptions}
                          onChange={(e) => setNumberOfOptions(parseInt(e.target.value))}
                          className="slider w-16 h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer"
                        />
                        <span className="text-xs text-white/50">5</span>
                      </div>
                    </div>

                    {/* Submit Button */}
                    <div className="relative">
                      {/* Glassmorphism background pill */}
                      <div className="absolute inset-0 bg-white/10 dark:bg-white/5 backdrop-blur-xl rounded-full transform scale-110 -z-10"></div>
                      
                      <motion.button
                        type="submit"
                        disabled={isLoading || !formData.destination || !dateRange}
                        className="px-8 h-12 text-base font-bold tracking-wide rounded-full bg-gradient-to-r from-white via-gray-50 to-white shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-200/50 btn-3d text-gray-900 disabled:opacity-50"
                        whileHover="hover"
                        initial="initial"
                      >
                        <motion.div
                          className="flex items-center"
                          variants={{
                            initial: {},
                            hover: {}
                          }}
                        >
                          {isLoading ? (
                            <>
                              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                              Generating...
                            </>
                          ) : (
                            <>
                              Create itinerary
                              <motion.img
                                src="/aboveandbeyond-ai-icon-logo.svg"
                                alt="Beyond AI Icon"
                                className="ml-2 h-5 w-5"
                                style={{ filter: 'brightness(0)' }}
                                variants={{
                                  initial: { rotate: 0 },
                                  hover: { rotate: 360 }
                                }}
                                transition={{ 
                                  duration: 0.5, 
                                  ease: [0.175, 0.885, 0.32, 1.275]
                                }}
                              />
                            </>
                          )}
                        </motion.div>
                      </motion.button>
                        </div>
                      </div>
                </form>
                    </CardContent>
                  </Card>
                </motion.div>
          </div>
            </div>
      </div>
    </DashboardLayout>
  );
}

export default function ItineraryPage() {
  return <ItineraryPageContent />;
}
