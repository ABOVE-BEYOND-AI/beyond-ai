// Type definitions for our Google Auth + Redis system

export interface GoogleUser {
  id: string
  email: string
  name: string
  picture: string
  given_name?: string
  family_name?: string
}

export type UserRole = 'admin' | 'finance' | 'member' | 'viewer'

export interface User {
  email: string
  name: string
  avatar_url: string
  role: UserRole
  created_at: string
  updated_at: string
}

// Persistent token storage — stored separately from short-lived sessions
export interface StoredTokens {
  google_refresh_token?: string
  google_access_token?: string
  google_token_expires_at?: number
  google_scopes?: string
  canva_access_token?: string
  canva_refresh_token?: string
  canva_token_expires_at?: number
  canva_scopes?: string
}

export interface Integration {
  service: 'google' | 'canva' | 'slack' | 'xero'
  connected: boolean
  email?: string
  scopes?: string[]
  connected_at?: string
  expires_at?: number
}

// ── Xero Types ──

export interface XeroOrgTokens {
  access_token: string
  refresh_token: string
  expires_at: number // ms timestamp
  tenant_id: string
  connected_by: string // admin email who connected
  connected_at: string // ISO string
}

export interface XeroInvoice {
  InvoiceID: string
  InvoiceNumber: string
  Type: 'ACCREC' | 'ACCPAY'
  Contact: { ContactID: string; Name: string }
  DueDate: string
  Date: string
  Status: string
  AmountDue: number
  AmountPaid: number
  Total: number
  SubTotal: number
  Reference: string
  CurrencyCode: string
  HasAttachments: boolean
  LineItems: XeroLineItem[]
}

export interface XeroLineItem {
  LineItemID: string
  Description: string
  Quantity: number
  UnitAmount: number
  LineAmount: number
  AccountCode: string
  Tracking: { Name: string; Option: string }[]
}

export interface XeroContact {
  ContactID: string
  Name: string
  FirstName?: string
  LastName?: string
  EmailAddress: string
  ContactPersons: { FirstName: string; LastName: string; EmailAddress: string; IncludeInEmails: boolean }[]
  Phones: { PhoneType: string; PhoneNumber: string; PhoneAreaCode: string; PhoneCountryCode: string }[]
  Addresses: { AddressType: string; AddressLine1: string; City: string; Region: string; PostalCode: string; Country: string }[]
  ContactStatus: string
  IsCustomer: boolean
  IsSupplier: boolean
  Balances?: {
    AccountsReceivable: { Outstanding: number; Overdue: number }
    AccountsPayable: { Outstanding: number; Overdue: number }
  }
}

export interface XeroBankAccount {
  AccountID: string
  Name: string
  Code: string
  Type: string
  BankAccountNumber?: string
  CurrencyCode: string
}

export interface XeroHistoryRecord {
  Details: string
  DateUTC: string
  User: string
  Changes: string
}

export type ChaseStageKey =
  | '1-3_days_xero_reminder'
  | '3-5_days_finance_email'
  | '8_days_process_email'
  | '10_days_process_email'
  | 'daily_chaser'
  | 'final_warning'
  | 'cancellation_terms'
  | 'bolt_on'

export interface ChaseStageConfig {
  key: ChaseStageKey
  label: string
  color: string       // tailwind bg class
  textColor: string   // tailwind text class
  description: string
}

export interface ChaseStageData {
  stage: ChaseStageKey
  updatedAt: string
  updatedBy: string
}

export interface ChaseActivity {
  id: string
  invoiceId: string
  action: 'stage_change' | 'note' | 'payment_recorded' | 'email_sent'
  detail: string
  timestamp: string
  user: string
}

export interface EnrichedInvoice extends XeroInvoice {
  contactEmail: string
  contactPhone?: string
  daysOverdue: number
  chaseStage?: ChaseStageData
  lastActivity?: ChaseActivity
  creditAvailable?: number // unallocated credit for this contact
  eventDate?: string // nearest event date from Salesforce
  eventName?: string // event name from Salesforce
  weeksToEvent?: number // weeks until the event
}

