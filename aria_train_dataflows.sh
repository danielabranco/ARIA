#!/bin/bash
# ARIA Training Script — IT.WI.019/R03 Dataflows
# Run this from your machine: bash aria_train_dataflows.sh
# Requires: curl

ARIA_API="http://localhost:4001"

post_knowledge() {
  local category="$1"
  local title="$2"
  local content="$3"

  response=$(curl -s -w "\n%{http_code}" -X POST "$ARIA_API/api/knowledge" \
    -H "Content-Type: application/json" \
    -d "{\"category\": $(echo "$category" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read().strip()))'), \"title\": $(echo "$title" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read().strip()))'), \"content\": $(echo "$content" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read().strip()))')}")

  http_code=$(echo "$response" | tail -1)
  echo "[$http_code] $title"
}

echo "=== Training ARIA: Dataflows (IT.WI.019/R03) ==="

post_knowledge \
  "Dataflow Standards" \
  "Dataflow Definition and Purpose" \
  "Source: IT.WI.019/R03 - Dataflows (OM Digital Solutions GmbH). Effective: 2025-10-03. Approved by Adriano Silvano, Reviewed by Rita Silva, Edited by Daniela Branco.

A dataflow refers to how data is collected, processed, and exchanged between internal and external systems. It shows the transfer of information (sometimes also material) from one part of the system to another.

NAMING CONVENTION: [SOURCE SYSTEM]-[DESTINATION SYSTEM] Brief description of what passes through. Example: [MAGENTO]-[MULESOFT] Customer Create.

All fields marked with * are MANDATORY in GLPI dataflow entries."

post_knowledge \
  "Dataflow Standards" \
  "Dataflow Mandatory Fields: GDPR Label, Status, Name" \
  "SOURCE: IT.WI.019/R03

MANDATORY FIELDS (*):
- Name*: Format [SOURCE]-[DESTINATION] Description
- GDPR Label*:
  - Level 1 - Customer Confidential Data: Directly identifiable data (names, addresses, email, phone numbers)
  - Level 2 - Indirect Customer Identification: Indirectly identifiable data (IP addresses, device identifiers) usable in combination to identify a person
  - Level 3 - Nonidentifiable/Anonymous Data
- Status*:
  - Active: online and running
  - Devel: in development
  - Removed: deleted
  - Stopped: not flowing but not removed (may flow again in future)
- Associable to a ticket*: Yes / No"

post_knowledge \
  "Dataflow Standards" \
  "Dataflow Fields: Description, Flow Group" \
  "SOURCE: IT.WI.019/R03

SHORT DESCRIPTION: Usually same as name; add more detail if the data passing needs clarification.

LONG DESCRIPTION: Optional extended description of the dataflow.

FLOW GROUP (categorizes the type of dataflow):
- Data Processing: Data information exchanged between systems database-to-database
- EDI Processing: Internal processes that change information in other systems via flow of information (e.g. ticket creation using Talend)
- External EDI: Dataflows managed by external parties"

post_knowledge \
  "Dataflow Standards" \
  "Dataflow Transfer Protocols" \
  "SOURCE: IT.WI.019/R03 — MANDATORY FIELD (*)

Available Transfer Protocols:
- AS2: Secure EDI transmission over internet using encryption and digital signatures
- EDI Connectivity: Standardized electronic business document exchange between organizations
- ETL Transfer: Extract-Transform-Load; data integration for warehousing and analytics
- Flat File: Plain text file format, records per line, fields delimited (comma, tab, pipe)
- FTP: File Transfer Protocol over TCP/IP network
- JSON: Lightweight data interchange format; used between server and web app
- SAP Extractor: Extracts data from SAP systems for reporting/analytics/integration (part of SAP BI)
- SQL: Structured Query Language for relational database CRUD operations
- VPN: Encrypted private tunnel over public network
- Web Service: Standardized app-to-app communication over internet using open protocols
- WSDL/SOAP: Structured info exchange as web services over HTTP/HTTPS; enterprise-grade
- XML: Markup language for hierarchical human- and machine-readable data"

post_knowledge \
  "Dataflow Standards" \
  "Dataflow Characteristics: Mode, Pattern, Type, Indicator" \
  "SOURCE: IT.WI.019/R03

STATUS START DATE: Date the dataflow was first put in place / built.

