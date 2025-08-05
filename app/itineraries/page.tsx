'use client'

import React, { useEffect, useState } from 'react'
import { DashboardLayout } from '@/components/dashboard-layout'
import { ProtectedRoute } from '@/components/protected-route'
import { useGoogleAuth } from '@/components/google-auth-provider'
import { getItinerariesByUser } from '@/lib/database'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Calendar, MapPin, Users, Plane, Eye, Trash2, Plus } from 'lucide-react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { formatDistanceToNow } from 'date-fns'

type Itinerary = {
  id: string
  title: string
  destination: string
  departure_city: string
  guests: number
  start_date: string
  end_date: string
  status: 'generating' | 'generated' | 'error'
  canva_design_url?: string
  slides_presentation_url?: string
  created_at: string
}

function ItinerariesPageContent() {
  const { user } = useGoogleAuth()
  const [itineraries, setItineraries] = useState<Itinerary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchItineraries = async () => {
      if (!user) return

      try {
        const userItineraries = await getItinerariesByUser(user.id)
        setItineraries(userItineraries)
      } catch (err) {
        console.error('Error fetching itineraries:', err)
        setError('Failed to load itineraries')
      } finally {
        setLoading(false)
      }
    }

    fetchItineraries()
  }, [user])

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

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading your itineraries...</p>
        </div>
      </div>
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
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-black tracking-tighter text-foreground">
                Your Itineraries
              </h1>
              <p className="text-muted-foreground mt-2">
                Manage and access all your luxury travel itineraries
              </p>
            </div>
            <Link href="/itinerary">
              <Button size="lg" variant="premium">
                <Plus className="h-4 w-4 mr-2" />
                Create New
              </Button>
            </Link>
          </div>
        </motion.div>

        {/* Error State */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6"
          >
            <Card className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950">
              <CardContent className="p-6">
                <p className="text-red-800 dark:text-red-200">{error}</p>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Empty State */}
        {!loading && !error && itineraries.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-12"
          >
            <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-muted flex items-center justify-center">
              <Plane className="h-12 w-12 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-semibold mb-2">No itineraries yet</h3>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Start creating your first luxury travel itinerary and it will appear here.
            </p>
            <Link href="/itinerary">
              <Button size="lg" variant="premium">
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Itinerary
              </Button>
            </Link>
          </motion.div>
        )}

        {/* Itineraries Grid */}
        {itineraries.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {itineraries.map((itinerary, index) => (
              <motion.div
                key={itinerary.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Card className="hover:shadow-lg transition-shadow duration-200">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-lg mb-2 line-clamp-2">
                          {itinerary.title || `${itinerary.destination} Trip`}
                        </CardTitle>
                        <Badge className={getStatusColor(itinerary.status)}>
                          {itinerary.status}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Trip Details */}
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">From:</span>
                        <span>{itinerary.departure_city}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Plane className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">To:</span>
                        <span className="font-medium">{itinerary.destination}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Guests:</span>
                        <span>{itinerary.guests}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Dates:</span>
                        <span>{formatDate(itinerary.start_date)} - {formatDate(itinerary.end_date)}</span>
                      </div>
                    </div>

                    {/* External Links */}
                    {(itinerary.canva_design_url || itinerary.slides_presentation_url) && (
                      <div className="flex gap-2 text-xs">
                        {itinerary.canva_design_url && (
                          <Badge variant="outline">Canva Ready</Badge>
                        )}
                        {itinerary.slides_presentation_url && (
                          <Badge variant="outline">Slides Ready</Badge>
                        )}
                      </div>
                    )}

                    {/* Metadata */}
                    <div className="text-xs text-muted-foreground">
                      Created {formatDistanceToNow(new Date(itinerary.created_at), { addSuffix: true })}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 pt-2">
                      <Link href={`/itinerary/${itinerary.id}`} className="flex-1">
                        <Button variant="outline" size="sm" className="w-full">
                          <Eye className="h-4 w-4 mr-2" />
                          View
                        </Button>
                      </Link>
                      {itinerary.canva_design_url && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(itinerary.canva_design_url, '_blank')}
                        >
                          Canva
                        </Button>
                      )}
                      {itinerary.slides_presentation_url && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(itinerary.slides_presentation_url, '_blank')}
                        >
                          Slides
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>
    </DashboardLayout>
  )
}

export default function ItinerariesPage() {
  return (
    <ProtectedRoute>
      <ItinerariesPageContent />
    </ProtectedRoute>
  )
}