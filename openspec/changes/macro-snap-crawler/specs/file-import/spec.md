## ADDED Requirements

### Requirement: Upload CSV/XLSX file
The system SHALL allow users to upload a CSV or XLSX file via the Side Panel UI. The system SHALL parse the file and display all column headers for selection.

#### Scenario: Upload CSV file
- **WHEN** user selects a .csv file via the upload input
- **THEN** system parses the file and displays all column names as selectable options

#### Scenario: Upload XLSX file
- **WHEN** user selects a .xlsx file via the upload input
- **THEN** system parses the first sheet and displays all column names as selectable options

#### Scenario: Invalid file type
- **WHEN** user selects a file that is not .csv or .xlsx
- **THEN** system displays an error message and does not proceed

### Requirement: Select image and JSON columns
The system SHALL allow users to select which column contains image URLs and which column contains JSON data. Both columns MUST be selected before processing can start.

#### Scenario: Select columns
- **WHEN** user selects "Image URL column" and "JSON column" from dropdown lists
- **THEN** system stores the column mapping and enables the "Start" button

#### Scenario: Missing column selection
- **WHEN** user has not selected both columns
- **THEN** the "Start" button SHALL remain disabled

### Requirement: Parse file rows
The system SHALL parse each row from the uploaded file into an object with the selected column values accessible by their mapped roles (image URL, JSON data). The system SHALL preserve all original columns for output.

#### Scenario: Parse rows with selected columns
- **WHEN** file is parsed and columns are mapped
- **THEN** each row SHALL have accessible `imageUrl` and `jsonData` fields plus all original data
