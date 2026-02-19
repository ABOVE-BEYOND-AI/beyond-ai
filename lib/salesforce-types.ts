// Salesforce object TypeScript interfaces
// Matches the actual field API names from the org

// ── Lead ──

export interface SalesforceLead {
  Id: string
  Name: string
  FirstName: string | null
  LastName: string
  Email: string | null
  Phone: string | null
  MobilePhone: string | null
  Company: string | null
  Title: string | null
  Status: string
  LeadSource: string | null
  Rating: string | null
  Score__c: number | null
  Event_of_Interest__c: string | null
  Interests__c: string | null
  No_of_Guests__c: number | null
  Form_Comments__c: string | null
  Form_Type__c: string | null
  Recent_Note__c: string | null
  Tags__c: string | null
  Unqualified_Reason__c: string | null
  Last_Event_Booked__c: string | null
  Web_to_Lead_Created__c: boolean
  Web_to_Lead_Page_Information__c: string | null
  // Interest category checkboxes
  Formula_1__c: boolean
  Football__c: boolean
  Rugby__c: boolean
  Tennis__c: boolean
  Live_Music__c: boolean
  Culinary__c: boolean
  Luxury_Lifestyle_Celebrity__c: boolean
  Unique_Experiences__c: boolean
  Other__c: boolean
  // Social
  LinkedIn__c: string | null
  Facebook__c: string | null
  Twitter__c: string | null
  // Dates
  CreatedDate: string
  LastModifiedDate: string
  LastActivityDate: string | null
  FirstCallDateTime: string | null
  FirstEmailDateTime: string | null
  // Owner
  OwnerId: string
  Owner: { Name: string; Email?: string } | null
  // Consent
  I_agree_to_be_emailed__c: boolean
  HasOptedOutOfEmail: boolean
  Newsletter_Subscribed__c: boolean
}

// ── Opportunity (extended from existing SalesforceOpportunity) ──

export interface SalesforceOpportunityFull {
  Id: string
  Name: string
  StageName: string
  CloseDate: string
  Amount: number | null
  Gross_Amount__c: number | null
  Service_Charge__c: number | null
  Processing_Fee__c: number | null
  Tax_Amount__c: number | null
  // Account & Contact
  AccountId: string | null
  Account: { Name: string } | null
  Opportunity_Contact__c: string | null
  Opportunity_Contact__r: { Name: string; Id: string } | null
  // Event
  Event__c: string | null
  Event__r: { Name: string; Category__c?: string; Start_Date__c?: string } | null
  // Package
  Package_Sold__c: string | null
  Package_Sold__r: { Name: string } | null
  // Guests & Payment
  Total_Number_of_Guests__c: number | null
  Percentage_Paid__c: number | null
  Payment_Progress__c: string | null
  Total_Amount_Paid__c: number | null
  Total_Balance__c: number | null
  Total_Payments_Due__c: number | null
  // Details
  Commission_Amount__c: number | null
  NextStep: string | null
  Special_Requirements__c: string | null
  Is_New_Business__c: boolean
  LeadSource: string | null
  Sign_Request_Complete__c: boolean
  Loss_Reason__c: string | null
  // Owner
  OwnerId: string
  Owner: { Name: string; Email?: string } | null
  // Dates
  CreatedDate: string
  LastModifiedDate: string
  LastActivityDate: string | null
}

// ── Event__c ──

