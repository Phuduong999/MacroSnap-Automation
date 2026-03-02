## ADDED Requirements

### Requirement: Open Gemini tab from URL
The system SHALL open a new browser tab with the Gemini Gem URL provided by the user.

#### Scenario: Open Gemini tab
- **WHEN** user pastes a Gemini URL (gemini.google.com/gem/...) and clicks "Open"
- **THEN** system opens a new tab with that URL and stores the tab ID for content script injection

### Requirement: Inject image via clipboard paste
The system SHALL fetch the image from the row's image URL via the background service worker (to bypass CSP), then inject it into the Gemini text editor using a synthetic ClipboardEvent paste.

#### Scenario: Inject image successfully
- **WHEN** system dispatches a ClipboardEvent with the image File on `.ql-editor.textarea`
- **THEN** an image preview (`img[data-test-id^="image-"]`) SHALL appear within 5 seconds

#### Scenario: Image fetch failure
- **WHEN** the background service worker fails to fetch the image URL
- **THEN** system SHALL mark the row as error with reason "Image fetch failed" and skip to next row

### Requirement: Inject JSON text
The system SHALL insert the JSON text from the row into the Gemini text editor using `document.execCommand('insertText')`.

#### Scenario: Inject text successfully
- **WHEN** system calls `execCommand('insertText', false, jsonText)` on the focused editor
- **THEN** the text SHALL appear in the `.ql-editor.textarea` element

### Requirement: Submit to Gemini
The system SHALL click the Send button (`button.send-button`) after image and text are injected.

#### Scenario: Click send
- **WHEN** system clicks `button.send-button`
- **THEN** Gemini SHALL start processing (Send button may change to Stop button)

#### Scenario: Send button disabled
- **WHEN** `button.send-button` has `aria-disabled="true"`
- **THEN** system SHALL wait and retry, or mark row as error if still disabled after 10 seconds

### Requirement: Wait for Gemini response
The system SHALL poll for a new `structured-content-container` element (count increases) and wait until streaming is complete (Stop button disappears).

#### Scenario: Response received
- **WHEN** `structured-content-container` count increases AND `button[aria-label="Stop response"]` is no longer in DOM
- **THEN** system SHALL extract `.innerText` from the last `structured-content-container`

#### Scenario: Response timeout
- **WHEN** no new `structured-content-container` appears within 60 seconds
- **THEN** system SHALL mark the row as error with reason "Response timeout"
