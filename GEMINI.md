# Trip Log App - Project Documentation

## Project Overview
The **Trip Log App** is a specialized serverless web application designed for logistics management (specifically tailored for EFL Transport Inc.). It enables drivers to log trip details, track expenses, and generate professional PDF reports for accounting and fleet management. The application uses GitHub as a backend for data persistence, ensuring a lightweight and cost-effective architecture.

## Core Modules

### 1. Trip Entry Terminal (`app.js`)
- **Long-Haul Trips**: Logs order numbers, pickup/delivery dates, and locations.
- **Local Work**: A specialized mode for hourly work, calculating duration between check-in and check-out times.
- **Smart Autocomplete**: Integrates with the **Photon (OpenStreetMap) API** for real-time city and state suggestions.
- **Distance Estimation**: Utilizes the **OSRM API** to provide automatic mileage estimates between pickup and delivery coordinates.

### 2. Trip History Viewer (`viewer.js`)
- **Data Management**: Provides a searchable and filterable history of all logged trips.
- **Sidecar Data**: Synchronizes with a `miles.json` file to track estimated distances alongside primary trip logs.
- **Fleet Reporting**: Generates a professional PDF "Fleet Report" using `jsPDF`. It features a custom handwriting font for a traditional "form-filled" aesthetic and includes "Office Use Only" sections for administrative processing.

### 3. Expense Manager (`expenses.js`)
- **Multi-Currency Logging**: Supports CAD and USD entries.
- **Currency Conversion**: Specifically tracks CAD equivalents for USD expenses to assist in cross-border accounting.
- **Accounting Reports**: Generates PDF expense sheets categorized by currency, ready for submission to accounting.

### 4. Persistence Layer (`github.js`)
- **GitHub as a Database**: Uses the GitHub REST API to store and retrieve JSON files (`trips.json`, `expenses.json`, `miles.json`).
- **SHA Handling**: Manages file versioning (SHAs) to ensure data integrity during updates and deletions.

### 5. UI & Utilities (`ui-utils.js`)
- **Real-time Status**: A dynamic status indicator tracking connection state (Online, Syncing, Error, Offline).
- **Theme Engine**: Persistent Dark/Light mode support based on user preference and system settings.

## Database Schema (JSON)

### 1. `trips.json` (Main Collection)
| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | UUID | Primary Key |
| `created_at` | ISO8601 | Timestamp of entry |
| `tripMode` | String | enum: `long-haul`, `local-work` |
| `order` | String | Order reference (or "LOCAL WORK" string) |
| `truck` | String | Truck identifier (Upper Case) |
| `trailer` | String | Trailer number |
| `tarp` | String | enum: `None`, `Steel`, `Lumber` |
| `pDate` | String | Pickup date (YYYY-MM-DD) |
| `pCity` | String | Pickup location or hourly calculation string |
| `dDate` | String | Delivery date (YYYY-MM-DD) |
| `dCity` | String | Delivery location or "LOCAL" indicator |
| `codriver` | String | Name or "N/A" |
| `isPickupDone` | Boolean | True if user confirmed pickup |
| `isDeliveryDone` | Boolean | True if user confirmed delivery |

### 2. `expenses.json` (Financial Ledger)
| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | UUID | Primary Key |
| `created_at` | ISO8601 | Timestamp of entry |
| `date` | String | Transaction date |
| `amount` | Float | Numeric cost |
| `currency` | String | enum: `CAD`, `USD` |
| `cadAmount` | Float/Null | Converted amount for USD entries |
| `note` | String | Description/Reference |

### 3. `miles.json` (Sidecar Data)
*Stored as a Key-Value Map to optimize retrieval and reduce primary file size.*
```json
{
  "trip_id_uuid": "1250"
}
```

## Data Integrity & Concurrency
- **SHA Pinning**: All updates require the `sha` of the existing file to prevent "lost updates" (Optimistic Locking).
- **Atomic Pushes**: `app.js` performs dual-writes to `miles.json` and `trips.json` to keep relationships synchronized.

## Technical Stack
- **Frontend**: Vanilla JavaScript (ES6+), Tailwind CSS for styling.
- **Storage**: GitHub Contents API.
- **Mapping & Routing**: Photon API (Geocoding), OSRM (Routing).
- **PDF Generation**: `jsPDF` and `jsPDF-AutoTable`.

## Testing Suite
The application includes a built-in test runner (`tests.js`) and integration tests (`logging-test.js`) that validate:
- UI theme toggling and local storage persistence.
- Accuracy of local work hour calculations.
- GitHub API connectivity and error handling.
- PDF generation workflows and data filtering logic.
- Trip mode state transitions and UI input validation (Read-only/Visibility logic).

---
*Last Updated: May 2024 (Database Outline Added)*
*Author: Gemini Code Assist*