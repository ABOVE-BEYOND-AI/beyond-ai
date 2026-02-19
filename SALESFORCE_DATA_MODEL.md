# Above + Beyond Group — Complete Salesforce Data Model Reference

> **Last Updated:** February 2026
> **Salesforce Edition:** Enterprise (confirm)
> **Person Accounts:** ENABLED
> **Instance URL:** Check `SALESFORCE_INSTANCE_URL` env var
> **API Version:** v59.0+

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Object Relationship Map](#object-relationship-map)
3. [Lead Object](#lead-object)
4. [Contact Object](#contact-object)
5. [Account Object](#account-object)
6. [Opportunity Object](#opportunity-object)
7. [Event Object (Event__c)](#event-object)
8. [Commission Object (Commissions__c)](#commission-object)
9. [Target Object (Target__c)](#target-object)
10. [Custom Objects Summary](#custom-objects-summary)
11. [Picklist Values Reference](#picklist-values-reference)
12. [Users & Roles](#users--roles)
13. [Opportunity Stages](#opportunity-stages)
14. [Key SOQL Queries](#key-soql-queries)
15. [API Write-Back Patterns](#api-write-back-patterns)
16. [Integration Notes](#integration-notes)

---

## Architecture Overview

Above + Beyond Group is a luxury corporate hospitality company selling VIP access to sporting and cultural events (F1, Wimbledon, Cannes, FIFA World Cup, etc.). Salesforce is the single source of truth for all sales, client, and operational data.

### Key Architecture Decisions
- **Person Accounts are ENABLED** — Some Accounts are individuals (PersonAccount), not companies. The Account object has BOTH business fields (Name, Industry) AND person fields (PersonEmail, PersonMobilePhone, FirstName, LastName). When querying contacts/clients, you may need to query BOTH Contact AND Account (WHERE IsPersonAccount = true).
- **No Record Types** on Lead or Opportunity — all records use the same layout.
- **Event__c is a custom object** (not the standard Salesforce Event/Activity). It represents real-world events like "Monaco GP 2026" and is the central operational object.
- **Opportunity naming convention:** `{Contact Name} - {Company} - {Reference Number}` e.g. "Sean Le Tissier - NETCORE INFRASTRUCTURE LIMITED- 10048/003333"
- **Breadwinner integration** syncs invoicing with Xero.
- **Stripe integration** via BWP (Breadwinner Payments) objects.
- **Aircall integration** logs calls as Tasks and has custom objects (aircall__Aircall_AI__c, aircall2gp__Aircall_Voice__c).
- **Marketing Cloud (ET4AE5)** integration for email marketing.
- **Cadmus/PDF Butler** for document generation and e-signatures.
- **Rollup Helper (rh2)** for cross-object rollup calculations.

---

## Object Relationship Map

```
Lead (unconverted prospect)
  │
  ▼ [Lead Conversion → creates Contact + Account + Opportunity]
  │
Contact ──────────────── Account (Business or Person Account)
  │                           │
  │                           ├── Related Accounts (AccountContactRelation)
  │                           ├── Xero Contact (Bread_Winner__Breadwinner_Account_Connection__c)
  │                           ├── BWP Customer (bw_payments__BWP_Customer__c)
  │                           └── Venue data (images, address, provisions — for Location accounts)
  │
  ▼
Opportunity (the deal)
  │
  ├── Event__c (which event — e.g., Monaco GP 2026)
  │     ├── Revenue Target + Actual (Sum_of_Closed_Won_Gross__c)
  │     ├── Ticket Inventory (10 types × Booked/Required/Remaining)
  │     ├── Fulfilment (costs, staff, bookings)
  │     └── Client Content (restaurants, transport info)
  │
  ├── Opportunity_Contact__c → Contact (the buyer)
  ├── AccountId → Account (the company)
  ├── Package_Sold__c → Product2 (the specific package)
  ├── OpportunityLineItem (Opportunity Packages — line items)
  │
  ├── Payment__c (A+B Payments — payment tracking)
  │     └── Roll-ups to Opportunity: Total_Amount_Paid__c, Total_Balance__c, Total_Payments_Due__c
  │
  ├── Deposit_Plan_Assignment__c → Product_Deposit_Plan__c (payment schedules)
  │
  ├── Project__c (fulfilment project — created when deal is won)
  │     ├── Guest__c (individual guests attending)
  │     ├── Booking__c → Booking_Assignment__c (supplier bookings)
  │     └── Itinerary__c → Itinerary_Entry__c (event itineraries)
  │
  ├── Commissions__c (monthly commission record)
  │     └── Target__c (monthly revenue target)
  │
  ├── cadmus_sign2__Sign_request__c (e-signature requests)
  ├── Bread_Winner__Invoice__c → Bread_Winner__Line_Item__c (Xero invoices)
  └── Enquiry__c (original enquiry if applicable)

Interest Tracking (dual system):
  ├── Checkbox fields on Lead/Contact (Formula_1__c, Football__c, Rugby__c, etc.)
  └── Interest__c → Interest_Assignments__c (custom junction object)

Notes:
  └── A_B_Note__c (custom notes on Contacts — rich text body, e.g., personal preferences)

Targets & Commission:
  Target__c (monthly target per user)
    └── Referenced by: Commissions__c, Opportunity (Individual_Target__c, Team_Target__c, Company_Target__c)
```

---

## Lead Object

**API Name:** `Lead`
**Total Fields:** 79
**Record Types:** None
**Key Relationships:** OwnerId → User, Account__c → Account (custom lookup)

### All Fields

| Field Label | API Name | Data Type | Indexed | Notes |
|---|---|---|---|---|
| 18 Digit ID | X18_Digit_ID__c | Formula (Text) | No | |
| Account | Account__c | Lookup(Account) | Yes | Custom lookup — not standard |
| Address | Address | Address | No | Compound (Street, City, State, PostalCode, Country) |
| Annual Revenue | AnnualRevenue | Currency(18, 0) | No | |
| Are you interested in a particular event | Are_you_interested_in_a_particular_event__c | Text(100) | No | Free text from forms |
| Cadence | ActionCadenceId | Lookup(Cadence) | No | Sales Engagement cadence |
| Cadence Assignee | ActionCadenceAssigneeId | Lookup(User,Group) | No | |
| Cadence Entered Technical | Cadence_Entered_Technical__c | Checkbox | No | |
| Cadence Resume Time | ScheduledResumeDateTime | Date/Time | No | |
| Cadence State | ActionCadenceState | Picklist | No | |
| Company | Company | Text(255) | Yes | **Required field** |
| Country Phone Code | Country_Phone_Code__c | Formula (Text) | No | |
| Created By | CreatedById | Lookup(User) | No | |
| Culinary | Culinary__c | Checkbox | No | Interest category |
| Customer Fit | Customer_Fit__c | Number(18, 0) | No | |
| Data.com Key | Jigsaw | Text(20) | No | |
| Description | Description | Long Text Area(32000) | No | |
| Do Not Call | DoNotCall | Checkbox | No | |
| Email | Email | Email | Yes | |
| Email Opt Out | HasOptedOutOfEmail | Checkbox | No | |
| Event of Interest | Event_of_Interest__c | Text(100) | No | Free text — which event they want |
| Facebook | Facebook__c | Text(255) | No | |
| Fax | Fax | Phone | No | |
| Fax Opt Out | HasOptedOutOfFax | Checkbox | No | |
| First Call Date | FirstCallDateTime | Date/Time | No | Standard Sales Engagement field |
| First Email Date | FirstEmailDateTime | Date/Time | No | Standard Sales Engagement field |
| Football | Football__c | Checkbox | No | Interest category |
| Form Comments | Form_Comments__c | Long Text Area(32768) | No | Web form submission comments |
| Form Type | Form_Type__c | Text(25) | No | Which form they submitted |
| Formula 1 | Formula_1__c | Checkbox | No | Interest category |
| Fresh ID | Fresh_ID__c | Text(255) (External ID) (Unique) | Yes | Legacy FreshSales migration ID |
| Gender Identity | GenderIdentity | Picklist | No | |
| I agree to be emailed | I_agree_to_be_emailed__c | Checkbox | No | GDPR consent |
| Industry | Industry | Picklist | No | |
| Interests | Interests__c | Text(255) | No | Free text interests field |
| Last Event Booked | Last_Event_Booked__c | Text(255) | No | |
| Last Modified By | LastModifiedById | Lookup(User) | No | |
| Last Transfer Date | LastTransferDate | Date | No | |
| Lead Owner | OwnerId | Lookup(User,Group) | Yes | |
| Lead Source | LeadSource | Picklist | No | 37 active values — see Picklist Reference |
| Lead Status | Status | Picklist | No | 7 active values — see Picklist Reference |
| LinkedIn | LinkedIn__c | Text(255) | No | |
| Live Music | Live_Music__c | Checkbox | No | Interest category |
| Luxury/Lifestyle/Celebrity | Luxury_Lifestyle_Celebrity__c | Checkbox | No | Interest category |
| Manual Convert | Manual_Convert__c | Checkbox | No | |
| MC 2023 | MC_2023__c | Checkbox | No | Marketing Cloud segment |
| MC 2024 | MC_2024__c | Checkbox | No | Marketing Cloud segment |
| MC Clients | MC_Clients__c | Checkbox | No | Marketing Cloud segment |
| MC CRM Marketing Leads | MC_CRM_Marketing_Leads__c | Checkbox | No | Marketing Cloud segment |
| MC Mailchimp Warm | MC_Mailchimp_Warm__c | Checkbox | No | Legacy Mailchimp flag |
| Mobile | MobilePhone | Phone | No | |
| Mobile Country Code | et4ae5__Mobile_Country_Code__c | Picklist | No | Marketing Cloud field |
| Mobile Opt Out | et4ae5__HasOptedOutOfMobile__c | Checkbox | No | Marketing Cloud field |
| Name | Name | Name | Yes | Compound: Salutation + FirstName + MiddleName + LastName |
| Salutation | Salutation | Picklist | No | Part of Name compound |
| First Name | FirstName | Text(40) | No | Part of Name compound |
| Last Name | LastName | Text(80) | No | Part of Name compound — **Required** |
| Middle Name | MiddleName | Text(40) | No | Part of Name compound |
| Newsletter Subscribed | Newsletter_Subscribed__c | Checkbox | No | |
| No. of Employees | NumberOfEmployees | Number(8, 0) | No | |
| No. of Guests | No_of_Guests__c | Number(2, 0) | No | Expected group size (max 99) |
| Other | Other__c | Checkbox | No | Interest category |
| Phone | Phone | Phone | No | |
| Pronouns | Pronouns | Picklist | No | |
| Rating | Rating | Picklist | No | Hot / Warm / Cold |
| Recent Note | Recent_Note__c | Text(255) | No | Quick note field |
| Rugby | Rugby__c | Checkbox | No | Interest category |
| Score | Score__c | Number(18, 0) | No | ⚠️ BROKEN — All values are 99. Do not rely on this. Calculate score in app. |
| Send to Marketing Cloud | Send_to_Marketing_Cloud__c | Checkbox | No | Sync flag |
| Tags | Tags__c | Text(255) | No | |
| Tennis | Tennis__c | Checkbox | No | Interest category |
| Title | Title | Text(128) | No | Job title |
| Total Cadences | ActiveTrackerCount | Number(9, 0) | No | |
| Twitter | Twitter__c | Text(255) | No | |
| Unique Experiences | Unique_Experiences__c | Checkbox | No | Interest category |
| Unqualified Reason | Unqualified_Reason__c | Text(255) | No | Why lead was disqualified |
| Web to Lead Created | Web_to_Lead_Created__c | Checkbox | No | Flag for web form leads |
| Web to Lead Page Information | Web_to_Lead_Page_Information__c | Text(255) | No | Which page the form was on |
| Website | Website | URL(255) | No | |

### Interest Category Checkboxes (for filtering)

These checkboxes enable quick filtering by event interest type:

```javascript
const interestCheckboxFields = {
  'Formula_1__c': { label: 'Formula 1', icon: '🏎️' },
  'Football__c': { label: 'Football', icon: '⚽' },
  'Rugby__c': { label: 'Rugby', icon: '🏉' },
  'Tennis__c': { label: 'Tennis', icon: '🎾' },
  'Live_Music__c': { label: 'Live Music', icon: '🎵' },
  'Culinary__c': { label: 'Culinary', icon: '🍽️' },
  'Luxury_Lifestyle_Celebrity__c': { label: 'Luxury/Lifestyle', icon: '✨' },
  'Unique_Experiences__c': { label: 'Unique Experiences', icon: '🌟' },
  'Other__c': { label: 'Other', icon: '📌' }
};
```

### Standard Fields Also Available (not in custom list but queryable)

| Field | API Name | Notes |
|---|---|---|
| IsConverted | IsConverted | Boolean — true when lead has been converted |
| ConvertedContactId | ConvertedContactId | Contact created on conversion |
| ConvertedAccountId | ConvertedAccountId | Account created on conversion |
| ConvertedOpportunityId | ConvertedOpportunityId | Opportunity created on conversion |
| ConvertedDate | ConvertedDate | Date of conversion |
| LastActivityDate | LastActivityDate | Date of most recent activity |
| LastModifiedDate | LastModifiedDate | Date/Time last modified |
| CreatedDate | CreatedDate | Date/Time created |
| LastViewedDate | LastViewedDate | Date/Time last viewed by owner |

---

## Contact Object

**API Name:** `Contact`
**Total Fields:** 76
**Record Types:** Yes (RecordTypeId exists — check which types are defined)
**Key Relationships:** AccountId → Account, OwnerId → User, ReportsToId → Contact

### All Fields

| Field Label | API Name | Data Type | Indexed | Notes |
|---|---|---|---|---|
| Account Name | AccountId | Lookup(Account) | Yes | The company/person account this contact belongs to |
| Assistant | AssistantName | Text(40) | No | |
| Asst. Phone | AssistantPhone | Phone | No | |
| Birthdate | Birthdate | Date | No | |
| Buyer Attributes | BuyerAttributes | Picklist (Multi-Select) | No | |
| Cadence | ActionCadenceId | Lookup(Cadence) | No | |
| Cadence Assignee | ActionCadenceAssigneeId | Lookup(User,Group) | No | |
| Cadence Resume Time | ScheduledResumeDateTime | Date/Time | No | |
| Cadence State | ActionCadenceState | Picklist | No | |
| Contact Owner | OwnerId | Lookup(User) | Yes | |
| Contact Record Type | RecordTypeId | Record Type | Yes | |
| Country Phone Code | Country_Phone_Code__c | Formula (Text) | No | |
| Created By | CreatedById | Lookup(User) | No | |
| Creation Source | ContactSource | Picklist | No | |
| Currency Test | rh2__Currency_Test__c | Currency(18, 0) | No | Rollup Helper test field — ignore |
| Customer Fit | Customer_Fit__c | Number(18, 0) | No | |
| Data.com Key | Jigsaw | Text(20) | No | |
| Department | Department | Text(80) | No | |
| Department Group | DepartmentGroup | Picklist | No | |
| Describe | rh2__Describe__c | Lookup(Describe) | Yes | Rollup Helper field — ignore |
| Description | Description | Long Text Area(32000) | No | |
| Do Not Call | DoNotCall | Checkbox | No | |
| Email | Email | Email | Yes | Primary email |
| Email Opt Out | HasOptedOutOfEmail | Checkbox | No | |
| Facebook | Facebook__c | Text(255) | No | |
| Fax | Fax | Phone | No | |
| Fax Opt Out | HasOptedOutOfFax | Checkbox | No | |
| First Call Date | FirstCallDateTime | Date/Time | No | |
| First Email Date | FirstEmailDateTime | Date/Time | No | |
| Formula Test | rh2__Formula_Test__c | Formula (Currency) | No | Rollup Helper test — ignore |
| Fresh ID | Fresh_ID__c | Text(255) (External ID) (Unique) | Yes | Legacy FreshSales ID |
| Gender Identity | GenderIdentity | Picklist | No | |
| Home Phone | HomePhone | Phone | No | |
| Integer Test | rh2__Integer_Test__c | Number(3, 0) | No | Rollup Helper test — ignore |
| Interests | Interests__c | Text(255) | No | Free text interests |
| Last Event Booked | Last_Event_Booked__c | Text(255) | No | |
| Last Modified By | LastModifiedById | Lookup(User) | No | |
| Last Stay-in-Touch Request Date | LastCURequestDate | Date/Time | No | |
| Last Stay-in-Touch Save Date | LastCUUpdateDate | Date/Time | No | |
| Lead Source | LeadSource | Picklist | No | Carried over from Lead conversion |
| LinkedIn | LinkedIn__c | Text(255) | No | |
| Locale | cadmus_sign2__LocaleSidKey__c | Picklist | No | Cadmus/PDF Butler field |
| Mailing Address | MailingAddress | Address | No | |
| MC 2023 | MC_2023__c | Checkbox | No | Marketing Cloud segment |
| MC 2024 | MC_2024__c | Checkbox | No | Marketing Cloud segment |
| MC Clients | MC_Clients__c | Checkbox | No | Marketing Cloud segment |
| MC CRM Marketing Leads | MC_CRM_Marketing_Leads__c | Checkbox | No | Marketing Cloud segment |
| MC Mailchimp Warm | MC_Mailchimp_Warm__c | Checkbox | No | Legacy |
| Mobile | MobilePhone | Phone | No | |
| Mobile Country Code | et4ae5__Mobile_Country_Code__c | Picklist | No | |
| Mobile Opt Out | et4ae5__HasOptedOutOfMobile__c | Checkbox | No | |
| Name | Name | Name | Yes | Compound: Salutation + First + Middle + Last |
| Salutation | Salutation | Picklist | No | |
| First Name | FirstName | Text(40) | No | |
| Last Name | LastName | Text(80) | No | |
| Middle Name | MiddleName | Text(40) | No | |
| Newsletter Subscribed | Newsletter_Subscribed__c | Checkbox | No | |
| Other Address | OtherAddress | Address | No | |
| Other Phone | OtherPhone | Phone | No | |
| Phone | Phone | Phone | No | |
| Pronouns | Pronouns | Picklist | No | |
| Recent Note | Recent_Note__c | Text(255) | No | |
| Reports To | ReportsToId | Lookup(Contact) | Yes | |
| Score | Score__c | Number(18, 0) | No | |
| Secondary Email | Secondary_Email__c | Email | No | |
| Send to Marketing Cloud | Send_to_Marketing_Cloud__c | Checkbox | No | |
| Seniority Level | TitleType | Picklist | No | |
| Sys Admin Update | Sys_Admin_Update__c | Checkbox | No | |
| Tags | Tags__c | Text(255) | No | |
| Title | Title | Text(128) | No | Job title |
| Total Cadences | ActiveTrackerCount | Number(9, 0) | No | |
| Total Spend to Date | Total_Spend_to_Date__c | Currency(16, 2) | No | **KEY FIELD** — lifetime value |
| Total Won Opportunities | Total_Won_Opportunities__c | Formula (Currency) | No | Calculated lifetime revenue |
| Twitter | Twitter__c | Text(255) | No | |
| Unqualified | Unqualified__c | Checkbox | No | |
| Work Email | Work_Email__c | Email | No | |

### Standard Fields Also Available

| Field | API Name | Notes |
|---|---|---|
| LastActivityDate | LastActivityDate | Most recent activity |
| LastModifiedDate | LastModifiedDate | Last modified timestamp |
| CreatedDate | CreatedDate | Created timestamp |

---

## Account Object

**API Name:** `Account`
**Total Fields:** 122
**Record Types:** Yes (RecordTypeId exists)
**Person Accounts:** ENABLED — Account doubles as both a company record AND an individual person record
**Key Relationships:** ParentId → Account (hierarchy), OwnerId → User, OperatingHoursId → OperatingHours

### CRITICAL: Person Account Considerations

When Person Accounts are enabled:
- Fields prefixed with `Person` (e.g., `PersonEmail`, `PersonMobilePhone`) are available on Person Account records only
- Fields suffixed with `__pc` are person contact fields accessible on the Account object
- `IsPersonAccount` field (boolean) distinguishes person accounts from business accounts
- When querying for "clients," you may need to check both Contact AND Account (WHERE IsPersonAccount = true)

### All Fields

| Field Label | API Name | Data Type | Indexed | Notes |
|---|---|---|---|---|
| Account Name | Name | Name | Yes | For business accounts: company name. For person accounts: compound name |
| Salutation | Salutation | Picklist | No | Person Account |
| First Name | FirstName | Text(40) | No | Person Account |
| Last Name | LastName | Text(80) | No | Person Account |
| Middle Name | MiddleName | Text(40) | No | Person Account |
| Account Number | AccountNumber | Text(40) | No | |
| Account Owner | OwnerId | Lookup(User) | Yes | |
| Account Record Type | RecordTypeId | Record Type | Yes | Distinguishes business vs person vs venue accounts |
| Account Site | Site | Text(80) | No | |
| Account Source | AccountSource | Picklist | No | |
| Annual Revenue | AnnualRevenue | Currency(18, 0) | No | |
| Assistant | PersonAssistantName | Text(40) | No | Person Account |
| Asst. Phone | PersonAssistantPhone | Phone | No | Person Account |
| Billing Address | BillingAddress | Address | No | |
| Birthdate | PersonBirthdate | Date | No | Person Account |
| Breakfast End | Breakfast_End__c | Time | No | Venue field |
| Breakfast Start | Breakfast_Start__c | Time | No | Venue field |
| BW Account Status | Bread_Winner__BW_Account_Status__c | Formula (Text) | No | Breadwinner/Xero status |
| Cadence | PersonActionCadenceId | Lookup(Cadence) | No | Person Account |
| Cadence Assignee | PersonActionCadenceAssigneeId | Lookup(User,Group) | No | Person Account |
| Capacity | Capacity__c | Number(18, 0) | No | Venue capacity |
| Check In | Check_In__c | Time | No | Venue field |
| Check Out | Check_Out__c | Time | No | Venue field |
| Company Creation Date | comp_house__Company_Creation_Date__c | Date | No | Companies House integration |
| Company Jurisdiction | comp_house__Company_Jurisdiction__c | Text(255) | No | Companies House |
| Company Number | comp_house__Company_Number__c | Text(50) | No | Companies House |
| Company Status | comp_house__Company_Status__c | Text(50) | No | Companies House |
| Company Type | comp_house__Company_Type__c | Text(50) | No | Companies House |
| Country Image 1 | Country_Image_1__c | URL(255) | No | Venue/location image |
| Country Image 2 | Country_Image_2__c | URL(255) | No | Venue/location image |
| Country Image 3 | Country_Image_3__c | URL(255) | No | Venue/location image |
| Country Phone Code | Country_Phone_Code__pc | Formula (Text) | No | Person Account |
| Created By | CreatedById | Lookup(User) | No | |
| Currency Test | rh2__testCurrency__c | Currency(14, 2) | No | Rollup Helper — ignore |
| Currency Test | rh2__Currency_Test__pc | Currency(18, 0) | No | Rollup Helper — ignore |
| Customer Fit | Customer_Fit__pc | Number(18, 0) | No | Person Account |
| Customer Portal Account | IsCustomerPortal | Checkbox | No | |
| Data.com Key | Jigsaw | Text(20) | No | |
| Department | PersonDepartment | Text(80) | No | Person Account |
| Describe | rh2__Describe__c | Lookup(Describe) | Yes | Rollup Helper — ignore |
| Describe | rh2__Describe__pc | Lookup(Describe) | Yes | Rollup Helper — ignore |
| Description | Description | Long Text Area(32000) | No | |
| Do Not Call | PersonDoNotCall | Checkbox | No | Person Account |
| Einstein Account Tier | Tier | Text(2) | No | |
| Email | PersonEmail | Email | No | Person Account |
| Email Opt Out | PersonHasOptedOutOfEmail | Checkbox | No | Person Account |
| Employees | NumberOfEmployees | Number(8, 0) | No | |
| Facebook | Facebook__pc | Text(255) | No | Person Account |
| Fax | Fax | Phone | No | |
| Fax Opt Out | PersonHasOptedOutOfFax | Checkbox | No | Person Account |
| Formula Test | rh2__Formula_Test__pc | Formula (Currency) | No | Rollup Helper — ignore |
| Fresh ID | Fresh_ID__c | Text(255) (External ID) (Unique) | Yes | Legacy FreshSales ID |
| Fresh ID | Fresh_ID__pc | Text(255) | No | Person Account — legacy |
| Gender Identity | PersonGenderIdentity | Picklist | No | Person Account |
| Home Phone | PersonHomePhone | Phone | No | Person Account |
| Industry | Industry | Picklist | No | |
| Integer Test | rh2__Integer_Test__pc | Number(3, 0) | No | Rollup Helper — ignore |
| Interests | Interests__pc | Text(255) | No | Person Account |
| Last Check Out | Last_Check_Out__c | Time | No | Venue field |
| Last Event Booked | Last_Event_Booked__pc | Text(255) | No | Person Account |
| Last Modified By | LastModifiedById | Lookup(User) | No | |
| Last Stay-in-Touch Request Date | PersonLastCURequestDate | Date/Time | No | Person Account |
| Last Stay-in-Touch Save Date | PersonLastCUUpdateDate | Date/Time | No | Person Account |
| Lead Source | PersonLeadSource | Picklist | No | Person Account |
| LinkedIn | LinkedIn__pc | Text(255) | No | Person Account |
| Locale | cadmus_sign2__LocaleSidKey__pc | Picklist | No | Cadmus field |
| Mailing Address | PersonMailingAddress | Address | No | Person Account |
| Main Image 1 | Main_Image_1__c | URL(255) | No | Venue/location image |
| Main Image 2 | Main_Image_2__c | URL(255) | No | Venue/location image |
| Main Image 3 | Main_Image_3__c | URL(255) | No | Venue/location image |
| MC 2023 | MC_2023__pc | Checkbox | No | Person Account — MC segment |
| MC 2024 | MC_2024__pc | Checkbox | No | Person Account — MC segment |
| MC Clients | MC_Clients__pc | Checkbox | No | Person Account — MC segment |
| MC CRM Marketing Leads | MC_CRM_Marketing_Leads__pc | Checkbox | No | Person Account — MC segment |
| MC Mailchimp Warm | MC_Mailchimp_Warm__pc | Checkbox | No | Person Account — legacy |
| Mobile | PersonMobilePhone | Phone | No | Person Account |
| Mobile Country Code | et4ae5__Mobile_Country_Code__pc | Picklist | No | Person Account |
| Mobile Opt Out | et4ae5__HasOptedOutOfMobile__pc | Checkbox | No | Person Account |
| Newsletter Subscribed | Newsletter_Subscribed__pc | Checkbox | No | Person Account |
| Number of Projects | Number_of_Projects__c | Number(2, 0) | No | |
| Operating Hours | OperatingHoursId | Lookup(Operating Hours) | Yes | Venue field |
| Other Address | PersonOtherAddress | Address | No | Person Account |
| Other Phone | PersonOtherPhone | Phone | No | Person Account |
| Ownership | Ownership | Picklist | No | |
| Parent Account | ParentId | Hierarchy | Yes | |
| Phone | Phone | Phone | No | |
| Pronouns | PersonPronouns | Picklist | No | Person Account |
| Rating | Rating | Picklist | No | |
| Recent Note | Recent_Note__pc | Text(255) | No | Person Account |
| Score | Score__pc | Number(18, 0) | No | Person Account |
| Secondary Email | Secondary_Email__pc | Email | No | Person Account |
| Send to Marketing Cloud | Send_to_Marketing_Cloud__c | Checkbox | No | Business account |
| Send to Marketing Cloud | Send_to_Marketing_Cloud__pc | Checkbox | No | Person Account |
| Shipping Address | ShippingAddress | Address | No | |
| SIC Code | Sic | Text(20) | No | |
| SIC Description | SicDesc | Text(80) | No | |
| Supplier Provisions | Supplier_Provisions__c | Picklist (Multi-Select) | No | Venue field |
| Sys Admin Update | Sys_Admin_Update__pc | Checkbox | No | Person Account |
| Tags | Tags__pc | Text(255) | No | Person Account |
| Terminal | Terminal__c | Text(255) | No | Venue field |
| Ticker Symbol | TickerSymbol | Text(20) | No | |
| Time Zone | Time_Zone__c | Picklist | No | Venue field |
| Title | PersonTitle | Text(80) | No | Person Account |
| Total Amount Credited | Bread_Winner__Total_Amount_Credit__c | Number(16, 2) | No | Xero |
| Total Amount Due | Bread_Winner__Total_Amount_Due__c | Number(16, 2) | No | Xero |
| Total Amount Invoiced | Bread_Winner__Total_Amount_Invoiced__c | Number(16, 2) | No | Xero |
| Total Amount Overdue | Bread_Winner__Total_Amount_Overdue__c | Number(16, 2) | No | Xero |
| Total Amount Paid | Bread_Winner__Total_Amount_Paid__c | Number(16, 2) | No | Xero |
| Total Draft Amount | Bread_Winner__Total_Draft_Amount__c | Number(16, 2) | No | Xero |
| Total Spend to Date | Total_Spend_to_Date__pc | Currency(16, 2) | No | Person Account — lifetime value |
| Total Unallocated Credit | Bread_Winner__Total_Unallocated_Credit__c | Number(16, 2) | No | Xero |
| Total Won Opportunities | Total_Won_Opportunities__c | Roll-Up Summary (SUM Opportunity) | No | Business account |
| Total Won Opportunities | Total_Won_Opportunities__pc | Formula (Currency) | No | Person Account |
| Twitter | Twitter__pc | Text(255) | No | Person Account |
| Type | Type | Picklist | No | |
| Unqualified | Unqualified__pc | Checkbox | No | Person Account |
| VAT Number | VAT_Number__c | Text(12) | No | |
| Venue Additional Information | Venue_Additional_Information__c | Rich Text Area(32768) | No | Venue field |
| Venue Address | Venue_Address__c | Address | No | Venue field |
| Venue Country | Venue_Country__c | Formula (Text) | No | Venue field |
| Website | Website | URL(255) | No | |
| Work Email | Work_Email__pc | Email | No | Person Account |

### Account Serves Multiple Purposes

The Account object is used for:
1. **Client Companies** — Business accounts for corporate clients (e.g., NETCORE INFRASTRUCTURE LIMITED)
2. **Individual Clients** — Person Accounts for individual buyers
3. **Venues/Locations** — Venue fields (Capacity, Check In/Out, Breakfast times, Supplier Provisions, Images, Address) suggest venues are stored as Account records. Event__c.Location__c is a Lookup(Account).
4. **Restaurants** — Event__c has Where_to_Eat_1/2/3 as Lookup(Account)
5. **Attractions** — Event__c has Where_to_Go_1/2/3 as Lookup(Account)

---

## Opportunity Object

**API Name:** `Opportunity`
**Total Fields:** 109
**Record Types:** None
**Key Relationships:** AccountId → Account, Opportunity_Contact__c → Contact, Event__c → Event__c, Package_Sold__c → Product2, OwnerId → User, Commission_Record__c → Commission, Company_Target__c / Individual_Target__c / Team_Target__c → Target, Project__c → Project

### All Fields

| Field Label | API Name | Data Type | Indexed | Notes |
|---|---|---|---|---|
| 18 Digit ID | X18_Digit_ID__c | Formula (Text) | No | |
| Account Name | AccountId | Lookup(Account) | Yes | |
| Agreement Signed unprocessed | Agreement_Signed_unprocessed__c | Checkbox | No | Commission processing flag |
| Amendment | Amendment__c | Checkbox | No | |
| Clawbacks unprocessed | Clawbacks_unprocessed__c | Checkbox | No | Commission processing flag |
| Close Date | CloseDate | Date | Yes | |
| Commission Amount | Commission_Amount__c | Formula (Number) | No | |
| Commission Avg Rolling % | Commission_Avg_Rolling__c | Percent(3, 2) | No | |
| Commission Record | Commission_Record__c | Lookup(Commission) | Yes | Links to monthly commission |
| Company Target | Company_Target__c | Lookup(Target) | Yes | |
| Contract | ContractId | Lookup(Contract) | Yes | |
| Cost per Person | Cost_per_Person__c | Formula (Number) | No | Amount / Total_Number_of_Guests |
| Created By | CreatedById | Lookup(User) | No | |
| Current Payment Plan | Current_Payment_Plan__c | Rich Text Area(32768) | No | HTML payment plan details |
| Date > 50 Payment Made | Date_50_Payment_Made__c | Date | No | When 50% threshold was hit |
| Date Closed Lost from Agreement Signed | Date_Closed_Lost_from_Agreement_Signed__c | Date | No | Tracks cancellations |
| Deposit | Deposit__c | Roll-Up Summary (COUNT A+B Payment) | No | Count of payments |
| Deposit Plan Pick | Deposit_Plan_Pick__c | Picklist | No | |
| Description | Description | Long Text Area(32000) | No | |
| Does VAT Apply? | Does_VAT_Apply__c | Picklist | No | |
| Email Payment Plan | Email_Payment_Plan__c | Long Text Area(131072) | No | |
| Event | Event__c | Lookup(Event) | Yes | **KEY FIELD** — which event this deal is for |
| Event Category | Event_Category__c | Formula (Text) | No | Pulls from Event__c.Category__c |
| Event End Date | Event_End_Date__c | Formula (Date) | No | Pulls from Event__c |
| Event Start Date | Event_Start_Date__c | Formula (Date) | No | Pulls from Event__c |
| Expected Revenue | ExpectedRevenue | Currency(16, 2) | No | |
| Forecast Category | ForecastCategoryName | Picklist | No | Pipeline / Best Case / Closed / Omitted |
| Fresh ID | Fresh_ID__c | Text(255) (External ID) (Unique) | Yes | Legacy |
| Gross Amount | Gross_Amount__c | Formula (Currency) | No | Net + Service Charge + Processing Fee + Tax |
| Imported from FreshSales | Imported_from_FreshSales__c | Checkbox | No | Legacy |
| Individual Target | Individual_Target__c | Lookup(Target) | Yes | Rep's monthly target |
| Invoice Address | Invoice_Address__c | Text Area(255) | No | |
| Invoice Reference Number | Invoice_Reference_Number__c | Text(255) | No | |
| Is New Business? | Is_New_Business__c | Checkbox | No | First-time client flag |
| Last Modified By | LastModifiedById | Lookup(User) | No | |
| Lead Source | LeadSource | Picklist | No | Carried over from Lead |
| Loss Reason | Loss_Reason__c | Picklist | No | Why deal was lost |
| Manual Project Trigger | Manual_Project_Trigger__c | Checkbox | No | |
| Manual Service Charge % | Manual_Service_Charge__c | Percent(2, 1) | No | |
| Manual Service Charge Override | Manual_Service_Charge_Override__c | Checkbox | No | |
| Master Package Code | Master_Package_Code__c | Formula (Text) | No | From Event__c |
| Month Payment Made | Month_Payment_Made__c | Formula (Text) | No | |
| Net Amount | Amount | Currency(16, 2) | No | **This is the standard Amount field** |
| Next Step | NextStep | Text(255) | No | |
| Opportunity Contact | Opportunity_Contact__c | Lookup(Contact) | Yes | **KEY FIELD** — the buyer |
| Opportunity Name | Name | Text(120) | Yes | Format: {Contact} - {Company} - {Ref} |
| Opportunity Owner | OwnerId | Lookup(User) | Yes | The sales rep |
| Opportunity Score | IqScore | Number(9, 0) | No | Einstein score |
| Package Code | Package_Code__c | Formula (Text) | No | |
| Package Count | Package_Count__c | Roll-Up Summary (COUNT OpportunityLineItem) | No | |
| Package Name | Package_Name__c | Formula (Text) | No | From Package_Sold__c |
| Package Sold | Package_Sold__c | Lookup(Package/Product2) | Yes | The specific product |
| Payment Plan Check | Payment_Plan_Check__c | Formula (Checkbox) | No | |
| Payment Plan Text | Payment_Plan_Text__c | Long Text Area(32768) | No | |
| Payment Progress | Payment_Progress__c | Formula (Text) | No | Visual text indicator |
| Payments>50% unprocessed | Payments_50_unprocessed__c | Checkbox | No | Commission flag |
| Percentage Paid | Percentage_Paid__c | Formula (Percent) | No | Total_Amount_Paid / Gross_Amount |
| Personal | Personal__c | Checkbox | No | Personal booking (not corporate) |
| Price Book | Pricebook2Id | Lookup(Price Book) | Yes | |
| Primary Campaign Source | CampaignId | Lookup(Campaign) | Yes | |
| Prior Cost per Person | Prior_Cost_per_Person__c | Currency(16, 2) | No | For amendments — original values |
| Prior Date | Prior_Date__c | Date | No | For amendments |
| Prior Event Name | Prior_Event_Name__c | Text(100) | No | For amendments |
| Prior Facility | Prior_Facility__c | Text(100) | No | For amendments |
| Prior Gross Amount | Prior_Gross_Amount__c | Currency(16, 2) | No | For amendments |
| Prior Location | Prior_Location__c | Text(100) | No | For amendments |
| Prior Net Total | Prior_Net_Total__c | Currency(16, 2) | No | For amendments |
| Prior No. of Guests | Prior_No_of_Guests__c | Number(3, 0) | No | For amendments |
| Prior Processing Fee | Prior_Processing_Fee__c | Currency(16, 2) | No | For amendments |
| Prior Service Charge | Prior_Service_Charge__c | Currency(16, 2) | No | For amendments |
| Prior Special Requirements | Prior_Special_Requirements__c | Text(255) | No | For amendments |
| Prior Tax Amount | Prior_Tax_Amount__c | Currency(16, 2) | No | For amendments |
| Private | IsPrivate | Checkbox | No | |
| Probability (%) | Probability | Percent(3, 0) | No | |
| Processing Fee | Processing_Fee__c | Formula (Currency) | No | |
| Product Deposit Plan | Product_Deposit_Plan__c | Lookup(Product Deposit Plan) | Yes | |
| Project | Project__c | Lookup(Project) | Yes | Fulfilment project |
| Project Type | Project_Type__c | Picklist | No | |
| Quantity | TotalOpportunityQuantity | Number(16, 2) | No | |
| Send to Marketing Cloud | Send_to_Marketing_Cloud__c | Checkbox | No | |
| Send to Slack | Send_to_Slack__c | Checkbox | No | |
| Service Charge | Service_Charge__c | Formula (Currency) | No | |
| Sign Request Complete | Sign_Request_Complete__c | Checkbox | No | E-signature status |
| Special Payment Approved | Special_Payment_Approved__c | Checkbox | No | |
| Special Payment Terms | Special_Payment_Terms__c | Checkbox | No | |
| Special Payment Terms Request | Special_Payment_Terms_Request__c | Text(255) | No | |
| Special Requirements | Special_Requirements__c | Text(255) | No | |
| Special Requirements Approved | Special_Requirements_Approved__c | Checkbox | No | |
| Stage | StageName | Picklist | No | See Opportunity Stages section |
| Synced Quote | SyncedQuoteId | Lookup(Quote) | No | |
| Target (Payment Made>50%) | Target_Payment_Made_50__c | Lookup(Target) | Yes | |
| Tax Amount | Tax_Amount__c | Formula (Currency) | No | |
| Team Target | Team_Target__c | Lookup(Target) | Yes | |
| Ticket Address | Ticket_Address__c | Text Area(255) | No | |
| Total Amount Due | Bread_Winner__Total_Amount_Due__c | Number(16, 2) | No | Xero |
| Total Amount Invoiced | Bread_Winner__Total_Amount_Invoiced__c | Number(16, 2) | No | Xero |
| Total Amount Overdue | Bread_Winner__Total_Amount_Overdue__c | Number(16, 2) | No | Xero |
| Total Amount Paid (Xero) | Bread_Winner__Total_Amount_Paid__c | Number(16, 2) | No | Xero |
| Total Amount Paid (A+B) | Total_Amount_Paid__c | Roll-Up Summary (SUM A+B Payment) | No | Internal payment tracking |
| Total Balance | Total_Balance__c | Roll-Up Summary (SUM A+B Payment) | No | Outstanding balance |
| Total Draft Amount | Bread_Winner__Total_Draft_Amount__c | Number(16, 2) | No | Xero |
| Total Number of Guests | Total_Number_of_Guests__c | Roll-Up Summary (SUM OpportunityLineItem) | No | |
| Total Payments Due | Total_Payments_Due__c | Roll-Up Summary (SUM A+B Payment) | No | |
| Trigger Community User | Trigger_Community_User__c | Checkbox | No | |
| Type | Type | Picklist | No | |
| Void Processing Fee | Void_Processing_Fee__c | Checkbox | No | |
| Void Service Charge | Void_Service_Charge__c | Checkbox | No | |
| Xero Invoice Number Base | Xero_Invoice_Number_Base__c | Text(255) | No | |
| Year Payment Made | Year_Payment_Made__c | Formula (Text) | No | |

### Financial Calculation Chain

```
Net Amount (Amount)
  + Service_Charge__c (formula)
  + Processing_Fee__c (formula)
  + Tax_Amount__c (formula)
  = Gross_Amount__c (formula)

Total_Amount_Paid__c (roll-up from Payment__c)
  / Gross_Amount__c
  = Percentage_Paid__c (formula)

Gross_Amount__c - Total_Amount_Paid__c = Total_Balance__c (roll-up)
```

### Amendment Fields (Prior_* fields)

When a deal is amended (e.g., upgrade, date change), the original values are stored in `Prior_*` fields before the record is updated. This creates an audit trail:
- Prior_Net_Total__c, Prior_Gross_Amount__c, Prior_Cost_per_Person__c
- Prior_No_of_Guests__c, Prior_Event_Name__c, Prior_Location__c
- Prior_Facility__c, Prior_Date__c, Prior_Special_Requirements__c
- Prior_Service_Charge__c, Prior_Processing_Fee__c, Prior_Tax_Amount__c

---

## Event Object

**API Name:** `Event__c`
**Total Fields:** 77
**Key Relationships:** Location__c → Account (venue), Where_to_Eat_1/2/3__c → Account (restaurants), Where_to_Go_1/2/3__c → Account (attractions), A_B_On_Site_1/2__c → User (staff), OwnerId → User

### All Fields

| Field Label | API Name | Data Type | Indexed | Notes |
|---|---|---|---|---|
| 18 Digit ID | X18_Digit_ID__c | Formula (Text) | No | |
| A+B On Site 1 | A_B_On_Site_1__c | Lookup(User) | Yes | Staff assigned to event |
| A+B On Site 2 | A_B_On_Site_2__c | Lookup(User) | Yes | Staff assigned to event |
| Category | Category__c | Picklist | No | Event type (F1, Tennis, etc.) |
| Created By | CreatedById | Lookup(User) | No | |
| Description | Description__c | Long Text Area(131072) | No | |
| End Date | End_Date__c | Date | No | |
| End Time | End_Time__c | Time | No | |
| Event Image 1-5 | Event_Image_1-5__c | URL(255) | No | 5 image URL fields |
| Event Name | Name | Text(80) | Yes | e.g., "MONACO GRAND PRIX 2026" |
| Event Notes | Event_Notes__c | Text Area(255) | No | |
| Getting Around Overview | Getting_Around_Overview__c | Long Text Area(131072) | No | Client-facing content |
| Helpful Numbers | Helpful_Numbers__c | Long Text Area(131072) | No | Client-facing content |
| Location | Location__c | Lookup(Account) | Yes | Venue — stored as Account record |
| Margin Percentage | Margin_Percentage__c | Formula (Percent) | No | Profitability |
| Master Package Code | Master_Package_Code__c | Text(255) (Unique) | Yes | |
| Owner | OwnerId | Lookup(User,Group) | Yes | |
| Percentage Reservations Completion | Percentage_Reservations_Completion__c | Formula (Percent) | No | Overall fulfilment progress |
| Percentage to Target | Percentage_to_Target__c | Formula (Percent) | No | Revenue vs target |
| Public Transport Information | Public_Transport_Information__c | Rich Text Area(131072) | No | Client-facing content |
| Reservation Progress | Reservation_Progress__c | Formula (Text) | No | Visual indicator |
| Revenue Progress | Revenue_Progress__c | Formula (Text) | No | Visual indicator |
| Revenue Target | Revenue_Target__c | Currency(18, 0) | No | **Target revenue for this event** |
| Start Date | Start_Date__c | Date | No | |
| Start Date (2) | Start_Date_2__c | Formula (Date) | No | |
| Start Time | Start_Time__c | Time | No | |
| Sum of Closed Won Gross | Sum_of_Closed_Won_Gross__c | Currency(16, 2) | No | **Actual revenue closed** |
| Total Booking Cost | Total_Booking_Cost__c | Roll-Up Summary (SUM Booking) | No | Cost of supplier bookings |
| Total Margin Value | Total_Margin_Value__c | Formula (Currency) | No | Revenue - Costs |
| Total Payments Received | Total_Payments_Received__c | Roll-Up Summary (SUM Project) | No | Cash collected |
| Total Projects | Total_Projects__c | Roll-Up Summary (COUNT Project) | No | Number of fulfilment projects |
| Total Staff Costs | Total_Staff_Costs__c | Currency(16, 2) | No | A+B staff costs |
| Total Tickets Booked | Total_Tickets_Booked__c | Formula (Number) | No | Aggregate |
| Total Tickets Remaining | Total_Tickets_Remaining__c | Formula (Number) | No | Aggregate |
| Total Tickets Required | Total_Tickets_Required__c | Formula (Number) | No | Aggregate |
| Where to Eat 1-3 | Where_to_Eat_1-3__c | Lookup(Account) | Yes | Restaurant recommendations |
| Where to Eat Overview | Where_to_Eat_Overview__c | Long Text Area(131072) | No | Client-facing content |
| Where to Go 1-3 | Where_to_Go_1-3__c | Lookup(Account) | Yes | Attraction recommendations |

### Ticket Inventory Tracking

Every ticket type has a trio of Booked (Roll-Up from Project) / Required (Roll-Up from Project) / Remaining (Formula = Required - Booked):

| Ticket Type | Booked API | Required API | Remaining API |
|---|---|---|---|
| Event Tickets | Event_Tickets_Booked__c | Event_Tickets_Required__c | Event_Tickets_Remaining__c |
| Hospitality | Hospitality_Tickets_Booked__c | Hospitality_Tickets_Required__c | Hospitality_Tickets_Remaining__c |
| Hotel Rooms | Hotel_Tickets_Booked__c | Hotel_Tickets_Required__c | Hotel_Tickets_Remaining__c |
| Dinner | Dinner_Tickets_Booked__c | Dinner_Tickets_Required__c | Dinner_Tickets_Remaining__c |
| Drinks | Drinks_Tickets_Booked__c | Drinks_Tickets_Required__c | Drinks_Tickets_Remaining__c |
| Party | Party_Tickets_Booked__c | Party_Tickets_Required__c | Party_Tickets_Remaining__c |
| Inbound Flights | Inbound_Flight_Tickets_Booked__c | Inbound_Flight_Tickets_Required__c | Inbound_Flights_Tickets_Remaining__c |
| Outbound Flights | Outbound_Flight_Tickets_Booked__c | Outbound_Flight_Tickets_Required__c | Outbound_Flights_Tickets_Remaining__c |
| Inbound Transfers | Inbound_Transfer_Tickets_Booked__c | Inbound_Transfer_Tickets_Required__c | Inbound_Transfer_Tickets_Remaining__c |
| Outbound Transfers | Outbound_Transfer_Tickets_Booked__c | Outbound_Transfer_Tickets_Required__c | Outbound_Transfer_Tickets_Remaining__c |

---

## Commission Object

**API Name:** `Commissions__c`
**Total Fields:** 40
**Key Relationships:** Sales_Person__c → User, Target__c → Target, OwnerId → User

### All Fields

| Field Label | API Name | Data Type | Notes |
|---|---|---|---|
| # New Bus Ops | New_Bus_Ops__c | Number(18, 0) | New business opportunity count |
| % Commission Rate Applicable | Commission_Rate_Applicable__c | Formula (Percent) | Calculated commission rate |
| Add on Bonus | Add_on_Bonus__c | Formula (Currency) | |
| Add on Commission Rate | Add_on_Commission_Rate__c | Formula (Percent) | |
| Amount Paid to Salesperson | Amount_Paid_to_Salesperson__c | Formula (Currency) | Actual payout |
| Attendance & Punctuality % (QTR) | Attendance_Punctuality_QTR__c | Formula (Percent) | KPI |
| Attendance & Punctuality Met (QTR) | Attendance_Punctuality_Met_QTR__c | Checkbox | KPI met? |
| Average Call Time >2.5 hours Execs | Average_Call_Time_2_5_hours_Execs__c | Formula (Percent) | KPI for exec call time |
| AVG Call Time | AVG_Call_Time__c | Number(16, 2) | Actual average call time |
| Avg Rolling Commission % | Avg_Rolling_Commission__c | Percent(3, 2) | |
| Clawback | Clawback__c | Currency(16, 2) | Commission taken back |
| Clawback Override | Clawback_Override__c | Currency(16, 2) | Manual adjustment |
| Commissions ID | Name | Auto Number | Auto-generated ID |
| Created By | CreatedById | Lookup(User) | |
| Gross Amount Moved to Agreement Signed | Gross_Amount_Moved_to_Agreement_Signed__c | Currency(16, 2) | Total gross closed |
| KPI Targets % | KPI_Targets__c | Formula (Percent) | Overall KPI achievement |
| KPI Targets Met? | KPI_Targets_Met__c | Checkbox | |
| Last Modified By | LastModifiedById | Lookup(User) | |
| Locked | Locked__c | Checkbox | Prevents editing |
| Month # | Month__c | Number(2, 0) | Month number (1-12) |
| Month Name | Month_Name__c | Formula (Text) | e.g., "February" |
| Net Amt Moved to Agree. Signed - Older | Net_Amt_Moved_to_Agree_Signed_Older__c | Currency(16, 2) | Older deals signed this month |
| Net Amt Moved to Agree. Signed - This Mth | Net_Amt_Moved_to_Agree_Signed_This_Mth__c | Currency(16, 2) | This month's deals |
| Net Op Amt Inv Paid >= 50% of Gross Amt | Net_Op_Amt_Inv_Paid_50_of_Gross_Amt__c | Currency(16, 2) | Deals hitting 50% payment threshold |
| Net Special Payment Terms Ops | Net_Special_Payment_Terms_Ops__c | Currency(16, 2) | |
| New Business Opportunities AM | New_Business_Opportunties_AM__c | Percent(3, 2) | Account manager % |
| New Business Opportunities Execs | New_Business_Opportunties_Execs__c | Formula (Percent) | Exec % |
| New Monthly Commission Rate | New_Monthly_Commission_Rate__c | Formula (Percent) | |
| New Total Monthly Commission | New_Total_Monthly_Commission__c | Formula (Currency) | |
| Owner | OwnerId | Lookup(User,Group) | |
| Previous Months Avg Rolling Commission % | Previous_Months_Avg_Rolling_Commission__c | Percent(3, 2) | |
| Previous Months Commission | Previous_Months_Commission__c | Percent(3, 2) | |
| Sales Person | Sales_Person__c | Lookup(User) | **KEY FIELD** — which rep |
| Sales Person Role | Sales_Person_Role__c | Formula (Text) | Pulls from User role |
| Special Payment Terms | Special_Payment_Terms__c | Percent(3, 2) | |
| Target | Target__c | Lookup(Target) | Monthly target record |
| Team & Personal Targets % (QTR) | Team_Personal_Targets_QTR__c | Formula (Percent) | Quarterly target % |
| Team & Personal Targets Met (QTR) | Team_Personal_Targets_Met_QTR__c | Checkbox | |
| Total Monthly Commission | Total_Monthly_commission__c | Formula (Currency) | Total commission earned |
| Year | Year__c | Text(4) | e.g., "2026" |

---

## Target Object

**API Name:** `Target__c`
**Total Fields:** 11
**Key Relationships:** OwnerId → User

### All Fields

| Field Label | API Name | Data Type | Notes |
|---|---|---|---|
| Budget Fiscal Year | Budget_Fiscal_Year__c | Formula (Text) | |
| Created By | CreatedById | Lookup(User) | |
| Days Absent | Days_Absent__c | Number(3, 1) | Adjusts for holidays/sick |
| Last Modified By | LastModifiedById | Lookup(User) | |
| Month | Month__c | Picklist | e.g., "February" |
| Month & Year Target | Name | Text(80) | e.g., "February 2026" |
| Owner | OwnerId | Lookup(User,Group) | Who the target belongs to |
| Sort Order | Sort_Order__c | Formula (Number) | For ordering |
| Target Amount | Target_Amount__c | Currency(16, 2) | **The revenue target** |
| Type | Type__c | Picklist | Individual / Team / Company |
| Year | Year__c | Text(4) | e.g., "2026" |

---

## Custom Objects Summary

All custom objects in the org (167 total objects, filtering to relevant ones):

### Core Business Objects

| Object | API Name | Purpose |
|---|---|---|
| A+B Note | A_B_Note__c | Custom notes on contacts (rich text body with personal preferences) |
| A+B Payment | Payment__c | Payment tracking per opportunity (roll-ups to Opp) |
| Booking | Booking__c | Supplier bookings for fulfilment |
| Booking Assignment | Booking_Assignment__c | Booking allocations |
| Commission | Commissions__c | Monthly commission per rep (40 fields) |
| Deposit Plan Assignment | Deposit_Plan_Assignment__c | Links deposit plans to opportunities |
| Enquiry | Enquiry__c | Inbound enquiries |
| Event | Event__c | Real-world events — central operational object (77 fields) |
| Guest | Guest__c | Individual guest records |
| Interest | Interest__c | Interest categories |
| Interest Assignment | Interest_Assignments__c | Junction: Interest to Lead/Contact |
| Itinerary | Itinerary__c | Event itineraries |
| Itinerary Entry | Itinerary_Entry__c | Itinerary line items |
| Package Request | Package_Request__c | Package/product requests |
| Product Deposit Plan | Product_Deposit_Plan__c | Payment schedule templates |
| Project | Project__c | Fulfilment projects (created when deal won) |
| Project Contact Role | Project_Contact_Role__c | Contact roles on projects |
| Target | Target__c | Monthly revenue targets (11 fields) |

### Integration Objects

| Object | API Name | Integration |
|---|---|---|
| Aircall AI | aircall__Aircall_AI__c | Aircall |
| Aircall Duplicate Check | aircall2gp__Aircall_Duplicate_Check__c | Aircall |
| Aircall Voice | aircall2gp__Aircall_Voice__c | Aircall |
| Invoice | Bread_Winner__Invoice__c | Xero (Breadwinner) |
| Line Item | Bread_Winner__Line_Item__c | Xero (Breadwinner) |
| Payment | Bread_Winner__Payment__c | Xero (Breadwinner) |
| Xero Contact | Bread_Winner__Breadwinner_Account_Connection__c | Xero |
| Xero Metadata | Bread_Winner__Xero_Metadata__c | Xero |
| BWP Customer | bw_payments__BWP_Customer__c | Stripe |
| BWP Invoice | bw_payments__BWP_Invoice__c | Stripe |
| BWP Transaction | bw_payments__BWP_Transaction__c | Stripe |
| BWP Subscription | bw_payments__BWP_Subscription__c | Stripe |
| BWP Payment Method | bw_payments__BWP_Payment_Method__c | Stripe |
| Sign Request | cadmus_sign2__Sign_request__c | PDF Butler / Cadmus (e-signatures) |
| Sign Request Template | cadmus_sign2__Sign_request_template__c | PDF Butler / Cadmus |
| Doc Config | cadmus_core__Doc_Config__c | PDF Butler |
| Email Send | et4ae5__SendDefinition__c | Marketing Cloud |
| Individual Email Result | et4ae5__IndividualEmailResult__c | Marketing Cloud |
| Triggered Send | et4ae5__Automated_Send__c | Marketing Cloud |
| Business Unit | et4ae5__Business_Unit__c | Marketing Cloud |

### Utility/System Objects

| Object | API Name | Purpose |
|---|---|---|
| Teams | CustomTeams__Teams__c | Team management |
| Team Members | CustomTeams__Team_Members__c | Team member assignments |
| Data Request | Data_Request__c | Data requests |
| Stripe Account | stripeGC__Stripe_Account__c | Stripe config |
| Rollup Helper objects | rh2__* | Various rollup calculation objects |
| Flow objects | FlowPersonalConfiguration__c, FlowTableViewDefinition__c | Flow configuration |

---

## Picklist Values Reference

### Lead Status (7 active, 2 inactive)

| Value | API Name | Converted? | Default? | Status |
|---|---|---|---|---|
| New | New | No | **Yes** | Active |
| Working | Working | No | No | Active |
| Prospect | Prospect | No | No | Active |
| Interested | Interested | No | No | Active |
| Nurturing | Nurturing | No | No | Active |
| Qualified | Qualified | **Yes** | No | Active |
| Unqualified | Unqualified | No | No | Active |
| Other | Other | No | No | **Inactive** |
| Reseller | Reseller | No | No | **Inactive** |

**Lifecycle flow:** New → Working → Prospect → Interested → Qualified (converts) OR → Unqualified / Nurturing

### Lead Source (37 active, 29 inactive)

**Active Values:**

| Value | Category |
|---|---|
| Advertisement | Digital Ads |
| Central London Residents - Cold | Outbound |
| Chat | Other |
| Cognism | Outbound |
| Credit Safe | Outbound |
| Customer Event | Events |
| Display Ads | Digital Ads |
| Email | Email |
| Employee Referral | Referral |
| Events | Events |
| External Referral | Referral |
| Facebook Lead Form | Digital Ads |
| Google AdWords | Digital Ads |
| KT database | Database |
| LinkedIn | Referral/Outbound |
| Linkedin Ads | Digital Ads |
| LT Database | Database |
| Marketing (Max) | Other |
| Networking | Events |
| Organic Search | Organic |
| Other | Other |
| Partner | Referral |
| Phone | Outbound |
| Purchased List | Outbound |
| Referral | Referral |
| RR database | Database |
| Snowbomb database | Database |
| Social Media | Organic |
| Trade Contact | Referral |
| Trade Show | Events |
| V2.1 database | Database |
| V3.1 | Database |
| v1.1 Premium database | Database |
| Web | Organic |
| Web Form | Organic |
| Webinar | Events |
| Website | Organic |

**Notable Inactive Values:**
- Lusha (Inactive — should be reactivated if using Lusha for outreach)
- Website Newsletter
- V3.2 through V3.30 (batch import tracking — 28 inactive values)

**Grouped for App Filtering:**
```javascript
const leadSourceGroups = {
  'Digital Ads': ['Google AdWords', 'LinkedIn', 'Linkedin Ads', 'Display Ads', 'Facebook Lead Form', 'Advertisement'],
  'Organic': ['Organic Search', 'Website', 'Web', 'Web Form', 'Social Media'],
  'Outbound': ['Cognism', 'Credit Safe', 'Lusha', 'Phone', 'Purchased List', 'Central London Residents - Cold'],
  'Referral': ['Employee Referral', 'External Referral', 'Referral', 'Partner', 'Trade Contact', 'Networking'],
  'Events': ['Trade Show', 'Customer Event', 'Events', 'Webinar'],
  'Database': ['KT database', 'LT database', 'RR database', 'Snowbomb database', 'v1.1 Premium database', 'V2.1 database', 'V3.1'],
  'Email': ['Email', 'Chat'],
  'Other': ['Marketing (Max)', 'Other']
};
```

---

## Opportunity Stages

| Stage Name | API Name | Type | Probability | Forecast Category | Pipeline Column |
|---|---|---|---|---|---|
| New | New | Open | 10% | Pipeline | Active — Kanban |
| Deposit Taken | Deposit_Taken | Open | 50% | Best Case | Active — Kanban |
| Agreement Sent | Agreement_Sent | Open | 85% | Best Case | Active — Kanban |
| Agreement Signed | Agreement_Signed | Closed/Won | 100% | Closed | Won panel |
| Amended | Amended | Closed/Won | 100% | Closed | Won panel |
| Amendment Signed | Amendment_Signed | Closed/Won | 100% | Closed | Won panel |
| Closed Lost | Closed_Lost | Closed/Lost | 0% | Omitted | Lost panel |
| Cancelled | Cancelled | Closed/Lost | 0% | Omitted | Lost panel |

**For Pipeline Kanban:** Only 3 active columns (New → Deposit Taken → Agreement Sent). Won and Lost are summary panels.

**Querying open pipeline:** `WHERE IsClosed = false` (returns New, Deposit Taken, Agreement Sent)
**Querying closed won:** `WHERE StageName IN ('Agreement Signed', 'Amended', 'Amendment Signed')`
**Querying closed lost:** `WHERE StageName IN ('Closed Lost', 'Cancelled')`

---

## Users & Roles

### Active Sales Users

| Name | Username | Role | Profile | Manager | Status |
|---|---|---|---|---|---|
| Aaron Swaby | aaron.swaby@aboveandbeyond.group | Sales Users | Above+Beyond Sales | Scarlett Franklin | Active |
| Alec MacDonald | alec.macdonald@aboveandbeyond.group | Sales Users | Above+Beyond Sales | Scarlett Franklin | Active |
| Alex Kirby | alex.kirby@aboveandbeyond.group | Sales Users | Above+Beyond Sales | Scarlett Franklin | Active |
| Billy Prowse | billy.prowse@aboveandbeyond.group | Sales Users | Above+Beyond Sales | Scarlett Franklin | ⚠️ Last login 16 Feb |
| Conner Millar | conner.millar@aboveandbeyond.group | Sales Users | Above+Beyond Sales | Scarlett Franklin | Active |
| Daniel Parker | daniel.parker@aboveandbeyond.group | Sales Users | System Administrator | Scarlett Franklin | Active (admin access) |
| Jack Mautterer | jack.mautterer@aboveandbeyond.group | Sales Users | Above+Beyond Sales | Scarlett Franklin | Active |
| James Walters | james.walters@aboveandbeyond.group | Sales Users | Above+Beyond Sales | Scarlett Franklin | Active |
| Jeremy Merlo | jeremy.merlo@aboveandbeyond.group | Sales Users | Above+Beyond Sales | Scarlett Franklin | Active |
| Max Heighton | max@aboveandbeyond.group | Sales Users | Above+Beyond Sales | Scarlett Franklin | Active |
| Sam Renals | sam.renals@aboveandbeyond.group | Sales Users | Above+Beyond Sales | Scarlett Franklin | Active |
| Toby Davies | toby@aboveandbeyond.group | Sales Users | Above+Beyond Sales | Scarlett Franklin | Active |
| Tom Culpin | tom.culpin@aboveandbeyond.group | Sales Users | Above+Beyond Sales | Scarlett Franklin | Active |

### Sales Management

| Name | Username | Role | Profile | Manager |
|---|---|---|---|---|
| Leon O'Connor | leon@aboveandbeyond.group | Sales Management | Above+Beyond Sales | Scarlett Franklin |
| Sam Harrop | sam.harrop@aboveandbeyond.group | Sales Management | Above+Beyond Manager | Scarlett Franklin |

### SLT (Senior Leadership Team)

| Name | Username | Role | Profile |
|---|---|---|---|
| Scarlett Franklin | scarlett@aboveandbeyond.group | SLT | System Administrator |
| Max Venville | max.venville@aboveandbeyond.group | SLT | System Administrator |
| Robert Robinson | robert@aboveandbeyond.group | SLT | System Administrator |
| Kaley Eaton | kaley.eaton@aboveandbeyond.group | SLT | System Administrator |

### Operations

| Name | Username | Role | Profile |
|---|---|---|---|
| Lucy Wood | lucy.wood@aboveandbeyond.group | Operations | System Administrator |
| Molly Quelch | molly.quelch@aboveandbeyond.group | Operations | System Administrator |
| Rebecca Rayment | rebecca.rayment@aboveandbeyond.group | Operations | System Administrator |

### System/Integration Users (EXCLUDE from all user-facing views)

| Name | Username | Purpose |
|---|---|---|
| Marketing Logic | marketinglogic@aboveandbeyond.com | Admin automation account |
| MC Connect-CRM | mc-connect-crm@abovebeyond.com | Marketing Cloud sync |
| Jade-Dee Stevenson | jade.stevenson@aboveandbeyond.group | Admin (no role assigned) |
| Integration User | integration@00d8e000001zssaeag.com | Analytics Cloud |
| Insights Integration | insightsintegration@00d8e000001zssaeag.ext | Sales Insights |
| Security User | insightssecurity@00d8e000001zssaeag.com | Analytics Security |
| SalesforceIQ Integration | salesforceiqintegration@00d8e000001zssaeag.ext | Legacy |

### Likely Inactive Users

| Name | Last Login | Notes |
|---|---|---|
| Joe Newport | 16 Jan 2025 | Over 1 year ago — likely left the company |

### Access Control Matrix

| Role | Sees Own Data | Sees Team Data | Sees All Data |
|---|---|---|---|
| Sales Users | ✅ | ❌ | ❌ |
| Sales Management | ✅ | ✅ | ❌ |
| SLT | ✅ | ✅ | ✅ |
| Operations | Context-dependent | Context-dependent | Context-dependent |

---

## Key SOQL Queries

### Leads — Full List (for /leads page)
```sql
SELECT Id, Name, FirstName, LastName, Email, Phone, MobilePhone,
  Company, Title, Status, LeadSource, Rating,
  Score__c, Event_of_Interest__c, Interests__c,
  No_of_Guests__c, Form_Comments__c, Form_Type__c,
  Recent_Note__c, Tags__c, Unqualified_Reason__c,
  Last_Event_Booked__c, Web_to_Lead_Created__c,
  Web_to_Lead_Page_Information__c,
  Formula_1__c, Football__c, Rugby__c, Tennis__c,
  Live_Music__c, Culinary__c, Luxury_Lifestyle_Celebrity__c,
  Unique_Experiences__c, Other__c,
  LinkedIn__c, Facebook__c, Twitter__c,
  CreatedDate, LastModifiedDate, LastActivityDate,
  FirstCallDateTime,
  OwnerId, Owner.Name,
  I_agree_to_be_emailed__c, HasOptedOutOfEmail
FROM Lead
WHERE IsConverted = false
ORDER BY LastActivityDate DESC NULLS LAST
LIMIT 200
```

### Open Pipeline (for /pipeline Kanban)
```sql
SELECT Id, Name, StageName, Amount, CloseDate,
  AccountId, Account.Name,
  Opportunity_Contact__c, Opportunity_Contact__r.Name,
  Event__c, Event__r.Name, Event__r.Category__c, Event__r.Start_Date__c,
  Package_Sold__c, Package_Sold__r.Name,
  Total_Number_of_Guests__c,
  Percentage_Paid__c, Payment_Progress__c,
  Total_Amount_Paid__c, Total_Balance__c,
  Gross_Amount__c, Service_Charge__c, Processing_Fee__c, Tax_Amount__c,
  NextStep, Special_Requirements__c,
  Is_New_Business__c, LeadSource,
  OwnerId, Owner.Name,
  CreatedDate, LastModifiedDate, LastActivityDate
FROM Opportunity
WHERE IsClosed = false
ORDER BY LastModifiedDate DESC
```

### Closed Won This Month (for /sales leaderboard)
```sql
SELECT Id, Name, Amount, Gross_Amount__c, CloseDate,
  Account.Name, Opportunity_Contact__r.Name,
  Event__r.Name, Event__r.Category__c,
  Total_Number_of_Guests__c,
  OwnerId, Owner.Name
FROM Opportunity
WHERE StageName IN ('Agreement Signed', 'Amended', 'Amendment Signed')
  AND CloseDate = THIS_MONTH
ORDER BY CloseDate DESC
```

### Monthly Targets
```sql
SELECT Target_Amount__c, OwnerId, Owner.Name, Type__c, Month__c, Year__c
FROM Target__c
WHERE Year__c = '2026' AND Month__c = 'February'
```

### Monthly Commission
```sql
SELECT Sales_Person__c, Sales_Person__r.Name,
  Total_Monthly_commission__c, Commission_Rate_Applicable__c,
  Gross_Amount_Moved_to_Agreement_Signed__c,
  KPI_Targets__c, KPI_Targets_Met__c,
  Clawback__c, Amount_Paid_to_Salesperson__c,
  New_Bus_Ops__c, AVG_Call_Time__c,
  Avg_Rolling_Commission__c, Month__c, Year__c
FROM Commissions__c
WHERE Year__c = '2026'
ORDER BY Month__c DESC
```

### Upcoming Events (for /events page)
```sql
SELECT Id, Name, Category__c, Start_Date__c, End_Date__c,
  Location__c, Location__r.Name,
  Revenue_Target__c, Sum_of_Closed_Won_Gross__c,
  Percentage_to_Target__c, Margin_Percentage__c, Total_Margin_Value__c,
  Total_Booking_Cost__c, Total_Staff_Costs__c, Total_Payments_Received__c,
  Event_Tickets_Required__c, Event_Tickets_Booked__c, Event_Tickets_Remaining__c,
  Hospitality_Tickets_Required__c, Hospitality_Tickets_Booked__c, Hospitality_Tickets_Remaining__c,
  Hotel_Tickets_Required__c, Hotel_Tickets_Booked__c, Hotel_Tickets_Remaining__c,
  Dinner_Tickets_Required__c, Dinner_Tickets_Booked__c, Dinner_Tickets_Remaining__c,
  Drinks_Tickets_Required__c, Drinks_Tickets_Booked__c, Drinks_Tickets_Remaining__c,
  Party_Tickets_Required__c, Party_Tickets_Booked__c, Party_Tickets_Remaining__c,
  Total_Tickets_Required__c, Total_Tickets_Booked__c, Total_Tickets_Remaining__c,
  Percentage_Reservations_Completion__c,
  Total_Projects__c
FROM Event__c
WHERE Start_Date__c >= TODAY
ORDER BY Start_Date__c ASC
```

### Client 360 — Contact + Opportunities
```sql
-- Contact record
SELECT Id, Name, FirstName, LastName, Email, Phone, MobilePhone,
  AccountId, Account.Name, Title, LeadSource,
  LinkedIn__c, Total_Spend_to_Date__c, Total_Won_Opportunities__c,
  Tags__c, Interests__c, Recent_Note__c,
  OwnerId, Owner.Name, CreatedDate, LastActivityDate
FROM Contact
WHERE Id = '{contactId}'

-- Their opportunities
SELECT Id, Name, StageName, Amount, Gross_Amount__c, CloseDate,
  Event__r.Name, Event__r.Category__c, Event__r.Start_Date__c,
  Package_Sold__r.Name, Total_Number_of_Guests__c,
  Percentage_Paid__c, Total_Amount_Paid__c, Total_Balance__c,
  Special_Requirements__c
FROM Opportunity
WHERE Opportunity_Contact__c = '{contactId}'
ORDER BY CloseDate DESC

-- Their notes
SELECT Id, Name, CreatedDate, Owner.Alias
FROM A_B_Note__c
WHERE Contact__c = '{contactId}'
ORDER BY CreatedDate DESC
```

### Channel Attribution
```sql
SELECT LeadSource, COUNT(Id) totalLeads,
  SUM(Amount) totalRevenue, AVG(Amount) avgDealSize
FROM Opportunity
WHERE StageName IN ('Agreement Signed', 'Amended', 'Amendment Signed')
  AND CloseDate >= THIS_YEAR
GROUP BY LeadSource
ORDER BY SUM(Amount) DESC
```

---

## API Write-Back Patterns

### Update Lead Status
```
PATCH /services/data/v59.0/sobjects/Lead/{leadId}
Content-Type: application/json
Body: { "Status": "Working" }
```

### Update Lead Note
```
PATCH /services/data/v59.0/sobjects/Lead/{leadId}
Body: { "Recent_Note__c": "Called, interested in Monaco GP" }
```

### Update Opportunity Stage (Kanban drag)
```
PATCH /services/data/v59.0/sobjects/Opportunity/{oppId}
Body: { "StageName": "Deposit_Taken" }
```

### Convert Lead
```
POST /services/data/v59.0/actions/standard/convertLead
Body: {
  "inputs": [{
    "leadId": "{leadId}",
    "convertedStatus": "Qualified",
    "createOpportunity": true
  }]
}
```

### Create Task (log activity)
```
POST /services/data/v59.0/sobjects/Task
Body: {
  "Subject": "Call: Monaco GP enquiry",
  "WhoId": "{leadOrContactId}",
  "OwnerId": "{userId}",
  "Status": "Completed",
  "Type": "Call",
  "Description": "Discussed Monaco GP packages..."
}
```

### Run Arbitrary SOQL
```
GET /services/data/v59.0/query/?q={SOQL_QUERY_URL_ENCODED}
```

---

## Integration Notes

### Salesforce API Rate Limits
- Enterprise Edition: 100,000 API calls per 24 hours
- Professional Edition: 15,000 API calls per 24 hours
- Check edition. For ~15 users with 60s polling across pages, expect 20,000-30,000 calls/day.

### Caching Strategy
- Leads list: Cache 60 seconds, invalidate on write-back
- Pipeline: Cache 60 seconds, invalidate on stage change
- Events: Cache 5 minutes (rarely changes)
- Targets/Commission: Cache 15 minutes (monthly data)
- Client 360: Cache 2 minutes, load on demand

### Existing Integrations Active in Org
- **Aircall** — Call logging, AI objects, voice recording
- **Marketing Cloud (ET4AE5)** — Email campaigns, triggered sends, individual email results
- **Breadwinner** — Xero invoicing sync (invoices, line items, payments)
- **Stripe (BWP)** — Payment processing (customers, invoices, transactions, subscriptions)
- **Cadmus/PDF Butler** — Document generation, e-signatures
- **Companies House** — Company data enrichment on Accounts
- **Rollup Helper (rh2)** — Cross-object rollup calculations
- **Sales Cadences** — Built-in Salesforce sales engagement

### Known Issues
- **Score__c on Lead is broken** — All values are 99. Calculate lead score in the app instead.
- **Lusha lead source is INACTIVE** — Reactivate if using Lusha for outreach.
- **Joe Newport** — Last login Jan 2025, likely inactive user, should be deactivated.
- **Multiple "DELETE" Aircall numbers** — Some reps have duplicate/deprecated phone numbers (visible in Aircall Conversation Center).
