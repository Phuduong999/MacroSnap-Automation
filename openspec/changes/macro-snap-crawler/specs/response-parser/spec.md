## ADDED Requirements

### Requirement: Parse Gemini response text
The system SHALL parse the raw text response from Gemini into structured fields. The expected format is key-value pairs separated by newlines.

#### Scenario: Parse standard response
- **WHEN** Gemini response text is:
  ```
  Skip: NO
  Scan Type: Meal
  Results Return: Wrong Result
  FeedBack Correction: incorrect nutrition
  Reason: blurry image
  ```
- **THEN** system SHALL produce an object:
  ```json
  {
    "skip": "NO",
    "scanType": "Meal",
    "resultReturn": "Wrong Result",
    "feedbackCorrection": "incorrect nutrition",
    "reason": "blurry image"
  }
  ```

#### Scenario: Parse skip-only response
- **WHEN** Gemini response text is:
  ```
  Skip: YES
  Reason: blurry image or blended items
  ```
- **THEN** system SHALL produce an object with `skip: "YES"` and `reason: "blurry image or blended items"`, with other fields as empty strings

#### Scenario: Unparseable response
- **WHEN** Gemini response text does not match expected key-value format
- **THEN** system SHALL store the raw text as `rawResponse` field and mark row as "parse_error"

### Requirement: Map parsed fields to output columns
The system SHALL map parsed response fields to the corresponding output columns:

| Parsed Field | Output Column |
|-------------|---------------|
| skip | label skip? |
| scanType | Scan Type? |
| resultReturn | Result Return |
| feedbackCorrection | feedback correction? |
| reason | Reason? |

#### Scenario: Map fields to columns
- **WHEN** response is successfully parsed
- **THEN** each field SHALL be written to its corresponding output column in the result row
