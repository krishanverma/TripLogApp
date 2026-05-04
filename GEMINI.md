# Trip Log App - Project Documentation

## Project Overview
The **Trip Log App** is a specialized serverless web application designed for logistics management (specifically tailored for EFL Transport Inc.). It enables drivers to log trip details, track expenses, and generate professional PDF reports for accounting and fleet management. The application utilizes **Firebase** for real-time data management and secure user authentication, hosted as a static site (e.g., GitHub Pages), ensuring a lightweight and cost-effective architecture.

## Core Modules

### 1. Trip Entry Terminal (`app.js`)
- **Long-Haul Trips**: Logs order numbers, pickup/delivery dates, and locations.
- **Local Work**: A specialized mode for hourly work, calculating duration.
- **Smart Autocomplete**: Integrates with the **Photon (OpenStreetMap) API** for real-time city and state suggestions.
- **Distance Estimation**: Utilizes the **OSRM API** to provide automatic mileage estimates between pickup and delivery coordinates.
- **Security**: Implements client-side HTML sanitization to prevent XSS and leverages Firestore Security Rules for data isolation.
- **UI Experience**: Defaults to **Dark Mode** for reduced eye strain during night shifts, with persistent preference storage.

### 2. Trip History Viewer (`viewer.js`)
- **Data Management**: Provides a searchable and filterable history of all logged trips.
- **Cloud Storage**: Fetches authenticated data from Cloud Firestore, optimized with indices for date-based sorting.
- **Fleet Reporting**: Generates a professional PDF "Fleet Report" using `jsPDF`. It features a custom handwriting font for a traditional "form-filled" aesthetic and includes "Office Use Only" sections for administrative processing.

### 3. Expense Manager (`expenses.js`)
- **Multi-Currency Logging**: Supports CAD and USD entries.
- **Currency Conversion**: Specifically tracks CAD equivalents for USD expenses to assist in cross-border accounting.
- **Accounting Reports**: Generates PDF expense sheets categorized by currency, ready for submission to accounting.

### 4. Persistence Layer (Firestore)
- **Cloud Firestore**: A NoSQL cloud database providing real-time synchronization and secure user-level access via Security Rules.
- **Firebase Authentication**: Manages secure driver logins using Email/Password providers.

### 5. UI & Utilities (`ui-utils.js`)
- **Real-time Status**: A dynamic status indicator tracking connection state (Online, Syncing, Error, Offline).
- **Theme Engine**: Persistent Dark/Light mode support based on user preference and system settings.

## Database Schema (Firestore)

### 1. Collection: `trips`
| Field | Type | Description |
| :--- | :--- | :--- |
| `userId` | String | Firebase Auth UID (Document Owner) |
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
| `isPickupDone` | String | enum: `no`, `yes`, `extra` |
| `isDeliveryDone` | String | enum: `no`, `yes`, `extra` |
| `miles` | Number | Calculated or manual mileage |

### 2. Collection: `expenses`
| Field | Type | Description |
| :--- | :--- | :--- |
| `userId` | String | Firebase Auth UID (Document Owner) |
| `created_at` | ISO8601 | Timestamp of entry |
| `date` | String | Transaction date |
| `amount` | Float | Numeric cost |
| `currency` | String | enum: `CAD`, `USD` |
| `cadAmount` | Float/Null | Converted amount for USD entries |
| `note` | String | Description/Reference |

### 3. Collection: `settings`
| Field | Type | Description |
| :--- | :--- | :--- |
| `payRates` | Object | Map of compensation rates |
| ↳ `mileRate` | Number | Pay per mile |
| ↳ `pickRate` | Number | Standard pickup rate |
| ↳ `dropRate` | Number | Standard delivery rate |
| ↳ `mbPickRate` | Number | Manitoba pickup rate |
| ↳ `mbDropRate` | Number | Manitoba delivery rate |
| ↳ `extraPickRate` | Number | Additional/Extra pickup rate |
| ↳ `extraDropRate` | Number | Additional/Extra delivery rate |
| ↳ `localRate` | Number | Hourly rate for local work |
| ↳ `tarpRates` | Object | Map for Steel/Lumber/None |

## Security Model
- **Single User Access**: Registration is disabled via the application UI. Accounts must be created manually through the Firebase Console to prevent unauthorized sign-ups.
- **Firestore Security Rules**: Restricted access ensures users can only `read`, `write`, or `delete` documents where `request.auth.uid == resource.data.userId`.
- **Authorized Domains**: API restrictions prevent unauthorized usage of Firebase keys outside of the production domain.

## Technical Stack
- **Frontend**: Vanilla JavaScript (ES6+), Tailwind CSS for styling.
- **Backend**: Firebase (Firestore & Auth).
- **Mapping & Routing**: Photon API (Geocoding), OSRM (Routing).
- **PDF Generation**: `jsPDF` and `jsPDF-AutoTable`.

---
*Last Updated: May 2024 (Production Ready - Tests Removed)*
*Author: Gemini Code Assist*