## ADDED Requirements

### Requirement: Save result immediately after each row
The system SHALL persist the result to `chrome.storage.local` immediately after each row is processed. Data MUST NOT be held only in memory.

#### Scenario: Row completed successfully
- **WHEN** a row is processed and response is parsed
- **THEN** system SHALL save the result (original data + parsed fields) to `chrome.storage.local` immediately

#### Scenario: Row failed with error
- **WHEN** a row fails (image fetch error, timeout, parse error)
- **THEN** system SHALL save the row with error status and reason to `chrome.storage.local` immediately

### Requirement: Download output file
The system SHALL allow users to download the results as a CSV file at any time. The output file SHALL contain all original columns plus the parsed result columns.

#### Scenario: Download with partial results
- **WHEN** user clicks "Download" while processing is still running
- **THEN** system SHALL generate a CSV with all completed rows (including errors) and trigger a file download

#### Scenario: Download after completion
- **WHEN** all rows are processed and user clicks "Download"
- **THEN** system SHALL generate a CSV with all rows and their results

### Requirement: Resume after extension restart
The system SHALL be able to resume processing from the last completed row if the extension is restarted or the browser is closed.

#### Scenario: Resume processing
- **WHEN** extension restarts and there is an incomplete job in `chrome.storage.local`
- **THEN** Side Panel SHALL show the job status and allow user to resume from the next unprocessed row
