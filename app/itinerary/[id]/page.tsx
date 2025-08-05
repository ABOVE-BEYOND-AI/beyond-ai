'use client'

export const dynamic = 'force-dynamic'

import React, { useEffect, useState, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { DashboardLayout } from '@/components/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { useGoogleAuth } from '@/components/google-auth-provider-clean'
import { getItinerary } from '@/lib/redis-database'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Calendar, MapPin, Users, Plane, ExternalLink, Download } from 'lucide-react'
import { motion } from 'framer-motion'
import ReactMarkdown from 'react-markdown'
import Image from 'next/image'

type Itinerary = {
  id: string
  title: string
  destination: string
  departure_city: string
  guests: number
  start_date: string
  end_date: string
  budget_from?: number
  budget_to?: number
  raw_content?: string
  processed_content?: unknown
  images?: unknown[]
  status: 'generating' | 'generated' | 'error'
  canva_design_url?: string
  slides_presentation_url?: string
  created_at: string
}

// Component to render each itinerary option with its image
interface ItineraryOptionProps {
  optionContent: string
  image: {
    hotelName: string
    imageUrl: string | null
    contextLink?: string | null
  } | null
}

const ItineraryOption: React.FC<ItineraryOptionProps> = ({ optionContent, image }) => {
  // Clean content by removing "Images" section
  const cleanedContent = optionContent.replace(/#+\s*Images[\s\S]*?(?=\n#+|\n\*\*|\n-|$)/gi, '');

  return (
    <div className="space-y-6 border-b border-border/30 pb-8 last:border-b-0">
      <div className="prose prose-slate dark:prose-invert max-w-none">
        <ReactMarkdown>
          {cleanedContent}
        </ReactMarkdown>
      </div>
      
      {image && image.imageUrl && (
        <div className="space-y-2">
          <div className="relative w-full h-96 rounded-lg overflow-hidden">
            <Image
              src={image.imageUrl}
              alt={image.hotelName}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 70vw"
            />
          </div>
          <hr className="border-border/30" />
        </div>
      )}
    </div>
  )
}

function ItineraryViewPageContent() {
  const params = useParams()
  const router = useRouter()
  const { user } = useGoogleAuth()
  const [itinerary, setItinerary] = useState<Itinerary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const itineraryId = params.id as string

  useEffect(() => {
    const fetchItinerary = async () => {
      if (!user || !itineraryId) return

      try {
        const data = await getItinerary(itineraryId)
        if (!data) {
          setError('Itinerary not found')
          return
        }
        setItinerary(data)
      } catch (err) {
        console.error('Error fetching itinerary:', err)
        setError('Failed to load itinerary')
      } finally {
        setLoading(false)
      }
    }

    fetchItinerary()
  }, [user, itineraryId])

  // Process the itinerary content into options
  const itineraryOptions = useMemo(() => {
    if (!itinerary?.raw_content) return []
    
    const content = itinerary.raw_content
    
    // Clean content before splitting
    const cleanedContent = content
      .replace(/^[\s\S]*?(?=Option 1:)/, '') // Remove everything before "Option 1:"
      .trim()
    
    // Try different splitting patterns
    let options = []
    
    if (cleanedContent.includes('# Option')) {
      options = cleanedContent.split(/(?=# Option \d+:)/g).filter(part => part.trim().length > 0)
    } else if (cleanedContent.includes('## Option')) {
      options = cleanedContent.split(/(?=## Option \d+:)/g).filter(part => part.trim().length > 0)
    } else if (cleanedContent.includes('Option 2:')) {
      options = cleanedContent.split(/(?=Option \d+:)/g).filter(part => part.trim().startsWith('Option'))
    } else {
      options = [cleanedContent]
    }
    
    return options
  }, [itinerary?.raw_content])

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'generated':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
      case 'generating':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
      case 'error':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading itinerary...</p>
        </div>
      </div>
    )
  }

  if (error || !itinerary) {
    return (
      <DashboardLayout>
        <div className="p-6 lg:p-12 pl-32">
          <div className="text-center py-12">
            <h1 className="text-2xl font-bold mb-4">Itinerary Not Found</h1>
            <p className="text-muted-foreground mb-6">{error || 'The requested itinerary could not be found.'}</p>
            <Button onClick={() => router.push('/itineraries')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Itineraries
            </Button>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="p-6 lg:p-12 pl-32">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center gap-4 mb-6">
            <Button
              variant="outline"
              onClick={() => router.push('/itineraries')}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Itineraries
            </Button>
            <Badge className={getStatusColor(itinerary.status)}>
              {itinerary.status}
            </Badge>
          </div>
          
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h1 className="text-4xl font-black tracking-tighter text-foreground mb-4">
                {itinerary.title || `${itinerary.destination} Trip`}
              </h1>
              
              {/* Trip Overview */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <div className="flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">From</p>
                    <p className="font-medium">{itinerary.departure_city}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Plane className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">To</p>
                    <p className="font-medium">{itinerary.destination}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Guests</p>
                    <p className="font-medium">{itinerary.guests}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Dates</p>
                    <p className="font-medium text-sm">
                      {formatDate(itinerary.start_date)} - {formatDate(itinerary.end_date)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Budget */}
              {(itinerary.budget_from || itinerary.budget_to) && (
                <div className="mb-6">
                  <p className="text-sm text-muted-foreground">Budget</p>
                  <p className="font-medium">
                    £{itinerary.budget_from?.toLocaleString()} - £{itinerary.budget_to?.toLocaleString()}
                  </p>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              {itinerary.canva_design_url && (
                <Button
                  variant="outline"
                  onClick={() => window.open(itinerary.canva_design_url, '_blank')}
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Open in Canva
                </Button>
              )}
              {itinerary.slides_presentation_url && (
                <Button
                  variant="outline"
                  onClick={() => window.open(itinerary.slides_presentation_url, '_blank')}
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Open Slides
                </Button>
              )}
              <Button variant="outline">
                <Download className="h-4 w-4 mr-2" />
                Download PDF
              </Button>
            </div>
          </div>
        </motion.div>

        {/* Itinerary Content */}
        {itinerary.status === 'generated' && itinerary.raw_content && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card>
              <CardHeader>
                <CardTitle>Itinerary Details</CardTitle>
                <CardDescription>
                  Your personalized luxury travel experience
                </CardDescription>
              </CardHeader>
              <CardContent className="prose prose-slate dark:prose-invert max-w-none">
                {itineraryOptions.map((option, index) => {
                  // Try to find matching image for this option
                  const imageData = itinerary.images && itinerary.images[index] ? itinerary.images[index] : null
                  
                  // Type guard to ensure image has the correct structure
                  const image = imageData && 
                    typeof imageData === 'object' && 
                    'hotelName' in imageData && 
                    'imageUrl' in imageData 
                      ? imageData as { hotelName: string; imageUrl: string | null; contextLink?: string | null }
                      : null
                  
                  return (
                    <ItineraryOption
                      key={index}
                      optionContent={option}
                      image={image}
                    />
                  )
                })}
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Loading/Error States */}
        {itinerary.status === 'generating' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card>
              <CardContent className="p-12 text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-muted-foreground">Your itinerary is being generated...</p>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {itinerary.status === 'error' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950">
              <CardContent className="p-12 text-center">
                <p className="text-red-800 dark:text-red-200 mb-4">
                  There was an error generating this itinerary.
                </p>
                <Button variant="outline" onClick={() => router.push('/itinerary')}>
                  Create New Itinerary
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </div>
    </DashboardLayout>
  )
}

export default function ItineraryViewPage() {
  return (
    <ProtectedRoute>
      <ItineraryViewPageContent />
    </ProtectedRoute>
  )
}