MODE (Full/Delta):
- Delta Transfer: Partial replication using filters or conditions
- Full Transfer: Entire structure pulled with no constraints

PATTERN (messaging pattern):
- Fire and Forget: Sender transmits without expecting acknowledgment
- Guaranteed Delivery: Delivery ensured even if initial transmission fails
- Request-Reply, Asynchronous: Reply expected but sender does not block/wait
- Request-Reply, Synchronous: Sender waits for immediate response before proceeding

TYPE (complexity):
- High Complexity: Many components, interactions, and dependencies
- Medium Complexity: Moderate challenge and interactivity
- Low Complexity (labeled Low Priority): Simple, few variables, minimal effort/skills

INDICATOR (documentation status):
- Good Documentation: Comprehensive, well-organized, up-to-date materials
- No Documentation: Absence of any written materials
- Partial Documentation: Incomplete/fragmented materials covering only some aspects"

post_knowledge \
  "Dataflow Standards" \
  "Dataflow Authentication and Data Structure" \
  "SOURCE: IT.WI.019/R03

SOURCE & DESTINATION AUTHENTICATION TYPE:
- API Key Authentication: Unique identifiers shared between source and destination to authorize data transfers
- Basic Authentication: Username/password encoded in base64 sent with each request
- LDAP/Active Directory (AD) Authentication: Centralized directory service authentication (e.g. Microsoft Active Directory)

SOURCE & DESTINATION DATA STRUCTURE:
Field exists to document the data structure at both the source and destination ends of the dataflow."

post_knowledge \
  "Dataflow Standards" \
  "Dataflow Operational Characteristics: Triggers and Frequency" \
  "SOURCE: IT.WI.019/R03

TRANSFER TRIGGERS (what initiates the data movement):
- Manual Triggers: User manually initiates transfer
- Scheduled Triggers (Time-Based): Predefined times (hourly, daily, weekly)
- Event-Based Triggers: Specific events/actions/changes in the system
- API Call Triggers: External system makes API request to GLPI or plugin
- Webhook Triggers: HTTP callbacks pushed in real-time on specific events
- File-Based Triggers: File added/modified/detected in a local or cloud directory
- Real-Time Streaming Triggers: Continuous transfer as data is generated
- User Action Triggers: Specific user actions within the system
- Conditional Logic Triggers: Conditions met based on logical rules (if this then that)

TRANSFER FREQUENCY:
- Real-Time: Immediately as data is available or changes occur
- Daily: Once per day
- Weekly: One day per week at set time (e.g. Sunday 8am)
- On Demand (Ad-Hoc): Only when explicitly requested by user or system
- Batch Processing: Large batches during non-peak hours
- Event-Driven: When a specific event occurs regardless of time/schedule"

post_knowledge \
  "Dataflow Standards" \
  "Dataflow Error Handling and Priority" \
  "SOURCE: IT.WI.019/R03

TRANSFER ERROR HANDLING:
- Logging and Monitoring: All transfer operations must be logged; errors recorded in detail for debugging and auditing (e.g. log catcher on database)
- Alerting and Notifications: Email notifications sent to admins/users when transfer fails for quick intervention (e.g. bibu.support@om-digitalsolutions.com)

PRIORITY:
- High-Priority: Most critical transfers; must be processed immediately regardless of other tasks when error occurs
- Medium-Priority: Important transfers that must happen within a timeframe but can tolerate some delay without impacting business
- Low-Priority: Non-urgent transfers; processed during off-peak times or when resources available; delays do not impact business

DOCUMENTATION LINKS:
- URL to Functional Doc (mapping, etc.)
- URL to Technical Doc (design, etc.)"

post_knowledge \
  "Dataflow Standards" \
  "Dataflow Contacts and Ownership" \
  "SOURCE: IT.WI.019/R03

CONTACTS (ownership and support structure):
- Dataflow Group: Group responsible for management, control, and approving any changes to the dataflow
- Dataflow Expert: User expert in the dataflow (e.g. who can access or modify specific data)
- External Partner:
  - External party responsible for the dataflow (when Flow Group = External EDI)
  - External party who can support in-house internal EDI or data processing dataflows
- Dataflow Support: Backup group (if applicable)"

echo ""
echo "=== Done. All entries submitted to ARIA. ==="