export interface SalesforceEvent {
  Id: string
  Name: string
  Category__c: string | null
  Start_Date__c: string | null
  End_Date__c: string | null
  Start_Time__c: string | null
  End_Time__c: string | null
  Location__c: string | null
  Location__r: { Name: string } | null
  // Revenue
  Revenue_Target__c: number | null
  Sum_of_Closed_Won_Gross__c: number | null
  Percentage_to_Target__c: number | null
  Revenue_Progress__c: string | null
  Margin_Percentage__c: number | null
  Total_Margin_Value__c: number | null
  // Costs
  Total_Booking_Cost__c: number | null
  Total_Staff_Costs__c: number | null
  Total_Payments_Received__c: number | null
  // Ticket inventory - each type has booked/required/remaining
  Event_Tickets_Required__c: number | null
  Event_Tickets_Booked__c: number | null
  Event_Tickets_Remaining__c: number | null
  Hospitality_Tickets_Required__c: number | null
  Hospitality_Tickets_Booked__c: number | null
  Hospitality_Tickets_Remaining__c: number | null
  Hotel_Tickets_Required__c: number | null
  Hotel_Tickets_Booked__c: number | null
  Hotel_Tickets_Remaining__c: number | null
  Dinner_Tickets_Required__c: number | null
  Dinner_Tickets_Booked__c: number | null
  Dinner_Tickets_Remaining__c: number | null
  Drinks_Tickets_Required__c: number | null
  Drinks_Tickets_Booked__c: number | null
  Drinks_Tickets_Remaining__c: number | null
  Party_Tickets_Required__c: number | null
  Party_Tickets_Booked__c: number | null
  Party_Tickets_Remaining__c: number | null
  Inbound_Flight_Tickets_Required__c: number | null
  Inbound_Flight_Tickets_Booked__c: number | null
  Inbound_Flights_Tickets_Remaining__c: number | null
  Outbound_Flight_Tickets_Required__c: number | null
  Outbound_Flight_Tickets_Booked__c: number | null
  Outbound_Flights_Tickets_Remaining__c: number | null
  Inbound_Transfer_Tickets_Required__c: number | null
  Inbound_Transfer_Tickets_Booked__c: number | null
  Inbound_Transfer_Tickets_Remaining__c: number | null
  Outbound_Transfer_Tickets_Required__c: number | null
  Outbound_Transfer_Tickets_Booked__c: number | null
  Outbound_Transfer_Tickets_Remaining__c: number | null
  // Totals
  Total_Tickets_Required__c: number | null
  Total_Tickets_Booked__c: number | null
  Total_Tickets_Remaining__c: number | null
  Percentage_Reservations_Completion__c: number | null
  // Operations
  Total_Projects__c: number | null
  A_B_On_Site_1__c: string | null
  A_B_On_Site_2__c: string | null
  // Images
  Event_Image_1__c: string | null
  Master_Package_Code__c: string | null
}

// ── Contact ──

export interface SalesforceContact {
  Id: string
  Name: string
  FirstName: string | null
  LastName: string
  Email: string | null
  Phone: string | null
  MobilePhone: string | null
  AccountId: string | null
  Account: { Name: string; Type?: string; Industry?: string } | null
  Title: string | null
  LeadSource: string | null
  LinkedIn__c: string | null
  Facebook__c: string | null
  Twitter__c: string | null
  Total_Spend_to_Date__c: number | null
  Total_Won_Opportunities__c: number | null
  Tags__c: string | null
  Interests__c: string | null
  Recent_Note__c: string | null
  Score__c: number | null
  Work_Email__c: string | null
  Secondary_Email__c: string | null
  OwnerId: string
  Owner: { Name: string } | null
  CreatedDate: string
  LastActivityDate: string | null
}

// ── A+B Note ──

export interface ABNote {
  Id: string
  Name: string
  Body__c: string | null
  OwnerId: string
  Owner: { Alias: string } | null
  CreatedDate: string
}

// ── Target__c ──

export interface SalesforceTarget {
  Id: string
  Name: string
  Target_Amount__c: number | null
  OwnerId: string
  Owner: { Name: string } | null
  Type__c: string | null
  Month__c: string | null
  Year__c: string | null
  Days_Absent__c: number | null
}

// ── Commission__c ──

export interface SalesforceCommission {
  Id: string
  Name: string
  Sales_Person__c: string | null
  Sales_Person__r: { Name: string } | null
  Total_Monthly_commission__c: number | null
  Commission_Rate_Applicable__c: number | null
  Gross_Amount_Moved_to_Agreement_Signed__c: number | null
  KPI_Targets__c: number | null
  KPI_Targets_Met__c: boolean
  Clawback__c: number | null
  Amount_Paid_to_Salesperson__c: number | null
  New_Bus_Ops__c: number | null
  AVG_Call_Time__c: number | null
  Avg_Rolling_Commission__c: number | null
  Month__c: number | null
  Month_Name__c: string | null
  Year__c: string | null
}

// ── Filter types ──

export interface LeadFilters {
  status?: string
  sourceGroup?: string
  interest?: string
  ownerId?: string
  search?: string
  view?: 'all' | 'hot' | 'needCalling' | 'newThisWeek' | 'goingCold' | 'eventInterested' | 'unqualified'
}

export interface PipelineFilters {
  ownerId?: string
  eventId?: string
  eventCategory?: string
  minAmount?: number
  maxAmount?: number
  health?: 'all' | 'red' | 'amber'
  includeClosed?: boolean
}

export interface ClientFilters {
  search?: string
  ownerId?: string
  minSpend?: number
}
