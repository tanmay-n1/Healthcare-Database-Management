# Healthcare Database System

## Overview
The Healthcare Database System is a backend service built using Node.js and Express to manage hospital operations. It provides secure authentication, database interactions, and API endpoints for handling users, appointments, and medical records.

## Features
- **User Authentication:** Secure login and session management with bcrypt hashing.
- **Database Management:** Uses MSSQL to store and retrieve patient, doctor, and appointment data.
- **REST API Endpoints:** Handles requests for patient records, appointments, and reports.
- **Session Handling:** Express-session for secure user sessions.

## Technologies Used
- **Node.js & Express.js** - Backend framework
- **MSSQL** - Database management
- **bcrypt** - Password hashing for security
- **express-session** - User session management

## Installation
### Prerequisites
- Node.js (latest version recommended)
- Microsoft SQL Server (MSSQL)
- Required npm packages (install via `npm install`)

### Steps to Install
1. **Clone the repository**:
   ```sh
   git clone https://github.com/your-repo/HealthcareDB-Backend.git
   cd HealthcareDB-Backend
   ```
2. **Install dependencies**:
   ```sh
   npm install
   ```
3. **Set up the database**:
   - Update the database configuration in `server.js` with correct MSSQL credentials.
   - Ensure the SQL Server is running.
4. **Start the server**:
   ```sh
   node server.js
   ```

## API Endpoints
| Method | Endpoint            | Description                          |
|--------|---------------------|--------------------------------------|
| POST   | `/login`            | Authenticates a user                 |
| POST   | `/register`         | Registers a new user                 |
| GET    | `/appointments`     | Retrieves all appointments           |
| POST   | `/appointments`     | Schedules a new appointment          |
| GET    | `/patients/:id`     | Fetches details of a specific patient |
| GET    | `/reports`          | Retrieves hospital analytics data    |

## Database Configuration
Modify the following settings in `server.js` to match your database:
```js
const config = {
    user: 'your-db-user',
    password: 'your-db-password',
    server: 'your-db-host',
    database: 'hospital_db',
    options: {
        trustServerCertificate: true
    }
};
```

## Troubleshooting
- If the server fails to connect, check the MSSQL credentials and database availability.
- Ensure required npm packages are installed using `npm install`.
- Restart the server after making configuration changes.

## License
This project is open-source and available under the MIT License.

## Contact
For queries or contributions, please contact: tanmaynedu@gmail.com