// ── Xero Credit Note Types ──

export interface XeroCreditNote {
  CreditNoteID: string
  CreditNoteNumber: string
  Type: 'ACCRECCREDIT' | 'ACCPAYCREDIT'
  Status: string
  Contact: { ContactID: string; Name: string }
  Date: string
  Total: number
  RemainingCredit: number
  CurrencyCode: string
  Allocations: { Amount: number; Date: string; Invoice: { InvoiceID: string; InvoiceNumber: string } }[]
}

// ── Payment Plan (derived from Xero partial payments) ──

export interface PaymentPlanInvoice {
  invoiceId: string
  invoiceNumber: string
  contactName: string
  contactEmail: string
  total: number
  amountPaid: number
  amountDue: number
  percentagePaid: number
  dueDate: string
  date: string
  reference: string
}

// ── Stripe Types (for frontend) ──

export interface StripePaymentMethodInfo {
  id: string
  brand: string
  last4: string
  expMonth: number
  expYear: number
  isDefault: boolean
}

export interface Itinerary {
  id: string
  user_email: string
  title: string
  destination: string
  departure_city: string
  guests: number
  start_date: string
  end_date: string
  budget_from?: number
  budget_to?: number
  number_of_options: number
  additional_options: string[]
  raw_content?: string
  processed_content?: string | object
  images?: Array<{
    imageUrl: string
    hotelName: string
  }>
  status: 'generating' | 'generated' | 'error'
  canva_design_url?: string
  
  // Legacy slides field (keep for backwards compatibility)
  slides_presentation_url?: string
  
  // NEW: Enhanced slides data for Phase 3.2+
  slides_presentation_id?: string    // Google Slides file ID
  slides_embed_url?: string          // iframe embed URL  
  slides_edit_url?: string           // Google Slides edit URL
  slides_created_at?: string         // timestamp when slides were created
  pdf_ready?: boolean                // PDF export availability
  current_slide_position?: number    // for navigation persistence
  
  created_at: string
  updated_at: string
}

export interface GoogleTokens {
  access_token: string
  refresh_token?: string
  expires_at?: number
  token_type: string
  scope: string
}

export interface AuthSession {
  user: GoogleUser
  tokens: GoogleTokens
  expires_at: number
}

// Sales Dashboard Types
export interface Deal {
  id: string
  slack_ts: string  // Slack message timestamp for duplicate detection
  rep_name: string
  rep_email: string
  deal_name: string
  amount: number  // Amount in GBP (pounds)
  currency: string  // e.g., 'GBP', 'USD'
  created_at: string
  updated_at: string
  slack_channel_id?: string
  slack_message_url?: string
  source: 'slack' | 'manual' | 'api'  // Track data source
}

export interface SalesRep {
  email: string
  name: string
  total_deals: number
  total_amount: number  // Total sales in pounds
  monthly_deals: number
  monthly_amount: number
  rank?: number  // Position in leaderboard
  last_deal_at?: string
}

export interface MonthlySalesStats {
  month: string  // Format: 'YYYY-MM'
  total_deals: number
  total_amount: number  // Total sales in pounds
  target_amount: number  // Monthly target in pounds
  completion_percentage: number
  top_reps: SalesRep[]
  created_at: string
  updated_at: string
}

export interface SalesDashboardData {
  current_month: MonthlySalesStats
  previous_month?: MonthlySalesStats
  recent_deals: Deal[]
  leaderboard: SalesRep[]
  monthly_target: number
  progress_percentage: number
}

// Events Calendar Types
export interface EventItem {
  id: string
  name: string
  startDate: string // ISO date string (UTC) at 00:00:00
  endDate: string // ISO date string (UTC) at 23:59:59 for inclusive ranges
  location: string
  description: string
  category: string // normalized slug e.g., formula-1
  imageUrl?: string
  created_at: string
  updated_at: string
}