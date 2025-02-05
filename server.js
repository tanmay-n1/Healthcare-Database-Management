// server.js
const express = require('express');
const sql = require('mssql');
const bcrypt = require('bcrypt');
const session = require('express-session');
const path = require('path');
const { Console } = require('console');
const router = express.Router();

const app = express();


// Database configuration
const config = {
    user: 'frontend',
    password: 'pass',
    server: '192.168.0.19',
    database: 'hospital_db',
    options: {
        trustServerCertificate: true
    }
};

// Middleware
app.use(express.static('public')); /////added for reports
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(session({
    secret: 'healthcare-secret-key',
    resave: false,
    saveUninitialized: false
}));

// Database connection
async function connectDB() {
    try {
        await sql.connect(config);
        console.log('Connected to database');
    } catch (err) {
        console.error('Database connection failed:', err);
    }
}

connectDB();

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});
app.delete('/api/appointments/:appointmentId', async (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const appointmentId = req.params.appointmentId;

    // Create a new transaction
    const transaction = new sql.Transaction();

    try {
        // Begin the transaction
        await transaction.begin();

        // Check if the appointment exists in the Tests table
        const testCheckResult = await transaction.request().query`
            SELECT COUNT(*) AS testCount
            FROM Tests
            WHERE appointment_ID = ${appointmentId};
        `;

        const testCount = testCheckResult.recordset[0].testCount;

        if (testCount > 0) {
            // If the appointment exists in the Tests table, delete from both Tests and Appointments
            await transaction.request().query`
                DELETE FROM Tests 
                WHERE appointment_ID = ${appointmentId};
            `;
        }

        // Delete the appointment from the Appointments table
        const appointmentDeleteResult = await transaction.request().query`
            DELETE FROM Appointment
            WHERE appointment_ID = ${appointmentId}
            AND patient_ID = ${req.session.user.id};
        `;

        // Commit the transaction
        await transaction.commit();

        if (appointmentDeleteResult.rowsAffected[0] > 0) {
            res.json({ success: true });
        } else {
            res.status(404).json({ success: false, message: 'Appointment not found or unauthorized.' });
        }
    } catch (error) {
        // Rollback the transaction in case of an error
        if (transaction._aborted === false) {
            await transaction.rollback();
        }
        console.error('Error deleting appointment:', error);
        res.status(500).json({ error: 'Server error' });
    }
});



