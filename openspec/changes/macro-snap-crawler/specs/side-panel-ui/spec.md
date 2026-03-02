## ADDED Requirements

### Requirement: Side Panel activation
The system SHALL register as a Chrome Side Panel and open when user clicks the extension icon.

#### Scenario: Open side panel
- **WHEN** user clicks the extension icon in Chrome toolbar
- **THEN** the Side Panel SHALL open with the main UI

### Requirement: Gemini URL input
The system SHALL provide a text input for the Gemini Gem thread URL and a button to open it in a new tab.

#### Scenario: Enter and open URL
- **WHEN** user pastes a URL like `https://gemini.google.com/gem/...` and clicks "Open"
- **THEN** system SHALL open the URL in a new tab and store the tab reference

### Requirement: File upload with column selection
The system SHALL provide a file upload area and dropdown selectors for mapping columns.

#### Scenario: Upload and select columns
- **WHEN** user uploads a file and selects image + JSON columns
- **THEN** system SHALL display a summary (total rows, selected columns) and enable "Start Processing"

### Requirement: Processing progress display
The system SHALL display real-time progress during processing, showing status for each row.

#### Scenario: Show progress
- **WHEN** processing is running
- **THEN** UI SHALL show: current row number / total, status per row (waiting/processing/done/error), and a progress bar

### Requirement: Pause and Resume controls
The system SHALL provide Pause and Resume buttons during processing.

#### Scenario: Pause processing
- **WHEN** user clicks "Pause"
- **THEN** system SHALL stop after the current row completes and save state

#### Scenario: Resume processing
- **WHEN** user clicks "Resume" after pause or extension restart
- **THEN** system SHALL continue from the next unprocessed row

### Requirement: Download results button
The system SHALL provide a "Download Results" button that is enabled whenever there are completed rows.

#### Scenario: Download results
- **WHEN** user clicks "Download Results"
- **THEN** system SHALL generate and download a CSV file with all results so far
