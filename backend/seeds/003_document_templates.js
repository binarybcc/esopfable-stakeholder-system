/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> } 
 */
exports.seed = async function(knex) {
  // Clear existing entries
  await knex('document_templates').del();
  
  // Insert seed entries
  await knex('document_templates').insert([
    {
      id: '770e8400-e29b-41d4-a716-446655440001',
      name: 'ERISA Complaint Template',
      description: 'Standard template for ERISA fiduciary breach complaints',
      template_type: 'legal_filing',
      template_content: `UNITED STATES DISTRICT COURT
FOR THE [DISTRICT]

[PLAINTIFF_NAME], et al.,
                    Plaintiffs,
v.                                          Case No. [CASE_NUMBER]
[DEFENDANT_NAME], et al.,
                    Defendants.

COMPLAINT FOR VIOLATIONS OF THE EMPLOYEE RETIREMENT INCOME SECURITY ACT

Plaintiffs [PLAINTIFF_NAME] bring this action under the Employee Retirement Income Security Act of 1974 ("ERISA"), 29 U.S.C. § 1001 et seq., alleging breaches of fiduciary duty in connection with the [PLAN_NAME] Employee Stock Ownership Plan ("Plan").

[FACTUAL_BACKGROUND]
[CLAIMS_FOR_RELIEF]
[PRAYER_FOR_RELIEF]`,
      required_fields: [
        {name: 'DISTRICT', type: 'text', description: 'Federal judicial district'},
        {name: 'PLAINTIFF_NAME', type: 'text', description: 'Lead plaintiff name'},
        {name: 'CASE_NUMBER', type: 'text', description: 'Court case number'},
        {name: 'DEFENDANT_NAME', type: 'text', description: 'Primary defendant'},
        {name: 'PLAN_NAME', type: 'text', description: 'ESOP plan name'}
      ],
      optional_fields: [
        {name: 'FACTUAL_BACKGROUND', type: 'textarea', description: 'Case background facts'},
        {name: 'CLAIMS_FOR_RELIEF', type: 'textarea', description: 'Legal claims'},
        {name: 'PRAYER_FOR_RELIEF', type: 'textarea', description: 'Requested relief'}
      ],
      classification: 'confidential',
      created_by: '550e8400-e29b-41d4-a716-446655440001',
      usage_count: 0,
      created_at: knex.fn.now(),
      updated_at: knex.fn.now()
    },
    {
      id: '770e8400-e29b-41d4-a716-446655440002',
      name: 'Press Release Template',
      description: 'Standard press release for case announcements',
      template_type: 'press_release',
      template_content: `FOR IMMEDIATE RELEASE
[DATE]

[HEADLINE]

[LOCATION] – [LEAD_PARAGRAPH describing the key announcement or development]

[BACKGROUND_PARAGRAPH providing context about the case]

[QUOTE from attorney or spokesperson]: "[QUOTE_TEXT]"

[ADDITIONAL_DETAILS about the case, timeline, or implications]

About [LAW_FIRM_NAME]:
[FIRM_BACKGROUND]

Contact:
[CONTACT_NAME]
[PHONE]
[EMAIL]`,
      required_fields: [
        {name: 'DATE', type: 'date', description: 'Release date'},
        {name: 'HEADLINE', type: 'text', description: 'Press release headline'},
        {name: 'LOCATION', type: 'text', description: 'City, State'},
        {name: 'LEAD_PARAGRAPH', type: 'textarea', description: 'Opening paragraph'},
        {name: 'CONTACT_NAME', type: 'text', description: 'Media contact name'},
        {name: 'PHONE', type: 'text', description: 'Contact phone'},
        {name: 'EMAIL', type: 'text', description: 'Contact email'}
      ],
      optional_fields: [
        {name: 'BACKGROUND_PARAGRAPH', type: 'textarea', description: 'Case background'},
        {name: 'QUOTE_TEXT', type: 'textarea', description: 'Spokesperson quote'},
        {name: 'ADDITIONAL_DETAILS', type: 'textarea', description: 'Additional information'},
        {name: 'LAW_FIRM_NAME', type: 'text', description: 'Law firm name'},
        {name: 'FIRM_BACKGROUND', type: 'textarea', description: 'Firm description'}
      ],
      classification: 'internal',
      created_by: '550e8400-e29b-41d4-a716-446655440001',
      usage_count: 0,
      created_at: knex.fn.now(),
      updated_at: knex.fn.now()
    },
    {
      id: '770e8400-e29b-41d4-a716-446655440003',
      name: 'Witness Interview Form',
      description: 'Structured template for witness interviews',
      template_type: 'witness_interview',
      template_content: `CONFIDENTIAL WITNESS INTERVIEW

Date: [DATE]
Time: [TIME] 
Location: [LOCATION]
Interviewer(s): [INTERVIEWER_NAMES]
Witness: [WITNESS_NAME]
Title/Role: [WITNESS_TITLE]

BACKGROUND:
- Years with company: [YEARS_SERVICE]
- Department: [DEPARTMENT] 
- Reporting structure: [REPORTING_STRUCTURE]

AREAS OF KNOWLEDGE:
[X] Financial operations
[X] ESOP administration  
[X] Board meetings/decisions
[X] Document creation/destruction
[X] Other: [OTHER_KNOWLEDGE]

KEY TESTIMONY:
[TESTIMONY_SUMMARY]

SUPPORTING DOCUMENTS IDENTIFIED:
[DOCUMENT_LIST]

CREDIBILITY ASSESSMENT:
[CREDIBILITY_NOTES]

FOLLOW-UP REQUIRED:
[FOLLOW_UP_ACTIONS]`,
      required_fields: [
        {name: 'DATE', type: 'date', description: 'Interview date'},
        {name: 'TIME', type: 'time', description: 'Interview time'},
        {name: 'INTERVIEWER_NAMES', type: 'text', description: 'Interviewer names'},
        {name: 'WITNESS_NAME', type: 'text', description: 'Witness full name'},
        {name: 'WITNESS_TITLE', type: 'text', description: 'Current or former title'}
      ],
      optional_fields: [
        {name: 'LOCATION', type: 'text', description: 'Interview location'},
        {name: 'YEARS_SERVICE', type: 'number', description: 'Years with company'},
        {name: 'DEPARTMENT', type: 'text', description: 'Work department'},
        {name: 'REPORTING_STRUCTURE', type: 'text', description: 'Who they reported to'},
        {name: 'OTHER_KNOWLEDGE', type: 'text', description: 'Other relevant knowledge'},
        {name: 'TESTIMONY_SUMMARY', type: 'textarea', description: 'Key testimony points'},
        {name: 'DOCUMENT_LIST', type: 'textarea', description: 'Relevant documents'},
        {name: 'CREDIBILITY_NOTES', type: 'textarea', description: 'Credibility assessment'},
        {name: 'FOLLOW_UP_ACTIONS', type: 'textarea', description: 'Required follow-up'}
      ],
      classification: 'confidential',
      created_by: '550e8400-e29b-41d4-a716-446655440001',
      usage_count: 0,
      created_at: knex.fn.now(),
      updated_at: knex.fn.now()
    },
    {
      id: '770e8400-e29b-41d4-a716-446655440004',
      name: 'Evidence Log Template',
      description: 'Chain of custody and evidence documentation',
      template_type: 'evidence_log',
      template_content: `EVIDENCE LOG - CONFIDENTIAL

Evidence ID: [EVIDENCE_ID]
Case: [CASE_NAME]
Date Collected: [COLLECTION_DATE]
Collected By: [COLLECTOR_NAME]

DESCRIPTION:
Type: [EVIDENCE_TYPE]
Description: [DESCRIPTION]
Source: [SOURCE]
Location Found: [LOCATION]

CHAIN OF CUSTODY:
[CUSTODY_DATE] - [PERSON_NAME] - [ACTION] - [SIGNATURE]
[CUSTODY_DATE] - [PERSON_NAME] - [ACTION] - [SIGNATURE]

INTEGRITY VERIFICATION:
Hash: [FILE_HASH]
Verified By: [VERIFIER_NAME]
Verification Date: [VERIFICATION_DATE]

SIGNIFICANCE RATING: [RATING] / 10
Notes: [NOTES]`,
      required_fields: [
        {name: 'EVIDENCE_ID', type: 'text', description: 'Unique evidence identifier'},
        {name: 'CASE_NAME', type: 'text', description: 'Case name or number'},
        {name: 'COLLECTION_DATE', type: 'date', description: 'When evidence was collected'},
        {name: 'COLLECTOR_NAME', type: 'text', description: 'Who collected the evidence'},
        {name: 'EVIDENCE_TYPE', type: 'select', options: ['document', 'email', 'financial_record', 'recording', 'photo', 'other']},
        {name: 'DESCRIPTION', type: 'textarea', description: 'Detailed description'}
      ],
      optional_fields: [
        {name: 'SOURCE', type: 'text', description: 'Evidence source'},
        {name: 'LOCATION', type: 'text', description: 'Where found'},
        {name: 'FILE_HASH', type: 'text', description: 'File integrity hash'},
        {name: 'VERIFIER_NAME', type: 'text', description: 'Who verified integrity'},
        {name: 'VERIFICATION_DATE', type: 'date', description: 'Verification date'},
        {name: 'RATING', type: 'number', description: 'Significance rating 1-10'},
        {name: 'NOTES', type: 'textarea', description: 'Additional notes'}
      ],
      classification: 'secret',
      created_by: '550e8400-e29b-41d4-a716-446655440001',
      usage_count: 0,
      created_at: knex.fn.now(),
      updated_at: knex.fn.now()
    }
  ]);
};