app.post('/createPatientAccount', async (req, res) => {
    const { username, password, patientName, bloodGroup, dob, gender, phone } = req.body;

    // Add phone format validation on server side
    const phoneRegex = /^\(\d{3}\)\s\d{3}-\d{4}$/;
    if (!phoneRegex.test(phone)) {
        return res.json({ 
            success: false, 
            message: 'Invalid phone number format. Required format: (XXX) XXX-XXXX' 
        });
    }

    try {
        // Check if username already exists
        const checkUser = await sql.query`
            SELECT COUNT(*) AS count FROM Accounts WHERE username = ${username}
        `;
        if (checkUser.recordset[0].count > 0) {
            return res.json({ success: false, message: 'Username already exists' });
        }

        // Hash the password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Start a transaction to insert into both Accounts and Patient tables
        const transaction = new sql.Transaction();
        await transaction.begin();

        try {
            // Insert into Accounts table
            const accountInsertResult = await transaction.request().query`
                INSERT INTO Accounts (username, password) 
                VALUES (${username}, ${hashedPassword});
                
                SELECT SCOPE_IDENTITY() AS cred_ID;
            `;

            const cred_ID = accountInsertResult.recordset[0].cred_ID;

            // Insert into Patient table with the formatted phone number
            await transaction.request().query`
                INSERT INTO Patient (cred_ID, patientName, bloodGroup, dob, gender, phone) 
                VALUES (${cred_ID}, ${patientName}, ${bloodGroup}, ${dob}, ${gender}, ${phone});
            `;

            // Commit the transaction
            await transaction.commit();

            res.json({ success: true, message: 'Account created successfully' });
        } catch (err) {
            await transaction.rollback();
            console.error(err);
            res.json({ success: false, message: 'Error creating account' });
        }
    } catch (err) {
        console.error(err);
        res.json({ success: false, message: 'Server error' });
    }
});
// Login route
// Modify the login route in server.js
app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    
    try {
        const result = await sql.query`
            SELECT a.cred_ID, a.password,
                   d.doctor_ID, d.doctorName,
                   p.patient_ID, p.patientName
            FROM Accounts a
            LEFT JOIN Doctor d ON d.cred_ID = a.cred_ID
            LEFT JOIN Patient p ON p.cred_ID = a.cred_ID
            WHERE a.username = ${username}
        `;

        if (result.recordset.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const user = result.recordset[0];
        
        // Use bcrypt.compare() to check the password
        const isValidPassword = await bcrypt.compare(password, user.password);
        
        if (!isValidPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        req.session.user = {
            credId: user.cred_ID,
            isDoctor: user.doctor_ID ? true : false,
            id: user.doctor_ID || user.patient_ID,
            name: user.doctorName || user.patientName
        };

        res.json({ 
            success: true, 
            isDoctor: user.doctor_ID ? true : false 
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});


// Doctor dashboard data
app.get('/api/doctor/appointments', async (req, res) => {
    if (!req.session.user || !req.session.user.isDoctor) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        const result = await sql.query`
            SELECT 
                a.appointment_ID,
                a.appointmentDate,
                a.appointmentDescription,
                p.patientName,
                p.bloodGroup,
                d.departmentName
            FROM Appointment a
            JOIN Patient p ON p.patient_ID = a.patient_ID
            JOIN Doctor doc ON doc.doctor_ID = a.doctor_ID
            JOIN Department d ON d.department_ID = doc.department_ID
            WHERE doc.doctor_ID = ${req.session.user.id}
            ORDER BY a.appointmentDate DESC
        `;

        res.json(result.recordset);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Patient dashboard data
app.get('/api/patient/appointments', async (req, res) => {
    if (!req.session.user || req.session.user.isDoctor) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        const result = await sql.query`
            SELECT 
                a.appointment_ID,
                a.appointmentDate,
                a.appointmentDescription,
                d.doctorName,
                dept.departmentName
            FROM Appointment a
            JOIN Doctor d ON d.doctor_ID = a.doctor_ID
            JOIN Department dept ON dept.department_ID = d.department_ID
            WHERE a.patient_ID = ${req.session.user.id}
            ORDER BY a.appointmentDate DESC
        `;

        res.json(result.recordset);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

app.get('/api/doctors/:departmentId', async (req, res) => {
    try {
        const result = await sql.query`
            SELECT d.doctor_ID, d.doctorName, dept.departmentName
            FROM Doctor d
            JOIN Department dept ON dept.department_ID = d.department_ID
            WHERE d.department_ID = ${req.params.departmentId}
        `;
        res.json(result.recordset);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get all departments
app.get('/api/departments', async (req, res) => {
    try {
        const result = await sql.query`
            SELECT department_ID, departmentName
            FROM Department
        `;
        res.json(result.recordset);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Schedule new appointment
app.post('/api/appointments', async (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const { doctorId, appointmentDate, appointmentDescription } = req.body;
    const patientId = req.session.user.id;

    try {
        const result = await sql.query`
            INSERT INTO Appointment (patient_ID, doctor_ID, appointmentDate, appointmentDescription)
            VALUES (${patientId}, ${doctorId}, ${appointmentDate}, ${appointmentDescription});
            
            SELECT SCOPE_IDENTITY() as appointment_ID;
        `;
        
        res.json({ 
            success: true, 
            appointmentId: result.recordset[0].appointment_ID 
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Add medical test
app.post('/api/tests', async (req, res) => {
    if (!req.session.user || !req.session.user.isDoctor) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const { appointmentId, testName } = req.body;

    try {
        await sql.query`
            INSERT INTO Tests (appointment_ID, testName, result)
            VALUES (${appointmentId}, ${testName}, 'Pending')
        `;
        
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Update test results
app.put('/api/tests/:testId', async (req, res) => {
    if (!req.session.user || !req.session.user.isDoctor) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const { result } = req.body;

    try {
        await sql.query`
            UPDATE Tests
            SET result = ${result}
            WHERE test_ID = ${req.params.testId}
        `;
        
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get tests for an appointment
app.get('/api/appointments/:appointmentId/tests', async (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        const result = await sql.query`
            SELECT test_ID, testName, result
            FROM Tests
            WHERE appointment_ID = ${req.params.appointmentId}
        `;
        
        res.json(result.recordset);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});


app.get('/api/patient/profile', async (req, res) => {
    if (!req.session.user || req.session.user.isDoctor) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        const result = await sql.query`
            SELECT 
                patientName, 
                bloodGroup, 
                DOB, 
                gender, 
                phone,
                DATEDIFF(YEAR, DOB, GETDATE()) -
                    CASE
                        WHEN (MONTH(DOB) > MONTH(GETDATE())) OR 
                             (MONTH(DOB) = MONTH(GETDATE()) AND DAY(DOB) > DAY(GETDATE()))
                        THEN 1
                        ELSE 0
                    END AS age
            FROM Patient
            WHERE patient_ID = ${req.session.user.id}
        `;
        
        if (result.recordset.length > 0) {
            res.json(result.recordset[0]);
        } else {
            res.status(404).json({ error: 'Profile not found' });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});


// Simple columnar report - Monthly appointments summary
// Add this route to your server.js
app.get('/reports/monthly', async (req, res) => {
    try {
        // Query to get monthly appointment statistics
        const result = await sql.query`
            WITH MonthlyStats AS (
                SELECT 
                    FORMAT(a.appointmentDate, 'yyyy-MM') as YearMonth,
                    COUNT(DISTINCT a.appointment_ID) as TotalAppointments,
                    COUNT(DISTINCT t.test_ID) as TotalTests,
                    COUNT(DISTINCT d.department_ID) as DepartmentsVisited,
                    COUNT(DISTINCT a.patient_ID) as UniquePatients
                FROM Appointment a
                LEFT JOIN Tests t ON t.appointment_ID = a.appointment_ID
                LEFT JOIN Doctor doc ON doc.doctor_ID = a.doctor_ID
                LEFT JOIN Department d ON d.department_ID = doc.department_ID
                GROUP BY FORMAT(a.appointmentDate, 'yyyy-MM')
            )
            SELECT 
                YearMonth,
                TotalAppointments,
                TotalTests,
                CAST(CAST(TotalTests AS FLOAT) / NULLIF(TotalAppointments, 0) AS DECIMAL(10,2)) as TestsPerAppointment,
                DepartmentsVisited,
                UniquePatients
            FROM MonthlyStats
            ORDER BY YearMonth DESC;
        `;
        
        res.sendFile(path.join(__dirname, 'public', 'monthly-report.html'));
    } catch (err) {
        console.error('Error generating monthly report:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Add this route to get the data separately
app.get('/api/reports/monthly/data', async (req, res) => {
    try {
        const result = await sql.query`
            WITH MonthlyStats AS (
                SELECT 
                    FORMAT(a.appointmentDate, 'yyyy-MM') as YearMonth,
                    COUNT(DISTINCT a.appointment_ID) as TotalAppointments,
                    COUNT(DISTINCT t.test_ID) as TotalTests,
                    COUNT(DISTINCT d.department_ID) as DepartmentsVisited,
                    COUNT(DISTINCT a.patient_ID) as UniquePatients
                FROM Appointment a
                LEFT JOIN Tests t ON t.appointment_ID = a.appointment_ID
                LEFT JOIN Doctor doc ON doc.doctor_ID = a.doctor_ID
                LEFT JOIN Department d ON d.department_ID = doc.department_ID
                GROUP BY FORMAT(a.appointmentDate, 'yyyy-MM')
            )
            SELECT 
                YearMonth,
                TotalAppointments,
                TotalTests,
                CAST(CAST(TotalTests AS FLOAT) / NULLIF(TotalAppointments, 0) AS DECIMAL(10,2)) as TestsPerAppointment,
                DepartmentsVisited,
                UniquePatients
            FROM MonthlyStats
            ORDER BY YearMonth DESC;
        `;
        
        res.json(result.recordset);
    } catch (err) {
        console.error('Error fetching monthly report data:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Grouped report - Department-wise appointments
app.get('/reports/department-summary', async (req, res) => {
    try {
        const result = await sql.query`
            SELECT 
                d.departmentName,
                doc.doctorName,
                COUNT(a.appointment_ID) as AppointmentCount,
                STRING_AGG(p.patientName, ', ') as Patients
            FROM Department d
            JOIN Doctor doc ON doc.department_ID = d.department_ID
            LEFT JOIN Appointment a ON a.doctor_ID = doc.doctor_ID
            LEFT JOIN Patient p ON p.patient_ID = a.patient_ID
            GROUP BY d.departmentName, doc.doctorName
            ORDER BY d.departmentName, AppointmentCount DESC;
        `;
        
        res.json(result.recordset);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Flexible report - Date range appointments
app.get('/reports/appointments', async (req, res) => {
    const { startDate, endDate, departmentId } = req.query;
    
    try {
        const result = await sql.query`
            SELECT 
                a.appointmentDate,
                p.patientName,
                doc.doctorName,
                d.departmentName,
                a.appointmentDescription,
                COUNT(t.test_ID) as TestCount
            FROM Appointment a
            JOIN Patient p ON p.patient_ID = a.patient_ID
            JOIN Doctor doc ON doc.doctor_ID = a.doctor_ID
            JOIN Department d ON d.department_ID = doc.department_ID
            LEFT JOIN Tests t ON t.appointment_ID = a.appointment_ID
            WHERE a.appointmentDate BETWEEN ${startDate} AND ${endDate}
            AND (${departmentId} IS NULL OR d.department_ID = ${departmentId})
            GROUP BY 
                a.appointmentDate,
                p.patientName,
                doc.doctorName,
                d.departmentName,
                a.appointmentDescription
            ORDER BY a.appointmentDate;
        `;
        
        res.json(result.recordset);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get departments for dropdown
app.get('/api/departments', async (req, res) => {
    try {
        const result = await sql.query`
            SELECT department_ID, departmentName
            FROM Department
            ORDER BY departmentName;
        `;
        res.json(result.recordset);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Combined report - Patient test history
app.get('/reports/patient-history', async (req, res) => {
    try {
        const result = await sql.query`
            SELECT 
                p.patientName,
                p.bloodGroup,
                a.appointmentDate,
                doc.doctorName,
                d.departmentName,
                t.testName,
                t.result
            FROM Patient p
            JOIN Appointment a ON a.patient_ID = p.patient_ID
            JOIN Doctor doc ON doc.doctor_ID = a.doctor_ID
            JOIN Department d ON d.department_ID = doc.department_ID
            LEFT JOIN Tests t ON t.appointment_ID = a.appointment_ID
            ORDER BY p.patientName, a.appointmentDate DESC;
        `;
        
        res.json(result.recordset);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});


const PORT = process.env.PORT || 3200;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));